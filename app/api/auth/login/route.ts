import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '@/lib/db';
import { sendEmail } from '@/lib/mailer';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const submittedPassword = String(password || '');
    const envAdminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const envAdminPassword = String(process.env.ADMIN_PASSWORD || '');

    let u = db.prepare('SELECT * FROM users WHERE email=?').get(normalizedEmail) as any;

    // ADMIN_EMAIL / ADMIN_PASSWORD are the documented admin credentials.
    // Keep the database record synchronized so the admin can log in even if seed was not run
    // or the env credentials changed after an earlier seed.
    if (
      normalizedEmail &&
      normalizedEmail === envAdminEmail &&
      envAdminPassword &&
      submittedPassword === envAdminPassword &&
      (!u || u.role === 'admin')
    ) {
      const passwordHash = await bcrypt.hash(envAdminPassword, 12);
      if (!u) {
        const info = db.prepare(`
          INSERT INTO users(
            full_name,surname,email,student_id,grade,class_name,parent_phone,address,
            password_hash,role,status,membership_type
          ) VALUES(?,?,?,?,?,?,?,?,?,'admin','approved','board')
        `).run(
          'Sumedha College Photography Club Admin',
          'Admin',
          normalizedEmail,
          'ADMIN',
          'Staff',
          'Office',
          '',
          'Club Office',
          passwordHash
        );
        u = db.prepare('SELECT * FROM users WHERE id=?').get(Number(info.lastInsertRowid)) as any;
      } else {
        db.prepare(`
          UPDATE users
          SET password_hash=?,role='admin',status='approved',membership_type='board',updated_at=CURRENT_TIMESTAMP
          WHERE id=?
        `).run(passwordHash, u.id);
        u = db.prepare('SELECT * FROM users WHERE id=?').get(u.id) as any;
      }
    }

    if (!u || !(await bcrypt.compare(submittedPassword, u.password_hash || ''))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }
    if (u.status === 'pending') {
      return NextResponse.json({ error: 'Your registration is still waiting for admin approval.' }, { status: 403 });
    }
    if (u.status !== 'approved') {
      return NextResponse.json({ error: 'Your account is not active.' }, { status: 403 });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const hash = await bcrypt.hash(code, 10);
    db.prepare(
      'UPDATE users SET verification_hash=?,verification_expires=?,updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(hash, Date.now() + 10 * 60 * 1000, u.id);

    await sendEmail(
      u.email,
      'Your Sumedha Photography Club confirmation code',
      `<h2 style="font-family:Arial">${code}</h2><p>This code expires in 10 minutes.</p>`
    );

    return NextResponse.json({ ok: true, email: u.email });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
}
