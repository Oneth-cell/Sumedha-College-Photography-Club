import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* =========================================================
   GET COMMENTS
========================================================= */

export async function GET(
  req: Request
) {
  try {
    const mediaId = Number(
      new URL(
        req.url
      ).searchParams.get(
        'mediaId'
      )
    );

    if (
      !Number.isInteger(
        mediaId
      ) ||
      mediaId <= 0
    ) {
      return NextResponse.json(
        {
          comments: [],
          error:
            'Invalid media ID.'
        },
        {
          status: 400
        }
      );
    }

    const result =
      await query(
        `
        SELECT
          c.id,
          c.body,
          c.created_at AS "createdAt",
          COALESCE(
            NULLIF(
              TRIM(
                CONCAT(
                  COALESCE(u.full_name, ''),
                  CASE
                    WHEN COALESCE(u.surname, '') <> ''
                    THEN ' ' || u.surname
                    ELSE ''
                  END
                )
              ),
              ''
            ),
            'Member'
          ) AS author
        FROM comments c
        LEFT JOIN users u
          ON u.id = c.user_id
        WHERE c.media_id = $1
          AND COALESCE(c.status, 'visible') <> 'hidden'
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT 100
        `,
        [mediaId]
      );

    return NextResponse.json(
      {
        comments:
          result.rows || []
      },
      {
        status: 200
      }
    );
  } catch (error: any) {
    console.error(
      '[GALLERY COMMENTS GET ERROR]',
      error
    );

    return NextResponse.json(
      {
        comments: [],
        error:
          error?.message ||
          'Could not load comments.'
      },
      {
        status: 500
      }
    );
  }
}

/* =========================================================
   POST COMMENT
========================================================= */

export async function POST(
  req: Request
) {
  try {
    const session =
      await requireUser();

    const body =
      await req.json();

    const mediaId =
      Number(
        body?.mediaId
      );

    const commentBody =
      String(
        body?.body || ''
      ).trim();

    if (
      !Number.isInteger(
        mediaId
      ) ||
      mediaId <= 0
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

    if (
      !commentBody
    ) {
      return NextResponse.json(
        {
          error:
            'Comment cannot be empty.'
        },
        {
          status: 400
        }
      );
    }

    if (
      commentBody.length >
      1000
    ) {
      return NextResponse.json(
        {
          error:
            'Comment is too long.'
        },
        {
          status: 400
        }
      );
    }

    const media =
      await query(
        `
        SELECT id
        FROM media_items
        WHERE id = $1
          AND status = 'approved'
        LIMIT 1
        `,
        [mediaId]
      );

    if (
      !media.rows.length
    ) {
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

    const inserted =
      await query(
        `
        INSERT INTO comments
          (
            media_id,
            user_id,
            body,
            status
          )
        VALUES
          (
            $1,
            $2,
            $3,
            'visible'
          )
        RETURNING
          id,
          body,
          created_at AS "createdAt"
        `,
        [
          mediaId,
          session.userId,
          commentBody
        ]
      );

    const row =
      inserted.rows[0];

    const user =
      await query(
        `
        SELECT
          COALESCE(
            NULLIF(
              TRIM(
                CONCAT(
                  COALESCE(full_name, ''),
                  CASE
                    WHEN COALESCE(surname, '') <> ''
                    THEN ' ' || surname
                    ELSE ''
                  END
                )
              ),
              ''
            ),
            'Member'
          ) AS author
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [session.userId]
      );

    return NextResponse.json(
      {
        comment: {
          ...row,
          author:
            user.rows[0]
              ?.author ||
            'Member'
        }
      },
      {
        status: 201
      }
    );
  } catch (error: any) {
    console.error(
      '[GALLERY COMMENTS POST ERROR]',
      error
    );

    const message =
      error?.message ||
      'Could not post comment.';

    if (
      message
        .toLowerCase()
        .includes('unauthorized')
    ) {
      return NextResponse.json(
        {
          error:
            'Please sign in to comment.'
        },
        {
          status: 401
        }
      );
    }

    return NextResponse.json(
      {
        error:
          message
      },
      {
        status: 500
      }
    );
  }
}