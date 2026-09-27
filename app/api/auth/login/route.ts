import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '@/lib/postgres';
import { sendEmail } from '@/lib/mailer';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const normalizedEmail = String(email || '')
      .toLowerCase()
      .trim();

    const submittedPassword = String(password || '');

    const envAdminEmail = String(
      process.env.ADMIN_EMAIL || ''
    )
      .toLowerCase()
      .trim();

    const envAdminPassword = String(
      process.env.ADMIN_PASSWORD || ''
    );

    let result = await query(
      `
      SELECT *
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [normalizedEmail]
    );

    let u = result.rows[0] as any;

    // ADMIN_EMAIL / ADMIN_PASSWORD are the documented
    // admin credentials. Keep the database record synchronized.
    if (
      normalizedEmail &&
      normalizedEmail === envAdminEmail &&
      envAdminPassword &&
      submittedPassword === envAdminPassword &&
      (!u || u.role === 'admin')
    ) {
      const passwordHash = await bcrypt.hash(
        envAdminPassword,
        12
      );

      if (!u) {
        const insertResult = await query(
          `
          INSERT INTO users (
            full_name,
            surname,
            email,
            student_id,
            grade,
            class_name,
            parent_phone,
            address,
            password_hash,
            role,
            status,
            membership_type
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, 'admin',
            'approved', 'board'
          )
          RETURNING *
          `,
          [
            'Sumedha College Photography Club Admin',
            'Admin',
            normalizedEmail,
            'ADMIN',
            'Staff',
            'Office',
            '',
            'Club Office',
            passwordHash,
          ]
        );

        u = insertResult.rows[0];
      } else {
        await query(
          `
          UPDATE users
          SET
            password_hash = $1,
            role = 'admin',
            status = 'approved',
            membership_type = 'board',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [passwordHash, u.id]
        );

        const updatedResult = await query(
          `
          SELECT *
          FROM users
          WHERE id = $1
          LIMIT 1
          `,
          [u.id]
        );

        u = updatedResult.rows[0];
      }
    }

    if (
      !u ||
      !(await bcrypt.compare(
        submittedPassword,
        u.password_hash || ''
      ))
    ) {
      return NextResponse.json(
        {
          error: 'Invalid email or password.',
        },
        {
          status: 401,
        }
      );
    }

    if (u.status === 'pending') {
      return NextResponse.json(
        {
          error:
            'Your registration is still waiting for admin approval.',
        },
        {
          status: 403,
        }
      );
    }

    if (u.status !== 'approved') {
      return NextResponse.json(
        {
          error: 'Your account is not active.',
        },
        {
          status: 403,
        }
      );
    }

    const code = String(
      crypto.randomInt(100000, 1000000)
    );

    const hash = await bcrypt.hash(code, 10);

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
        hash,
        Date.now() + 10 * 60 * 1000,
        u.id,
      ]
    );

    await sendEmail(
      u.email,
      'Your Sumedha Photography Club confirmation code',
      `<h2 style="font-family:Arial">${code}</h2>
       <p>This code expires in 10 minutes.</p>`
    );

    return NextResponse.json({
      ok: true,
      email: u.email,
    });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);

    return NextResponse.json(
      {
        error: 'Login failed.',
      },
      {
        status: 500,
      }
    );
  }
}