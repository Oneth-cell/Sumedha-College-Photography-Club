import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const s = await requireUser();

    const result = await query(
      `
      SELECT
        t.*,
        COALESCE(tp.done, 0) AS done
      FROM tasks t
      LEFT JOIN task_progress tp
        ON tp.task_id = t.id
       AND tp.user_id = $1
      ORDER BY t.due_date ASC, t.id DESC
      `,
      [s.userId]
    );

    return NextResponse.json({
      tasks: result.rows,
    });
  } catch (error) {
    console.error(
      '[TASKS GET ERROR]',
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

export async function POST(
  req: Request
) {
  try {
    const s = await requireUser();

    const {
      taskId,
      done,
    } = await req.json();

    const id = Number(taskId);

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        {
          error: 'Invalid task ID.',
        },
        {
          status: 400,
        }
      );
    }

    await query(
      `
      INSERT INTO task_progress (
        user_id,
        task_id,
        done
      )
      VALUES (
        $1,
        $2,
        $3
      )
      ON CONFLICT (
        user_id,
        task_id
      )
      DO UPDATE SET
        done = EXCLUDED.done
      `,
      [
        s.userId,
        id,
        done ? 1 : 0,
      ]
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      '[TASKS POST ERROR]',
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