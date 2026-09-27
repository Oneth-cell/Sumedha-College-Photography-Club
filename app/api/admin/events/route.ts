import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const result = await query(
      `
      SELECT
        id,
        title,
        event_date AS date,
        location,
        description,
        trailer_url AS "trailerUrl",
        aftermovie_url AS "aftermovieUrl",
        album_url AS "albumUrl",
        cover_url AS "coverUrl"
      FROM events
      ORDER BY event_date DESC
      `
    );

    return NextResponse.json({
      events: result.rows,
    });
  } catch (error) {
    console.error(
      '[ADMIN EVENTS GET ERROR]',
      error
    );

    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const {
      action,
      id,
      title,
      date,
      location,
      description,
      trailerUrl,
      aftermovieUrl,
      albumUrl,
      coverUrl,
    } = await req.json();

    const eventId = Number(id);

    if (action === 'delete') {
      if (!Number.isFinite(eventId)) {
        return NextResponse.json(
          {
            error: 'Invalid event ID.',
          },
          {
            status: 400,
          }
        );
      }

      await query(
        `
        DELETE FROM events
        WHERE id = $1
        `,
        [eventId]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (
      !title ||
      !date ||
      !location ||
      !description
    ) {
      return NextResponse.json(
        {
          error:
            'Title, date, location and description are required.',
        },
        {
          status: 400,
        }
      );
    }

    if (Number.isFinite(eventId)) {
      await query(
        `
        UPDATE events
        SET
          title = $1,
          event_date = $2,
          location = $3,
          description = $4,
          trailer_url = $5,
          aftermovie_url = $6,
          album_url = $7,
          cover_url = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        `,
        [
          String(title).trim(),
          date,
          String(location).trim(),
          String(description).trim(),
          trailerUrl || null,
          aftermovieUrl || null,
          albumUrl || null,
          coverUrl || null,
          eventId,
        ]
      );
    } else {
      await query(
        `
        INSERT INTO events (
          title,
          event_date,
          location,
          description,
          trailer_url,
          aftermovie_url,
          album_url,
          cover_url
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
        `,
        [
          String(title).trim(),
          date,
          String(location).trim(),
          String(description).trim(),
          trailerUrl || null,
          aftermovieUrl || null,
          albumUrl || null,
          coverUrl || null,
        ]
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error(
      '[ADMIN EVENTS POST ERROR]',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }
}