import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// GET: Load all comments for the Admin CRM
// Optional filter: ?mediaId=123
// ============================================================

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const mediaIdParam = url.searchParams.get('mediaId');

    let result;

    if (
      mediaIdParam !== null &&
      mediaIdParam.trim() !== ''
    ) {
      const mediaId = Number(mediaIdParam);

      if (!Number.isSafeInteger(mediaId) || mediaId <= 0) {
        return NextResponse.json(
          { error: 'Invalid media ID.', comments: [] },
          { status: 400 }
        );
      }

      result = await query(
        `
        SELECT
          mc.id,
          mc.media_id AS "mediaId",
          mc.user_id AS "userId",
          mc.body,
          COALESCE(mc.status, 'visible') AS status,
          mc.created_at AS "createdAt",
          COALESCE(
            NULLIF(
              TRIM(CONCAT(
                COALESCE(u.full_name, ''),
                CASE
                  WHEN COALESCE(u.surname, '') <> ''
                  THEN ' ' || u.surname
                  ELSE ''
                END
              )),
              ''
            ),
            NULLIF(u.email, ''),
            'Member'
          ) AS author
        FROM media_comments mc
        LEFT JOIN users u ON u.id = mc.user_id
        WHERE mc.media_id = $1
        ORDER BY mc.created_at DESC, mc.id DESC
        LIMIT 500
        `,
        [mediaId]
      );
    } else {
      result = await query(
        `
        SELECT
          mc.id,
          mc.media_id AS "mediaId",
          mc.user_id AS "userId",
          mc.body,
          COALESCE(mc.status, 'visible') AS status,
          mc.created_at AS "createdAt",
          COALESCE(
            NULLIF(
              TRIM(CONCAT(
                COALESCE(u.full_name, ''),
                CASE
                  WHEN COALESCE(u.surname, '') <> ''
                  THEN ' ' || u.surname
                  ELSE ''
                END
              )),
              ''
            ),
            NULLIF(u.email, ''),
            'Member'
          ) AS author
        FROM media_comments mc
        LEFT JOIN users u ON u.id = mc.user_id
        ORDER BY mc.created_at DESC, mc.id DESC
        LIMIT 500
        `
      );
    }

    return NextResponse.json({
      ok: true,
      comments: result.rows || [],
    });
  } catch (error) {
    console.error('[ADMIN COMMENTS GET ERROR]', error);

    return NextResponse.json(
      { error: 'Could not load admin comments.' },
      { status: 500 }
    );
  }
}

// ============================================================
// COMMENT MODERATION
// ============================================================

async function moderateComment(
  action: unknown,
  rawCommentId: unknown
) {
  const commentId = Number(rawCommentId);
  const normalizedAction = String(action ?? '').toLowerCase();

  // IMPORTANT: This is the COMMENT ID, not mediaId.
  if (
    rawCommentId === null ||
    rawCommentId === undefined ||
    String(rawCommentId).trim() === '' ||
    !Number.isSafeInteger(commentId) ||
    commentId <= 0
  ) {
    return NextResponse.json(
      { error: 'Invalid comment ID.' },
      { status: 400 }
    );
  }

  if (
    ['delete_comment', 'delete', 'remove_comment'].includes(
      normalizedAction
    )
  ) {
    const deleted = await query(
      `
      DELETE FROM media_comments
      WHERE id = $1
      RETURNING id
      `,
      [commentId]
    );

    if (!deleted.rows[0]) {
      return NextResponse.json(
        { error: 'Comment not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      action: 'deleted',
      commentId,
    });
  }

  let newStatus: string;

  if (
    ['hide_comment', 'hide'].includes(normalizedAction)
  ) {
    newStatus = 'hidden';
  } else if (
    [
      'show_comment',
      'unhide_comment',
      'restore_comment',
      'show',
      'unhide',
    ].includes(normalizedAction)
  ) {
    newStatus = 'visible';
  } else {
    return NextResponse.json(
      { error: 'Unknown comment action.' },
      { status: 400 }
    );
  }

  const updated = await query(
    `
    UPDATE media_comments
    SET status = $1
    WHERE id = $2
    RETURNING id, status
    `,
    [newStatus, commentId]
  );

  if (!updated.rows[0]) {
    return NextResponse.json(
      { error: 'Comment not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    action: newStatus === 'hidden' ? 'hidden' : 'visible',
    comment: updated.rows[0],
  });
}

// ============================================================
// POST: Hide, show or delete a comment
// ============================================================

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();

    return await moderateComment(
      body.action,
      body.commentId ?? body.id
    );
  } catch (error) {
    console.error('[ADMIN COMMENT ACTION ERROR]', error);

    return NextResponse.json(
      { error: 'Could not update comment.' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE: Delete a specific comment
// Accepts commentId in the query string
// ============================================================

export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);

    return await moderateComment(
      'delete_comment',
      url.searchParams.get('commentId')
    );
  } catch (error) {
    console.error('[ADMIN COMMENT DELETE ERROR]', error);

    return NextResponse.json(
      { error: 'Could not delete comment.' },
      { status: 500 }
    );
  }
}