import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import Busboy from 'busboy';
import unzipper from 'unzipper';

export const MAX_ZIP_BYTES = 5 * 1024 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;

const imageExts = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
]);

const videoExts = new Set([
  'mp4',
  'mov',
  'm4v',
  'webm',
]);

export function extOf(name: string) {
  return (name.split('.').pop() || '').toLowerCase();
}

export function mediaKind(
  name: string
): 'image' | 'video' | null {
  const e = extOf(name);

  if (imageExts.has(e)) return 'image';
  if (videoExts.has(e)) return 'video';

  return null;
}

export async function parseUpload(req: Request) {
  const contentType =
    req.headers.get('content-type') || '';

  if (!contentType.startsWith('multipart/form-data')) {
    throw new Error('multipart/form-data required');
  }

  if (!req.body) {
    throw new Error('Upload body missing');
  }

  const bb = Busboy({
    headers: {
      'content-type': contentType,
    },
    limits: {
      files: 1,
      fields: 10,
      fileSize: MAX_ZIP_BYTES + 1,
    },
  });

  const tmpDir = path.join(
    process.cwd(),
    'public',
    'uploads',
    'tmp'
  );

  await fsp.mkdir(tmpDir, {
    recursive: true,
  });

  let filePath = '';
  let fileName = '';
  let tooLarge = false;

  const fields: Record<string, string> = {};

  const completion = new Promise<void>(
    (resolve, reject) => {
      let filePipeline: Promise<void> | null = null;

      bb.on('field', (name, value) => {
        fields[name] = value;
      });

      bb.on(
        'file',
        (_name, file, info) => {
          fileName =
            info.filename || 'submission.zip';

          const safeName = `${Date.now()}-${crypto.randomUUID()}.zip`;

          filePath = path.join(
            tmpDir,
            safeName
          );

          const out =
            fs.createWriteStream(filePath);

          file.on('limit', () => {
            tooLarge = true;
          });

          filePipeline = pipeline(
            file,
            out
          ).catch((error) => {
            if (!tooLarge) {
              throw error;
            }
          });
        }
      );

      bb.on('error', reject);

      bb.on('finish', async () => {
        try {
          if (filePipeline) {
            await filePipeline;
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }
  );

  await pipeline(
    Readable.fromWeb(req.body as any),
    bb
  );

  await completion;

  if (tooLarge) {
    if (filePath) {
      await fsp.rm(filePath, {
        force: true,
      });
    }

    throw new Error(
      'ZIP exceeds the 5 GB maximum.'
    );
  }

  if (!filePath) {
    throw new Error(
      'ZIP file is required.'
    );
  }

  const stat = await fsp.stat(filePath);

  if (stat.size > MAX_ZIP_BYTES) {
    await fsp.rm(filePath, {
      force: true,
    });

    throw new Error(
      'ZIP exceeds the 5 GB maximum.'
    );
  }

  if (extOf(fileName) !== 'zip') {
    await fsp.rm(filePath, {
      force: true,
    });

    throw new Error(
      'Only .zip submissions are accepted.'
    );
  }

  return {
    fields,
    filePath,
    fileSize: stat.size,
  };
}

export async function inspectAndExtractZip(
  zipPath: string,
  destRoot: string,
  uploadType: 'photo' | 'video' | 'both'
) {
  const directory =
    await unzipper.Open.file(zipPath);

  const files: Array<{
    entry: any;
    kind: 'image' | 'video';
    path: string;
    size: number;
  }> = [];

  for (const entry of directory.files) {
    if (entry.type !== 'File') {
      continue;
    }

    const clean = String(entry.path)
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

    if (
      clean.startsWith('/') ||
      clean.split('/').includes('..')
    ) {
      throw new Error(
        'ZIP contains an unsafe file path.'
      );
    }

    const kind = mediaKind(clean);

    if (!kind) {
      throw new Error(
        `Unsupported file inside ZIP: ${clean}`
      );
    }

    if (
      uploadType === 'photo' &&
      kind !== 'image'
    ) {
      throw new Error(
        'This task accepts photos only.'
      );
    }

    if (
      uploadType === 'video' &&
      kind !== 'video'
    ) {
      throw new Error(
        'This task accepts videos only.'
      );
    }

    const size = Number(
      entry.uncompressedSize || 0
    );

    if (
      kind === 'image' &&
      size >= MAX_PHOTO_BYTES
    ) {
      throw new Error(
        `Photo must be less than 50 MB: ${clean}`
      );
    }

    if (
      kind === 'video' &&
      size > MAX_VIDEO_BYTES
    ) {
      throw new Error(
        `Video must be 4 GB or less: ${clean}`
      );
    }

    files.push({
      entry,
      kind,
      path: clean,
      size,
    });

    if (files.length > 300) {
      throw new Error(
        'A single submission may contain at most 300 media files.'
      );
    }
  }

  if (!files.length) {
    throw new Error(
      'ZIP must contain at least one supported photo or video.'
    );
  }

  await fsp.mkdir(destRoot, {
    recursive: true,
  });

  const extracted: Array<{
    kind: 'image' | 'video';
    relPath: string;
    size: number;
    originalName: string;
  }> = [];

  for (const f of files) {
    const ext =
      extOf(f.path) || 'bin';

    const outName =
      `${crypto.randomUUID()}.${ext}`;

    const outPath =
      path.join(destRoot, outName);

    await pipeline(
      f.entry.stream(),
      fs.createWriteStream(outPath)
    );

    extracted.push({
      kind: f.kind,
      relPath:
        `/uploads/media/${path.basename(destRoot)}/${outName}`,
      size: f.size,
      originalName:
        path.basename(f.path),
    });
  }

  return extracted;
}