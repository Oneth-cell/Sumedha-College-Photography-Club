import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth';
import { pool, query } from '@/lib/postgres';
import { r2, R2_BUCKET } from '@/lib/r2';

import {
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

import { Upload } from '@aws-sdk/lib-storage';

import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';

import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

import unzipper from 'unzipper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_ZIP_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;

const PHOTO_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.webm',
]);

function publicUrl(key: string) {
  const base = process.env.R2_PUBLIC_URL;

  if (!base) {
    throw new Error('R2_PUBLIC_URL is missing.');
  }

  return `${base.replace(/\/+$/, '')}/${key}`;
}

function getContentType(filename: string) {
  const ext = path.extname(filename).toLowerCase();

  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',

    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.m4v': 'video/mp4',
    '.webm': 'video/webm',
  };

  return types[ext] || 'application/octet-stream';
}

function getMediaKind(filename: string): 'photo' | 'video' | null {
  const ext = path.extname(filename).toLowerCase();

  if (PHOTO_EXTENSIONS.has(ext)) {
    return 'photo';
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    return 'video';
  }

  return null;
}

function safeFilename(filename: string) {
  const basename = path.basename(filename);

  return basename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeZipPath(entryPath: string) {
  const normalized = entryPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  const parts = normalized.split('/');

  if (
    parts.some(
      (part) =>
        part === '..' ||
        part === '.' ||
        part.length === 0
    )
  ) {
    return null;
  }

  const filename = parts[parts.length - 1];

  if (!filename) {
    return null;
  }

  return safeFilename(filename);
}

function getTitle(filename: string) {
  return path
    .basename(filename)
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function uploadTypeAllows(
  uploadType: 'photo' | 'video' | 'both',
  kind: 'photo' | 'video'
) {
  if (uploadType === 'both') {
    return true;
  }

  return uploadType === kind;
}

async function removeFile(filePath: string | null) {
  if (!filePath) return;

  await fs.rm(filePath, {
    force: true,
  }).catch(() => {});
}

async function removeDirectory(dirPath: string | null) {
  if (!dirPath) return;

  await fs.rm(dirPath, {
    recursive: true,
    force: true,
  }).catch(() => {});
}

export async function POST(req: Request) {
  let submissionId: number | undefined;

  let zipKey = '';

  const uploadedKeys: string[] = [];

  let tempZip: string | null = null;
  let tempRoot: string | null = null;

  try {
    // =====================================================
    // AUTH
    // =====================================================

    const session = await requireUser();

    // =====================================================
    // READ REQUEST
    // =====================================================

    const body = await req.json();

    zipKey = String(body.key || '').trim();

    const description = String(
      body.description || ''
    ).trim();

    const taskId =
      body.taskId === null ||
      body.taskId === undefined ||
      body.taskId === ''
        ? null
        : Number(body.taskId);

    // =====================================================
    // VALIDATE INPUT
    // =====================================================

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

    // =====================================================
    // GET TASK UPLOAD TYPE
    // =====================================================

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

      const task = taskResult.rows[0];

      if (!task) {
        throw new Error(
          'Selected task was not found.'
        );
      }

      uploadType = task.upload_type;
    }

    // =====================================================
    // DOWNLOAD ZIP FROM R2 TO VERCEL /tmp
    // =====================================================

    const zipObject = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: zipKey,
      })
    );

    if (!zipObject.Body) {
      throw new Error(
        'Could not read the uploaded ZIP from R2.'
      );
    }

    const zipSize = Number(
      zipObject.ContentLength || 0
    );

    if (!zipSize) {
      throw new Error(
        'Uploaded ZIP is empty.'
      );
    }

    if (zipSize > MAX_ZIP_BYTES) {
      throw new Error(
        'ZIP exceeds the 5 GB maximum.'
      );
    }

    // =====================================================
    // CREATE TEMP DIRECTORY
    //
    // IMPORTANT:
    // Never use /public/uploads on Vercel.
    // =====================================================

    tempRoot = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        'sumedha-photography-'
      )
    );

    tempZip = path.join(
      tempRoot,
      `submission-${crypto.randomUUID()}.zip`
    );

    // Save R2 ZIP into /tmp
    await pipeline(
      zipObject.Body as any,
      createWriteStream(tempZip)
    );

    // =====================================================
    // CREATE DATABASE SUBMISSION
    // =====================================================

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

    submissionId = Number(
      submissionResult.rows[0]?.id
    );

    if (!submissionId) {
      throw new Error(
        'Could not create submission.'
      );
    }

    // =====================================================
    // OPEN ZIP
    // =====================================================

    const directory =
      await unzipper.Open.file(tempZip);

    const mediaRows: Array<{
      kind: 'photo' | 'video';
      title: string;
      description: string;
      mediaUrl: string;
    }> = [];

    let supportedFiles = 0;

    // =====================================================
    // PROCESS ZIP ENTRIES
    // =====================================================

    for (const entry of directory.files) {
      // Skip directories
      if (entry.type !== 'File') {
        continue;
      }

      const originalPath = String(
        entry.path || ''
      );

      const filename = safeZipPath(
        originalPath
      );

      if (!filename) {
        continue;
      }

      const kind = getMediaKind(filename);

      // Ignore unsupported files
      if (!kind) {
        continue;
      }

      if (
        !uploadTypeAllows(
          uploadType,
          kind
        )
      ) {
        continue;
      }

      const fileSize = Number(
        entry.uncompressedSize || 0
      );

      // ===================================================
      // SIZE VALIDATION
      // ===================================================

      if (
        kind === 'photo' &&
        fileSize > MAX_PHOTO_BYTES
      ) {
        throw new Error(
          `Photo exceeds the 50 MB maximum: ${filename}`
        );
      }

      if (
        kind === 'video' &&
        fileSize > MAX_VIDEO_BYTES
      ) {
        throw new Error(
          `Video exceeds the 4 GB maximum: ${filename}`
        );
      }

      if (fileSize <= 0) {
        continue;
      }

      supportedFiles++;

      // ===================================================
      // TEMPORARY LOCAL FILE
      // ===================================================

      const localFile = path.join(
        tempRoot,
        `${crypto.randomUUID()}-${filename}`
      );

      // Extract ONLY this file into /tmp
      await pipeline(
        entry.stream(),
        createWriteStream(localFile)
      );

      // ===================================================
      // VERIFY EXTRACTED FILE
      // ===================================================

      const stat = await fs.stat(
        localFile
      );

      if (!stat.isFile()) {
        throw new Error(
          `Extracted file is invalid: ${filename}`
        );
      }

      // ===================================================
      // R2 MEDIA KEY
      // ===================================================

      const ext =
        path
          .extname(filename)
          .toLowerCase()
          .replace('.', '') || 'bin';

      const mediaKey =
        `media/${session.userId}/${submissionId}/${crypto.randomUUID()}.${ext}`;

      // ===================================================
      // UPLOAD MEDIA TO R2
      // =====================================================

      const fileStream =
        createReadStream(localFile);

      const upload = new Upload({
        client: r2,

        params: {
          Bucket: R2_BUCKET,

          Key: mediaKey,

          Body: fileStream,

          ContentType:
            getContentType(filename),
        },

        leavePartsOnError: false,
      });

      await upload.done();

      uploadedKeys.push(mediaKey);

      // ===================================================
      // PREPARE DB ROW
      // ===================================================

      mediaRows.push({
        kind,

        title: getTitle(filename),

        description,

        mediaUrl: publicUrl(
          mediaKey
        ),
      });

      // ===================================================
      // DELETE TEMP MEDIA FILE
      // =====================================================

      await removeFile(
        localFile
      );
    }

    // =====================================================
    // MAKE SURE ZIP HAD MEDIA
    // =====================================================

    if (
      supportedFiles === 0 ||
      mediaRows.length === 0
    ) {
      throw new Error(
        'ZIP does not contain any supported media files for the selected task.'
      );
    }

    // =====================================================
    // SAVE MEDIA DATABASE RECORDS
    // =====================================================

    const client =
      await pool.connect();

    try {
      await client.query('BEGIN');

      for (const media of mediaRows) {
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

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // =====================================================
    // CLEAN TEMP FILES
    // =====================================================

    await removeFile(tempZip);

    await removeDirectory(
      tempRoot
    );

    // =====================================================
    // SUCCESS
    // =====================================================

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

    // =====================================================
    // DELETE UPLOADED R2 MEDIA
    // =====================================================

    for (const key of uploadedKeys) {
      await r2
        .send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
          })
        )
        .catch(() => {});
    }

    // =====================================================
    // DELETE ORIGINAL ZIP FROM R2
    // =====================================================

    if (zipKey) {
      await r2
        .send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: zipKey,
          })
        )
        .catch(() => {});
    }

    // =====================================================
    // DELETE DATABASE RECORDS
    // =====================================================

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

    // =====================================================
    // CLEAN TEMP FILES
    // =====================================================

    await removeFile(tempZip);

    await removeDirectory(
      tempRoot
    );

    // =====================================================
    // ERROR RESPONSE
    // =====================================================

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