import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = await req.json();
    const mediaId = Number(body.mediaId);

    if (!Number.isInteger(mediaId) || mediaId <= 0) {
      return NextResponse.json(
        { error: 'Invalid media ID.' },
        { status: 400 }
      );
    }

    // Make sure the media exists and has been approved.
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

    // media_likes has NO id column.
    // Check whether this user already liked this media.
    const existingResult = await query(
      `
      SELECT 1
      FROM media_likes
      WHERE media_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [mediaId, user.userId]
    );

    let liked: boolean;

    if (existingResult.rows.length > 0) {
      // Remove like
      await query(
        `
        DELETE FROM media_likes
        WHERE media_id = $1
          AND user_id = $2
        `,
        [mediaId, user.userId]
      );

      liked = false;
    } else {
      // Add like
      await query(
        `
        INSERT INTO media_likes (
          media_id,
          user_id
        )
        VALUES ($1, $2)
        `,
        [mediaId, user.userId]
      );

      liked = true;
    }

    // Get current total
    const countResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM media_likes
      WHERE media_id = $1
      `,
      [mediaId]
    );

    const likes = Number(countResult.rows[0]?.count || 0);

    return NextResponse.json({
      ok: true,
      liked,
      likes,
    });
  } catch (error) {
    console.error('[GALLERY LIKE ERROR]', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not process like.',
      },
      { status: 500 }
    );
  }
}