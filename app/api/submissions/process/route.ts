import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pool, query } from '@/lib/postgres';
import { r2, R2_BUCKET } from '@/lib/r2';
import {
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
  inspectAndExtractZip,
} from '@/lib/upload';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_ZIP_BYTES =
  5 * 1024 * 1024 * 1024;

function publicUrl(key: string) {
  const base =
    process.env.R2_PUBLIC_URL;

  if (!base) {
    throw new Error(
      'R2_PUBLIC_URL is missing.'
    );
  }

  return `${base.replace(/\/$/, '')}/${key}`;
}

function localPathFromRelPath(
  relPath: string
) {
  const clean =
    String(relPath)
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

  return path.join(
    process.cwd(),
    'public',
    clean
  );
}

function getContentType(
  filename: string
) {
  const ext =
    filename
      .split('.')
      .pop()
      ?.toLowerCase();

  const types: Record<
    string,
    string
  > = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/mp4',
    webm: 'video/webm',
  };

  return (
    types[ext || ''] ||
    'application/octet-stream'
  );
}

export async function POST(
  req: Request
) {
  let submissionId:
    | number
    | undefined;

  let zipKey = '';

  const uploadedKeys: string[] = [];

  let tempZip: string | null = null;

  let mediaRoot: string | null = null;

  try {
    const session =
      await requireUser();

    const body =
      await req.json();

    zipKey =
      String(
        body.key || ''
      ).trim();

    const description =
      String(
        body.description || ''
      ).trim();

    const taskId =
      body.taskId === null ||
      body.taskId === undefined ||
      body.taskId === ''
        ? null
        : Number(body.taskId);

    /* =====================================================
       VALIDATE INPUT
    ===================================================== */

    if (!zipKey) {
      throw new Error(
        'Uploaded ZIP key is required.'
      );
    }

    if (
      !zipKey.startsWith(
        `submissions/${session.userId}/`
      )
    ) {
      throw new Error(
        'Invalid upload ownership.'
      );
    }

    if (
      !zipKey
        .toLowerCase()
        .endsWith('.zip')
    ) {
      throw new Error(
        'Only ZIP files are accepted.'
      );
    }

    if (!description) {
      throw new Error(
        'A description is required for every submission.'
      );
    }

    if (
      taskId !== null &&
      !Number.isFinite(taskId)
    ) {
      throw new Error(
        'Invalid task selected.'
      );
    }

    /* =====================================================
       GET TASK UPLOAD TYPE
    ===================================================== */

    let uploadType:
      | 'photo'
      | 'video'
      | 'both' = 'both';

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

    /* =====================================================
       CHECK R2 ZIP
    ===================================================== */

    const head =
      await r2.send(
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: zipKey,
          Range: 'bytes=0-0',
        })
      );

    /*
     * We only needed to verify that R2 can read
     * the object. Get the complete object below.
     */
    void head;

    const fullObject =
      await r2.send(
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: zipKey,
        })
      );

    if (!fullObject.Body) {
      throw new Error(
        'Could not read the uploaded ZIP from R2.'
      );
    }

    const zipSize =
      Number(
        fullObject.ContentLength || 0
      );

    if (
      !zipSize ||
      zipSize > MAX_ZIP_BYTES
    ) {
      throw new Error(
        'ZIP exceeds the 5 GB maximum.'
      );
    }

    /* =====================================================
       CREATE DATABASE SUBMISSION
    ===================================================== */

    const submissionResult =
      await query<{ id: number }>(
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
        ($1, $2, $3, $4, $5, 'pending')
        RETURNING id
        `,
        [
          taskId,
          session.userId,
          description,
          publicUrl(zipKey),
          zipSize,
        ]
      );

    submissionId =
      Number(
        submissionResult.rows[0]?.id
      );

    if (!submissionId) {
      throw new Error(
        'Could not create submission.'
      );
    }

    /* =====================================================
       SAVE R2 ZIP TEMPORARILY
    ===================================================== */

    tempZip = path.join(
      os.tmpdir(),
      `sumedha-${submissionId}-${crypto.randomUUID()}.zip`
    );

    await pipeline(
      fullObject.Body as any,
      createWriteStream(
        tempZip
      )
    );

    /* =====================================================
       EXTRACT USING EXISTING SAFE EXTRACTOR
    ===================================================== */

    mediaRoot = path.join(
      process.cwd(),
      'public',
      'uploads',
      'media',
      String(submissionId)
    );

    const extracted =
      await inspectAndExtractZip(
        tempZip,
        mediaRoot,
        uploadType
      );

    if (
      !extracted ||
      extracted.length === 0
    ) {
      throw new Error(
        'ZIP does not contain any supported media files.'
      );
    }

    /* =====================================================
       UPLOAD EXTRACTED MEDIA TO R2
    ===================================================== */

    const mediaRows: Array<{
      kind: string;
      title: string;
      description: string;
      mediaUrl: string;
    }> = [];

    for (
      const file of extracted
    ) {
      const originalName =
        String(
          file.originalName || ''
        );

      const localFile =
        localPathFromRelPath(
          file.relPath
        );

      const fileStat =
        await fs.stat(
          localFile
        );

      if (
        !fileStat.isFile()
      ) {
        throw new Error(
          `Extracted media file was not found: ${originalName}`
        );
      }

      const ext =
        originalName
          .split('.')
          .pop()
          ?.toLowerCase() ||
        'bin';

      const mediaKey =
        `media/${session.userId}/${submissionId}/${crypto.randomUUID()}.${ext}`;

      const fileStream =
        (await import('fs'))
          .createReadStream(
            localFile
          );

      const upload =
        new Upload({
          client: r2,
          params: {
            Bucket: R2_BUCKET,
            Key: mediaKey,
            Body: fileStream,
            ContentType:
              getContentType(
                originalName
              ),
          },
          leavePartsOnError:
            false,
        });

      await upload.done();

      uploadedKeys.push(
        mediaKey
      );

      const title =
        originalName
          .replace(
            /\.[^.]+$/,
            ''
          )
          .replace(
            /[-_]+/g,
            ' '
          )
          .trim();

      mediaRows.push({
        kind:
          String(
            file.kind || ''
          ).toLowerCase(),

        title,

        description,

        mediaUrl:
          publicUrl(mediaKey),
      });
    }

    /* =====================================================
       SAVE MEDIA DATABASE RECORDS
    ===================================================== */

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      for (
        const media of mediaRows
      ) {
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
            session.userId,
            taskId,
            media.kind,
            media.title,
            media.description,
            media.mediaUrl,
          ]
        );
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

    /* =====================================================
       CLEAN TEMPORARY FILES
    ===================================================== */

    if (tempZip) {
      await fs.rm(
        tempZip,
        {
          force: true,
        }
      ).catch(() => {});
    }

    if (mediaRoot) {
      await fs.rm(
        mediaRoot,
        {
          recursive: true,
          force: true,
        }
      ).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      submissionId,
      filesCount:
        mediaRows.length,
    });

  } catch (error: any) {
    console.error(
      '[SUBMISSION PROCESS ERROR]',
      error
    );

    /* =====================================================
       DELETE R2 MEDIA FILES
    ===================================================== */

    for (
      const key of uploadedKeys
    ) {
      await r2.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        })
      ).catch(() => {});
    }

    /* =====================================================
       DELETE ORIGINAL R2 ZIP
    ===================================================== */

    if (zipKey) {
      await r2.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: zipKey,
        })
      ).catch(() => {});
    }

    /* =====================================================
       DELETE DATABASE RECORDS
    ===================================================== */

    if (submissionId) {
      await query(
        `
        DELETE FROM media_items
        WHERE submission_id = $1
        `,
        [submissionId]
      ).catch(() => {});

      await query(
        `
        DELETE FROM submissions
        WHERE id = $1
        `,
        [submissionId]
      ).catch(() => {});
    }

    /* =====================================================
       CLEAN TEMPORARY FILES
    ===================================================== */

    if (tempZip) {
      await fs.rm(
        tempZip,
        {
          force: true,
        }
      ).catch(() => {});
    }

    if (mediaRoot) {
      await fs.rm(
        mediaRoot,
        {
          recursive: true,
          force: true,
        }
      ).catch(() => {});
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Submission processing failed.',
      },
      {
        status: 400,
      }
    );
  }
}