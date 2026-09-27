import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  GET
  Load visible comments for a media item.
*/
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mediaId = Number(url.searchParams.get('mediaId'));

    if (!Number.isInteger(mediaId) || mediaId <= 0) {
      return NextResponse.json(
        { error: 'Invalid media ID.' },
        { status: 400 }
      );
    }

    const result = await query(
      `
      SELECT
        mc.id,
        mc.media_id,
        mc.user_id,
        mc.body,
        mc.status,
        mc.created_at,
        COALESCE(
          NULLIF(u.full_name, ''),
          NULLIF(u.email, ''),
          'Member'
        ) AS author
      FROM media_comments mc
      LEFT JOIN users u
        ON u.id = mc.user_id
      WHERE mc.media_id = $1
        AND mc.status = 'visible'
      ORDER BY mc.created_at DESC, mc.id DESC
      `,
      [mediaId]
    );

    return NextResponse.json({
      ok: true,
      comments: result.rows,
    });
  } catch (error) {
    console.error('[GALLERY COMMENTS GET ERROR]', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load comments.',
      },
      { status: 500 }
    );
  }
}

/*
  POST
  Add a new comment.
*/
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = await req.json();

    const mediaId = Number(body.mediaId);
    const commentText = String(
      body.body ?? body.comment ?? ''
    ).trim();

    if (!Number.isInteger(mediaId) || mediaId <= 0) {
      return NextResponse.json(
        { error: 'Invalid media ID.' },
        { status: 400 }
      );
    }

    if (!commentText) {
      return NextResponse.json(
        { error: 'Comment cannot be empty.' },
        { status: 400 }
      );
    }

    if (commentText.length > 1000) {
      return NextResponse.json(
        { error: 'Comment must be 1000 characters or less.' },
        { status: 400 }
      );
    }

    // Only approved media can receive public comments.
    const mediaResult = await query(
      `
      SELECT id
      FROM media_items
      WHERE id = $1
        AND status = 'approved'
      LIMIT 1
      `,
      [mediaId]
    );

    if (!mediaResult.rows[0]) {
      return NextResponse.json(
        { error: 'Media not found or not approved.' },
        { status: 404 }
      );
    }

    // Insert into the correct table.
    const insertResult = await query(
      `
      INSERT INTO media_comments (
        media_id,
        user_id,
        body,
        status,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'visible',
        CURRENT_TIMESTAMP::text
      )
      RETURNING
        id,
        media_id,
        user_id,
        body,
        status,
        created_at
      `,
      [
        mediaId,
        user.userId,
        commentText,
      ]
    );

    const comment = insertResult.rows[0];

    // Get the author's name.
    const userResult = await query(
      `
      SELECT
        COALESCE(
          NULLIF(full_name, ''),
          NULLIF(email, ''),
          'Member'
        ) AS author
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [user.userId]
    );

    comment.author =
      userResult.rows[0]?.author || 'Member';

    return NextResponse.json(
      {
        ok: true,
        comment,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[GALLERY COMMENTS POST ERROR]', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not post comment.',
      },
      { status: 500 }
    );
  }
}