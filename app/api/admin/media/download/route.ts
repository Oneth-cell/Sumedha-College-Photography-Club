import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/postgres';

import {
  GetObjectCommand
} from '@aws-sdk/client-s3';

import {
  r2,
  R2_BUCKET
} from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =========================================================
   SAFE FILE NAME
========================================================= */

function safeFilename(
  value: string
) {
  return (
    value
      .replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      )
      .replace(
        /_+/g,
        '_'
      )
      .slice(
        0,
        180
      ) ||
    'media'
  );
}

/* =========================================================
   GET EXTENSION
========================================================= */

function getExtension(
  mediaUrl: string,
  kind: string
) {
  try {
    const pathname =
      new URL(
        mediaUrl
      ).pathname;

    const name =
      pathname
        .split('/')
        .pop() || '';

    const match =
      name.match(
        /\.([a-zA-Z0-9]+)$/
      );

    if (
      match?.[1]
    ) {
      return `.${match[1]}`;
    }
  } catch {}

  const relativeName =
    mediaUrl
      .split('/')
      .pop() || '';

  const relativeMatch =
    relativeName.match(
      /\.([a-zA-Z0-9]+)$/
    );

  if (
    relativeMatch?.[1]
  ) {
    return `.${relativeMatch[1]}`;
  }

  return (
    kind === 'video'
      ? '.mp4'
      : '.jpg'
  );
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  req: Request
) {
  try {
    /* -------------------------
       ADMIN AUTH
    ------------------------- */

    await requireAdmin();

    /* -------------------------
       MEDIA ID
    ------------------------- */

    const url =
      new URL(
        req.url
      );

    const id =
      Number(
        url.searchParams.get(
          'mediaId'
        )
      );

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid media ID.'
        },
        {
          status: 400
        }
      );
    }

    /* -------------------------
       GET DATABASE RECORD
    ------------------------- */

    const result =
      await query<{
        title: string;
        kind: string;
        media_url: string;
        user_id: number;
        submission_id: number;
      }>(
        `
        SELECT
          title,
          kind,
          media_url,
          user_id,
          submission_id
        FROM media_items
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

    const media =
      result.rows[0];

    if (!media) {
      return NextResponse.json(
        {
          error:
            'Media not found.'
        },
        {
          status: 404
        }
      );
    }

    /* -------------------------
       DEFAULT TYPE
    ------------------------- */

    let contentType =
      String(
        media.kind
      ).toLowerCase() ===
      'video'
        ? 'video/mp4'
        : 'image/jpeg';

    let contentLength:
      | number
      | undefined;

    let body:
      | ReadableStream<Uint8Array>
      | null = null;

    let r2Key = '';

    /* =====================================================
       METHOD 1
       MEDIA URL IS ALREADY AN R2 PUBLIC URL
    ===================================================== */

    const publicBase =
      process.env.R2_PUBLIC_URL
        ?.replace(
          /\/$/,
          ''
        );

    if (
      publicBase &&
      media.media_url.startsWith(
        publicBase + '/'
      )
    ) {
      r2Key =
        media.media_url.slice(
          (
            publicBase + '/'
          ).length
        );
    }

    /* =====================================================
       METHOD 2
       OLD DATABASE PATH

       Example:
       /uploads/media/4/DSC06602.jpg

       R2:
       media/2/4/DSC06602.jpg

       user_id = 2
    ===================================================== */

    else if (
      media.media_url.startsWith(
        '/uploads/media/'
      )
    ) {
      const relativePath =
        media.media_url.replace(
          /^\/uploads\/media\//,
          ''
        );

      r2Key =
        `media/${media.user_id}/${relativePath}`;
    }

    /* =====================================================
       METHOD 3
       POSSIBLE R2 URL WITHOUT CONFIGURED PUBLIC URL
    ===================================================== */

    else {
      try {
        const parsed =
          new URL(
            media.media_url
          );

        const host =
          parsed.hostname
            .toLowerCase();

        if (
          host.includes(
            '.r2.dev'
          )
        ) {
          r2Key =
            parsed.pathname
              .replace(
                /^\/+/,
                ''
              );
        }
      } catch {}
    }

    /* =====================================================
       DOWNLOAD FROM R2
    ===================================================== */

    if (r2Key) {
      try {
        const object =
          await r2.send(
            new GetObjectCommand({
              Bucket:
                R2_BUCKET,
              Key:
                r2Key
            })
          );

        if (
          !object.Body
        ) {
          throw new Error(
            'R2 object is empty.'
          );
        }

        body =
          object.Body.transformToWebStream();

        contentType =
          object.ContentType ||
          contentType;

        contentLength =
          object.ContentLength;
      } catch (r2Error: any) {
        console.error(
          '[R2 DOWNLOAD ERROR]',
          {
            key: r2Key,
            mediaId: id,
            error:
              r2Error?.message
          }
        );

        return NextResponse.json(
          {
            error:
              `The media file could not be found in R2. Key: ${r2Key}`
          },
          {
            status: 404
          }
        );
      }
    }

    /* =====================================================
       FALLBACK
       EXTERNAL HTTPS URL
    ===================================================== */

    else {
      if (
        !/^https?:\/\//i.test(
          media.media_url
        )
      ) {
        return NextResponse.json(
          {
            error:
              'Media file is not available.'
          },
          {
            status: 404
          }
        );
      }

      const upstream =
        await fetch(
          media.media_url
        );

      if (
        !upstream.ok
      ) {
        return NextResponse.json(
          {
            error:
              'Could not download media.'
          },
          {
            status: 502
          }
        );
      }

      body =
        upstream.body;

      contentType =
        upstream.headers.get(
          'content-type'
        ) ||
        contentType;

      const length =
        upstream.headers.get(
          'content-length'
        );

      if (length) {
        const parsed =
          Number(length);

        if (
          Number.isFinite(
            parsed
          )
        ) {
          contentLength =
            parsed;
        }
      }
    }

    /* =====================================================
       BODY CHECK
    ===================================================== */

    if (!body) {
      throw new Error(
        'Download body is unavailable.'
      );
    }

    /* =====================================================
       FILE NAME
    ===================================================== */

    const extension =
      getExtension(
        media.media_url,
        media.kind
      );

    const filename =
      safeFilename(
        media.title ||
          'media'
      ) +
      extension;

    /* =====================================================
       RESPONSE
    ===================================================== */

    const headers =
      new Headers();

    headers.set(
      'Content-Type',
      contentType
    );

    headers.set(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    headers.set(
      'Cache-Control',
      'private, no-store'
    );

    if (
      contentLength !==
        undefined &&
      Number.isFinite(
        contentLength
      )
    ) {
      headers.set(
        'Content-Length',
        String(
          contentLength
        )
      );
    }

    return new Response(
      body,
      {
        status: 200,
        headers
      }
    );

  } catch (
    error: any
  ) {
    console.error(
      '[ADMIN MEDIA DOWNLOAD ERROR]',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Download failed.'
      },
      {
        status: 500
      }
    );
  }
}