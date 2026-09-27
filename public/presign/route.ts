import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { r2, R2_BUCKET } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set([
  'application/zip',
  'application/octet-stream',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
]);

export async function POST(req: Request) {
  try {
    const session = await requireUser();

    const body = await req.json();

    const filename = String(
      body.filename || ''
    ).trim();

    const contentType = String(
      body.contentType ||
        'application/octet-stream'
    ).trim();

    const folder = String(
      body.folder || 'uploads'
    )
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          error: 'Unsupported file type.',
        },
        { status: 400 }
      );
    }

    const safeFilename =
      filename
        .replace(/\\/g, '/')
        .split('/')
        .pop()
        ?.replace(/[^a-zA-Z0-9._-]/g, '_') ||
      'upload';

    const key =
      `${folder}/${session.userId}/${crypto.randomUUID()}-${safeFilename}`;

    const command =
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: contentType,
      });

    const uploadUrl =
      await getSignedUrl(
        r2,
        command,
        {
          expiresIn: 60 * 60,
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