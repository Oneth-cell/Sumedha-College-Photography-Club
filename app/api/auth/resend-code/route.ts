import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '@/lib/postgres';
import { sendEmail } from '@/lib/mailer';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    const normalizedEmail = String(email || '')
      .toLowerCase()
      .trim();

    const result = await query(
      `
      SELECT id, email, status
      FROM users
      WHERE email = $1
        AND status = 'approved'
      LIMIT 1
      `,
      [normalizedEmail]
    );

    const u = result.rows[0] as any;

    if (!u) {
      return NextResponse.json(
        { error: 'Approved account not found.' },
        { status: 404 }
      );
    }

    const code = String(
      crypto.randomInt(100000, 1000000)
    );

    const codeHash = await bcrypt.hash(code, 10);

    await query(
      `
      UPDATE users
      SET
        verification_hash = $1,
        verification_expires = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      `,
      [
        codeHash,
        Date.now() + 600000,
        u.id,
      ]
    );

    await sendEmail(
      u.email,
      'New confirmation code',
      `<h2>${code}</h2><p>Expires in 10 minutes.</p>`
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error('[RESEND CODE ERROR]', error);

    return NextResponse.json(
      {
        error: 'Could not resend code.',
      },
      {
        status: 500,
      }
    );
  }
}