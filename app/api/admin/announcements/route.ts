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
        body,
        active,
        created_at AS "createdAt"
      FROM announcements
      ORDER BY created_at DESC
      `
    );

    return NextResponse.json({
      announcements: result.rows,
    });
  } catch (error) {
    console.error(
      '[ADMIN ANNOUNCEMENTS GET ERROR]',
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
      body,
      active,
    } = await req.json();

    const announcementId = Number(id);

    if (action === 'delete') {
      if (!Number.isFinite(announcementId)) {
        return NextResponse.json(
          {
            error: 'Invalid announcement ID.',
          },
          {
            status: 400,
          }
        );
      }

      await query(
        `
        DELETE FROM announcements
        WHERE id = $1
        `,
        [announcementId]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (action === 'toggle') {
      if (!Number.isFinite(announcementId)) {
        return NextResponse.json(
          {
            error: 'Invalid announcement ID.',
          },
          {
            status: 400,
          }
        );
      }

      await query(
        `
        UPDATE announcements
        SET
          active =
            CASE
              WHEN active = 1 THEN 0
              ELSE 1
            END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [announcementId]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (title && body) {
      await query(
        `
        INSERT INTO announcements (
          title,
          body,
          active
        )
        VALUES (
          $1,
          $2,
          $3
        )
        `,
        [
          String(title).trim(),
          String(body).trim(),
          active === false ? 0 : 1,
        ]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    return NextResponse.json(
      {
        error: 'Title and body required.',
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    console.error(
      '[ADMIN ANNOUNCEMENTS POST ERROR]',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }
}