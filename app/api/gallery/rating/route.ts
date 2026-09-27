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
    const rating = Number(body.rating);

    if (!Number.isInteger(mediaId) || mediaId <= 0) {
      return NextResponse.json(
        { error: 'Invalid media ID.' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5.' },
        { status: 400 }
      );
    }

    // Make sure the media is approved.
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

    /*
      media_ratings has no "id" column.

      Remove the user's previous rating first,
      then insert the new one.
    */
    await query(
      `
      DELETE FROM media_ratings
      WHERE media_id = $1
        AND user_id = $2
      `,
      [mediaId, user.userId]
    );

    await query(
      `
      INSERT INTO media_ratings (
        media_id,
        user_id,
        rating,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        CURRENT_TIMESTAMP::text
      )
      `,
      [mediaId, user.userId, rating]
    );

    // Calculate the current average and total.
    const statsResult = await query(
      `
      SELECT
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS average,
        COUNT(*)::int AS count
      FROM media_ratings
      WHERE media_id = $1
      `,
      [mediaId]
    );

    const average = Number(
      statsResult.rows[0]?.average || 0
    );

    const count = Number(
      statsResult.rows[0]?.count || 0
    );

    return NextResponse.json({
      ok: true,
      rating,
      average,
      ratings: count,
      count,
    });
  } catch (error) {
    console.error('[GALLERY RATING ERROR]', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not save rating.',
      },
      { status: 500 }
    );
  }
}