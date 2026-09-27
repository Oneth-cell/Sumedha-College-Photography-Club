import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pool, query } from '@/lib/postgres';
import {
  parseUpload,
  inspectAndExtractZip,
  MAX_ZIP_BYTES,
} from '@/lib/upload';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  try {
    const s = await requireUser();

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
      [s.userId]
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

export async function POST(req: Request) {
  let s;

  try {
    s = await requireUser();
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

  let parsed: {
    fields: Record<string, string>;
    filePath: string;
    fileSize: number;
  } | null = null;

  let submissionId: number | undefined;
  let finalZip: string | null = null;
  let mediaRoot: string | null = null;

  try {
    parsed = await parseUpload(req);

    if (parsed.fileSize > MAX_ZIP_BYTES) {
      throw new Error(
        'ZIP exceeds the 5 GB maximum.'
      );
    }

    const description =
      (parsed.fields.description || '').trim();

    if (!description) {
      throw new Error(
        'A description is required for every submission.'
      );
    }

    const taskId = parsed.fields.taskId
      ? Number(parsed.fields.taskId)
      : null;

    if (
      taskId !== null &&
      !Number.isFinite(taskId)
    ) {
      throw new Error(
        'Invalid task selected.'
      );
    }

    let uploadType:
      | 'photo'
      | 'video'
      | 'both' = 'both';

    if (taskId !== null) {
      const taskResult = await query<{
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

    /*
     * Create the submission first.
     *
     * zip_path is temporarily set to the local
     * parsed path and is replaced with the final
     * public path after the ZIP is moved.
     */
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
          s.userId,
          description,
          parsed.filePath,
          parsed.fileSize,
        ]
      );

    if (!submissionResult.rows[0]) {
      throw new Error(
        'Could not create submission.'
      );
    }

    submissionId =
      Number(
        submissionResult.rows[0].id
      );

    mediaRoot = path.join(
      process.cwd(),
      'public',
      'uploads',
      'media',
      String(submissionId)
    );

    const extracted =
      await inspectAndExtractZip(
        parsed.filePath,
        mediaRoot,
        uploadType
      );

    const destDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'submissions'
    );

    await fs.mkdir(
      destDir,
      {
        recursive: true,
      }
    );

    finalZip = path.join(
      destDir,
      `${submissionId}.zip`
    );

    await fs.rename(
      parsed.filePath,
      finalZip
    );

    const zipPublicPath =
      `/uploads/submissions/${submissionId}.zip`;

    await query(
      `
      UPDATE submissions
      SET zip_path = $1
      WHERE id = $2
      `,
      [
        zipPublicPath,
        submissionId,
      ]
    );

    /*
     * Insert media rows inside one PostgreSQL
     * transaction instead of better-sqlite3's
     * db.transaction().
     */
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      for (const file of extracted) {
        const title =
          file.originalName
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]+/g, ' ')
            .trim();

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
            s.userId,
            taskId,
            file.kind,
            title,
            description,
            file.relPath,
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

    return NextResponse.json({
      ok: true,
      submissionId,
      filesCount:
        extracted.length,
    });

  } catch (e: any) {
    /*
     * Clean up database rows.
     *
     * Your current Supabase schema does not rely
     * on PostgreSQL foreign-key cascades here, so
     * remove media rows explicitly first.
     */
    if (submissionId) {
      try {
        await query(
          `
          DELETE FROM media_items
          WHERE submission_id = $1
          `,
          [submissionId]
        );
      } catch {}
    }

    if (submissionId) {
      try {
        await query(
          `
          DELETE FROM submissions
          WHERE id = $1
          `,
          [submissionId]
        );
      } catch {}
    }

    if (parsed?.filePath) {
      await fs
        .rm(parsed.filePath, {
          force: true,
        })
        .catch(() => {});
    }

    if (finalZip) {
      await fs
        .rm(finalZip, {
          force: true,
        })
        .catch(() => {});
    }

    if (mediaRoot) {
      await fs
        .rm(mediaRoot, {
          recursive: true,
          force: true,
        })
        .catch(() => {});
    }

    console.error(
      '[SUBMISSION ERROR]',
      e
    );

    return NextResponse.json(
      {
        error:
          e?.message ||
          'Submission failed.',
      },
      {
        status: 400,
      }
    );
  }
}