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
        key,
        value
      FROM settings
      ORDER BY key
      `
    );

    return NextResponse.json({
      settings: result.rows,
    });
  } catch (error) {
    console.error(
      '[ADMIN SETTINGS GET ERROR]',
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
      key,
      value,
    } = await req.json();

    const settingKey =
      String(key || '').trim();

    if (!settingKey) {
      return NextResponse.json(
        {
          error: 'Setting key required.',
        },
        {
          status: 400,
        }
      );
    }

    await query(
      `
      INSERT INTO settings (
        key,
        value
      )
      VALUES (
        $1,
        $2
      )
      ON CONFLICT (key)
      DO UPDATE SET
        value = EXCLUDED.value
      `,
      [
        settingKey,
        String(value ?? ''),
      ]
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      '[ADMIN SETTINGS POST ERROR]',
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