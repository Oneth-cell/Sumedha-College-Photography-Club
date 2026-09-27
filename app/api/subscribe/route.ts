import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    const e = String(email || '')
      .trim()
      .toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(e)) {
      return NextResponse.json(
        { error: 'Enter a valid email.' },
        { status: 400 }
      );
    }

    await query(
      `
      INSERT INTO subscribers (email)
      VALUES ($1)
      ON CONFLICT (email) DO NOTHING
      `,
      [e]
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error('[SUBSCRIBE ERROR]', error);

    return NextResponse.json(
      { error: 'Subscription failed.' },
      { status: 500 }
    );
  }
}