import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();

  if (!s) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }

  try {
    const result = await query(
      `
      SELECT
        id,
        full_name,
        surname,
        email,
        grade,
        class_name,
        parent_phone,
        address,
        pfp_url,
        role,
        status,
        membership_type,
        board_position,
        lms_tour_seen
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [s.userId]
    );

    const u = result.rows[0];

    if (!u) {
      return NextResponse.json(
        {
          error: 'User not found.',
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      user: u,
      session: s,
    });
  } catch (error) {
    console.error(
      '[ME API ERROR]',
      error
    );

    return NextResponse.json(
      {
        error: 'Failed to load user.',
      },
      {
        status: 500,
      }
    );
  }
}