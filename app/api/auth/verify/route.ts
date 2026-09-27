import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/postgres';
import { setSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    const normalizedEmail = String(email || '')
      .toLowerCase()
      .trim();

    const result = await query(
      `
      SELECT *
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [normalizedEmail]
    );

    const u = result.rows[0] as any;

    if (
      !u ||
      u.status !== 'approved' ||
      !u.verification_hash ||
      Number(u.verification_expires) < Date.now()
    ) {
      return NextResponse.json(
        {
          error: 'Code expired or invalid.',
        },
        {
          status: 400,
        }
      );
    }

    const valid = await bcrypt.compare(
      String(code || ''),
      u.verification_hash
    );

    if (!valid) {
      return NextResponse.json(
        {
          error: 'Incorrect confirmation code.',
        },
        {
          status: 400,
        }
      );
    }

    await query(
      `
      UPDATE users
      SET
        verification_hash = NULL,
        verification_expires = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [u.id]
    );

    await setSession({
      userId: Number(u.id),
      role: u.role,
      name: u.full_name,
      email: u.email,
    });

    return NextResponse.json({
      ok: true,
      redirect:
        u.role === 'admin'
          ? '/admin'
          : '/lms',
    });
  } catch (error) {
    console.error(
      '[VERIFY ERROR]',
      error
    );

    return NextResponse.json(
      {
        error: 'Verification failed.',
      },
      {
        status: 500,
      }
    );
  }
}