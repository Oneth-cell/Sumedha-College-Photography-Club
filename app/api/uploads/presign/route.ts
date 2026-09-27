import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { r2, R2_BUCKET } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
]);

const ALLOWED_ZIP_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
  'application/octet-stream',
  '',
]);

export async function POST(req: Request) {
  try {
    const session = await requireUser();

    const body = await req.json();

    const filename = String(
      body.filename || ''
    ).trim();

    const suppliedContentType = String(
      body.contentType || ''
    ).trim().toLowerCase();

    const folder = String(
      body.folder || 'uploads'
    )
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ''
      );

    if (!filename) {
      return NextResponse.json(
        {
          error: 'Filename is required.',
        },
        {
          status: 400,
        }
      );
    }

    const lowerFilename =
      filename.toLowerCase();

    const isZip =
      lowerFilename.endsWith('.zip');

    const isImage =
      ALLOWED_IMAGE_TYPES.has(
        suppliedContentType
      );

    const isVideo =
      ALLOWED_VIDEO_TYPES.has(
        suppliedContentType
      );

    if (
      !isZip &&
      !isImage &&
      !isVideo
    ) {
      return NextResponse.json(
        {
          error:
            `Unsupported file type: ${suppliedContentType || 'unknown'}.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Always use application/zip for .zip uploads.
     * This avoids browser-specific ZIP MIME types.
     */
    const contentType =
      isZip
        ? 'application/zip'
        : suppliedContentType;

    const safeFilename =
      filename
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        ?.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        ) ||
      'upload';

    const key =
      `${folder}/${session.userId}/${crypto.randomUUID()}-${safeFilename}`;

    const command =
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: undefined,
        ContentType: contentType,
      });

    const uploadUrl =
      await getSignedUrl(
        r2,
        command,
        {
          expiresIn: 3600,
        }
      );

    const publicBase =
      process.env.R2_PUBLIC_URL;

    const publicUrl =
      publicBase
        ? `${publicBase.replace(/\/$/, '')}/${key}`
        : null;

    return NextResponse.json({
      ok: true,
      key,
      uploadUrl,
      publicUrl,
      contentType,
    });

  } catch (error) {
    console.error(
      '[R2 PRESIGN ERROR]',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not create upload URL.',
      },
      {
        status: 500,
      }
    );
  }
}