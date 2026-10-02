import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth';
import { pool, query } from '@/lib/postgres';

import {
  parseUpload,
  inspectAndExtractZip,
  MAX_ZIP_BYTES,
} from '@/lib/upload';

import { r2, R2_BUCKET } from '@/lib/r2';

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ============================================================
// R2 PUBLIC URL
// ============================================================

function publicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL;

  if (!base) {
    throw new Error(
      'R2_PUBLIC_URL is missing.'
    );
  }

  return `${base.replace(/\/+$/, '')}/${key}`;
}

// ============================================================
// UPLOAD LOCAL FILE TO R2
// ============================================================

async function uploadFileToR2(
  filePath: string,
  key: string,
  contentType: string
) {
  const stat = await fs.stat(filePath);

  const stream =
    fsSync.createReadStream(filePath);

  const upload = new Upload({
    client: r2,

    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ContentLength: stat.size,
    },

    leavePartsOnError: false,
  });

  await upload.done();

  return {
    key,
    size: stat.size,
    url: publicUrl(key),
  };
}

// ============================================================
// GET SUBMISSIONS
// ============================================================

export async function GET() {
  try {
    const user = await requireUser();

    const result = await query(
      `
      SELECT
        s.*,
        t.title AS task_title
      FROM submissions s
      LEFT JOIN tasks t
        ON t.id = s.task_id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      `,
      [user.userId]
    );

    return NextResponse.json({
      submissions: result.rows,
    });
  } catch (error) {
    console.error(
      '[SUBMISSIONS GET ERROR]',
      error
    );

    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }
}

// ============================================================
// POST SUBMISSION
// ============================================================

export async function POST(req: Request) {
  let user: any;

  try {
    user = await requireUser();
  } catch {
    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }

  let parsed:
    Awaited<ReturnType<typeof parseUpload>> | null =
    null;

  let submissionId: number | null = null;

  let zipKey: string | null = null;

  let mediaRoot: string | null = null;

  const uploadedR2Keys: string[] = [];

  try {
    // ========================================================
    // 1. PARSE UPLOAD
    // ========================================================

    parsed = await parseUpload(req);

    if (!parsed) {
      throw new Error(
        'Could not parse uploaded file.'
      );
    }

    if (parsed.fileSize <= 0) {
      throw new Error(
        'Uploaded ZIP is empty.'
      );
    }

    if (
      parsed.fileSize >
      MAX_ZIP_BYTES
    ) {
      throw new Error(
        'ZIP exceeds the 5 GB maximum.'
      );
    }

    // ========================================================
    // 2. DESCRIPTION
    // ========================================================

    const description =
      (
        parsed.fields.description ||
        ''
      ).trim();

    if (!description) {
      throw new Error(
        'A description is required.'
      );
    }

    // ========================================================
    // 3. TASK ID
    // ========================================================

    let taskId: number | null =
      null;

    if (
      parsed.fields.taskId
    ) {
      const parsedTaskId =
        Number(
          parsed.fields.taskId
        );

      if (
        !Number.isInteger(
          parsedTaskId
        )
      ) {
        throw new Error(
          'Invalid task ID.'
        );
      }

      taskId =
        parsedTaskId;
    }

    // ========================================================
    // 4. GET TASK UPLOAD TYPE
    // ========================================================

    let uploadType:
      | 'photo'
      | 'video'
      | 'both' =
      'both';

    if (taskId !== null) {
      const taskResult =
        await query<{
          upload_type:
            | 'photo'
            | 'video'
            | 'both';
        }>(
          `
          SELECT upload_type
          FROM tasks
          WHERE id = $1
          LIMIT 1
          `,
          [taskId]
        );

      const task =
        taskResult.rows[0];

      if (!task) {
        throw new Error(
          'Selected task was not found.'
        );
      }

      uploadType =
        task.upload_type;
    }

    // ========================================================
    // 5. CREATE SUBMISSION
    // ========================================================

    const submissionResult =
      await query<{
        id: number;
      }>(
        `
        INSERT INTO submissions
        (
          task_id,
          user_id,
          description,
          zip_path,
          zip_size,
          status
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          'pending'
        )
        RETURNING id
        `,
        [
          taskId,
          user.userId,
          description,
          '',
          parsed.fileSize,
        ]
      );

    const createdSubmission =
      submissionResult.rows[0];

    if (!createdSubmission) {
      throw new Error(
        'Could not create submission.'
      );
    }

    submissionId =
      Number(
        createdSubmission.id
      );

    // ========================================================
    // 6. CREATE R2 ZIP KEY
    // ========================================================

    zipKey =
      `submissions/${user.userId}/${submissionId}/${crypto.randomUUID()}.zip`;

    // ========================================================
    // 7. UPLOAD ORIGINAL ZIP TO R2
    // ========================================================

    await uploadFileToR2(
      parsed.filePath,
      zipKey,
      'application/zip'
    );

    uploadedR2Keys.push(
      zipKey
    );

    // ========================================================
    // 8. SAVE ZIP URL TO DATABASE
    // ========================================================

    await query(
      `
      UPDATE submissions
      SET zip_path = $1
      WHERE id = $2
      `,
      [
        publicUrl(zipKey),
        submissionId,
      ]
    );

    // ========================================================
    // 9. TEMPORARY DIRECTORY
    //
    // IMPORTANT:
    // Vercel does NOT allow permanent writes to:
    // /var/task/public/uploads
    //
    // We use /tmp instead.
    // ========================================================

    mediaRoot = path.join(
      '/tmp',
      'sumedha-photography-media',
      String(submissionId),
      crypto.randomUUID()
    );

    // ========================================================
    // 10. EXTRACT ZIP + UPLOAD MEDIA TO R2
    // ========================================================

    const extracted =
      await inspectAndExtractZip(
        parsed.filePath,
        mediaRoot,
        uploadType
      );

    // ========================================================
    // 11. SAVE MEDIA DATABASE RECORDS
    // ========================================================

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      for (
        const file of extracted
      ) {
        const title =
          file.originalName
            .replace(
              /\.[^.]+$/,
              ''
            )
            .replace(
              /[-_]+/g,
              ' '
            )
            .trim();

        /*
         * upload.ts returns:
         *
         * image
         * video
         *
         * Database expects:
         *
         * photo
         * video
         */

        const databaseKind =
          file.kind === 'image'
            ? 'photo'
            : 'video';

        await client.query(
          `
          INSERT INTO media_items
          (
            submission_id,
            user_id,
            task_id,
            kind,
            title,
            description,
            media_url,
            status
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            'pending'
          )
          `,
          [
            submissionId,
            user.userId,
            taskId,
            databaseKind,
            title,
            description,
            file.mediaUrl,
          ]
        );

        if (file.r2Key) {
          uploadedR2Keys.push(
            file.r2Key
          );
        }
      }

      await client.query(
        'COMMIT'
      );
    } catch (error) {
      await client.query(
        'ROLLBACK'
      );

      throw error;
    } finally {
      client.release();
    }

    // ========================================================
    // 12. DELETE TEMP ZIP
    // ========================================================

    await fs
      .rm(
        parsed.filePath,
        {
          force: true,
        }
      )
      .catch(() => {});

    // ========================================================
    // 13. SUCCESS
    // ========================================================

    return NextResponse.json({
      ok: true,
      submissionId,
      filesCount:
        extracted.length,
      zipUrl:
        publicUrl(zipKey),
    });
  } catch (error: any) {
    console.error(
      '[SUBMISSION POST ERROR]',
      error
    );

    // ========================================================
    // DELETE R2 FILES
    // ========================================================

    for (
      const key of uploadedR2Keys
    ) {
      try {
        await r2.send(
          new DeleteObjectCommand({
            Bucket:
              R2_BUCKET,
            Key: key,
          })
        );
      } catch {
        // Ignore cleanup errors
      }
    }

    // ========================================================
    // DELETE MEDIA DATABASE RECORDS
    // ========================================================

    if (
      submissionId !== null
    ) {
      await query(
        `
        DELETE FROM media_items
        WHERE submission_id = $1
        `,
        [submissionId]
      ).catch(() => {});

      // ======================================================
      // DELETE SUBMISSION
      // ======================================================

      await query(
        `
        DELETE FROM submissions
        WHERE id = $1
        `,
        [submissionId]
      ).catch(() => {});
    }

    // ========================================================
    // DELETE TEMP ZIP
    // ========================================================

    if (
      parsed?.filePath
    ) {
      await fs
        .rm(
          parsed.filePath,
          {
            force: true,
          }
        )
        .catch(() => {});
    }

    // ========================================================
    // DELETE TEMP MEDIA
    // ========================================================

    if (mediaRoot) {
      await fs
        .rm(
          mediaRoot,
          {
            recursive: true,
            force: true,
          }
        )
        .catch(() => {});
    }

    // ========================================================
    // RETURN ERROR
    // ========================================================

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Submission failed.',
      },
      {
        status: 400,
      }
    );
  }
}