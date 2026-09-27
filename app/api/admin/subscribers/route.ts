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
        email,
        created_at AS "createdAt"
      FROM subscribers
      ORDER BY created_at DESC
      `
    );

    return NextResponse.json({
      subscribers: result.rows,
    });
  } catch (error) {
    console.error(
      '[ADMIN SUBSCRIBERS GET ERROR]',
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
      id,
      action,
    } = await req.json();

    const subscriberId = Number(id);

    if (action === 'delete') {
      if (!Number.isFinite(subscriberId)) {
        return NextResponse.json(
          {
            error: 'Invalid subscriber ID.',
          },
          {
            status: 400,
          }
        );
      }

      await query(
        `
        DELETE FROM subscribers
        WHERE id = $1
        `,
        [subscriberId]
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      '[ADMIN SUBSCRIBERS POST ERROR]',
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