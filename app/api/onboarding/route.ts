import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const s = await requireUser();

    const { tour } = await req.json();

    if (tour === 'lms') {
      await query(
        `
        UPDATE users
        SET
          lms_tour_seen = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [s.userId]
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      '[ONBOARDING ERROR]',
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