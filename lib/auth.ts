import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { query } from './postgres';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'change-me-development-secret'
);

export type Session = {
  userId: number;
  role: 'student' | 'admin';
  name: string;
  email: string;
};

export async function setSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  const jar = await cookies();

  jar.set('spc_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).delete('spc_session');
}

export async function getSession(): Promise<Session | null> {
  try {
    const token = (await cookies()).get('spc_session')?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, secret);

    const userId = Number(payload.userId);

    if (!Number.isFinite(userId)) {
      return null;
    }

    const result = await query<{
      id: number;
      full_name: string;
      email: string;
      role: 'student' | 'admin';
      status: string;
    }>(
      `
      SELECT id, full_name, email, role, status
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    const user = result.rows[0];

    if (!user || user.status !== 'approved') {
      return null;
    }

    return {
      userId: Number(user.id),
      role: user.role,
      name: user.full_name,
      email: user.email,
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();

  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  return session;
}

export async function requireAdmin() {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    throw new Error('UNAUTHORIZED');
  }

  return session;
}