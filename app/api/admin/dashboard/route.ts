import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const [
      pendingRequests,
      pendingMedia,
      openChats,
      students,
      weeklyBest,
    ] = await Promise.all([
      query(
        `
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE status = 'pending'
        `
      ),

      query(
        `
        SELECT COUNT(*)::int AS count
        FROM media_items
        WHERE status = 'pending'
        `
      ),

      query(
        `
        SELECT COUNT(*)::int AS count
        FROM chat_threads
        WHERE status = 'open'
        `
      ),

      query(
        `
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE status = 'approved'
          AND role = 'student'
        `
      ),

      query(
        `
        SELECT COUNT(*)::int AS count
        FROM media_items
        WHERE status = 'approved'
          AND weekly_best = 1
        `
      ),
    ]);

    const metrics = {
      pendingRequests:
        pendingRequests.rows[0]?.count ?? 0,

      pendingMedia:
        pendingMedia.rows[0]?.count ?? 0,

      openChats:
        openChats.rows[0]?.count ?? 0,

      students:
        students.rows[0]?.count ?? 0,

      weeklyBest:
        weeklyBest.rows[0]?.count ?? 0,
    };

    return NextResponse.json({
      metrics,
    });
  } catch (error) {
    console.error(
      '[ADMIN DASHBOARD ERROR]',
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