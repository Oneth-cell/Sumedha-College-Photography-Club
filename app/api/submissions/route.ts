import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import db from '@/lib/db';
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

    const submissions = db
      .prepare(
        `SELECT s.*, t.title task_title
         FROM submissions s
         LEFT JOIN tasks t ON t.id = s.task_id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC`
      )
      .all(s.userId);

    return NextResponse.json({ submissions });
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
}

export async function POST(req: Request) {
  let s;

  try {
    s = await requireUser();
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
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
      throw new Error('ZIP exceeds the 5 GB maximum.');
    }

    const description = (parsed.fields.description || '').trim();

    if (!description) {
      throw new Error(
        'A description is required for every submission.'
      );
    }

    const taskId = parsed.fields.taskId
      ? Number(parsed.fields.taskId)
      : null;

    let uploadType: 'photo' | 'video' | 'both' = 'both';

    if (taskId) {
      const t = db
        .prepare('SELECT upload_type FROM tasks WHERE id = ?')
        .get(taskId) as
        | { upload_type: 'photo' | 'video' | 'both' }
        | undefined;

      if (!t) {
        throw new Error('Selected task was not found.');
      }

      uploadType = t.upload_type;
    }

    const row = db
      .prepare(
        `INSERT INTO submissions
        (task_id, user_id, description, zip_path, zip_size, status)
        VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .run(
        taskId,
        s.userId,
        description,
        parsed.filePath,
        parsed.fileSize
      );

    submissionId = Number(row.lastInsertRowid);

    mediaRoot = path.join(
      process.cwd(),
      'public',
      'uploads',
      'media',
      String(submissionId)
    );

    const extracted = await inspectAndExtractZip(
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

    await fs.mkdir(destDir, { recursive: true });

    finalZip = path.join(
      destDir,
      `${submissionId}.zip`
    );

    await fs.rename(parsed.filePath, finalZip);

    db.prepare(
      'UPDATE submissions SET zip_path = ? WHERE id = ?'
    ).run(
      `/uploads/submissions/${submissionId}.zip`,
      submissionId
    );

    const ins = db.prepare(
      `INSERT INTO media_items
      (submission_id, user_id, task_id, kind, title, description, media_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    );

    const insertMedia = db.transaction(() => {
      for (const file of extracted) {
        const title = file.originalName
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]+/g, ' ')
          .trim();

        ins.run(
          submissionId,
          s.userId,
          taskId,
          file.kind,
          title,
          description,
          file.relPath
        );
      }
    });

    insertMedia();

    return NextResponse.json({
      ok: true,
      submissionId,
      filesCount: extracted.length,
    });
  } catch (e: any) {
    if (submissionId) {
      try {
        db.prepare(
          'DELETE FROM submissions WHERE id = ?'
        ).run(submissionId);
      } catch {}
    }

    if (parsed?.filePath) {
      await fs.rm(parsed.filePath, { force: true }).catch(() => {});
    }

    if (finalZip) {
      await fs.rm(finalZip, { force: true }).catch(() => {});
    }

    if (mediaRoot) {
      await fs.rm(mediaRoot, {
        recursive: true,
        force: true,
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        error:
          e?.message || 'Submission failed.',
      },
      { status: 400 }
    );
  }
}