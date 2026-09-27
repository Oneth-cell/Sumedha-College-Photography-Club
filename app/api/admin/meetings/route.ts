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
        start_time AS "startTime",
        zoom_url AS "zoomUrl",
        agenda
      FROM meetings
      ORDER BY start_time DESC
      `
    );

    return NextResponse.json({
      meetings: result.rows,
    });
  } catch (error) {
    console.error(
      '[ADMIN MEETINGS GET ERROR]',
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
      startTime,
      zoomUrl,
      agenda,
    } = await req.json();

    const meetingId = Number(id);

    if (action === 'delete') {
      if (!Number.isFinite(meetingId)) {
        return NextResponse.json(
          {
            error: 'Invalid meeting ID.',
          },
          {
            status: 400,
          }
        );
      }

      await query(
        `
        DELETE FROM meetings
        WHERE id = $1
        `,
        [meetingId]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (
      !title ||
      !startTime ||
      !zoomUrl
    ) {
      return NextResponse.json(
        {
          error:
            'Title, start time and Zoom URL are required.',
        },
        {
          status: 400,
        }
      );
    }

    if (Number.isFinite(meetingId)) {
      await query(
        `
        UPDATE meetings
        SET
          title = $1,
          start_time = $2,
          zoom_url = $3,
          agenda = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        `,
        [
          String(title).trim(),
          startTime,
          String(zoomUrl).trim(),
          String(agenda || ''),
          meetingId,
        ]
      );
    } else {
      await query(
        `
        INSERT INTO meetings (
          title,
          start_time,
          zoom_url,
          agenda
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        `,
        [
          String(title).trim(),
          startTime,
          String(zoomUrl).trim(),
          String(agenda || ''),
        ]
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error(
      '[ADMIN MEETINGS POST ERROR]',
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