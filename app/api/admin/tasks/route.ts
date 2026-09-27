import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const result = await query(
      `
      SELECT *
      FROM tasks
      ORDER BY due_date ASC, id DESC
      `
    );

    return NextResponse.json({
      tasks: result.rows,
    });
  } catch (error) {
    console.error(
      '[ADMIN TASKS GET ERROR]',
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
      action,
      id,
      title,
      description,
      dueDate,
      uploadType,
    } = await req.json();

    const taskId = Number(id);

    if (action === 'delete') {
      if (!Number.isFinite(taskId)) {
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
        DELETE FROM tasks
        WHERE id = $1
        `,
        [taskId]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (
      !title ||
      !description ||
      !dueDate ||
      !['photo', 'video', 'both'].includes(
        uploadType
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Task title, description, due date and upload type are required.',
        },
        {
          status: 400,
        }
      );
    }

    if (Number.isFinite(taskId)) {
      await query(
        `
        UPDATE tasks
        SET
          title = $1,
          description = $2,
          due_date = $3,
          upload_type = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        `,
        [
          String(title).trim(),
          String(description).trim(),
          dueDate,
          uploadType,
          taskId,
        ]
      );
    } else {
      await query(
        `
        INSERT INTO tasks (
          title,
          description,
          due_date,
          upload_type
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        `,
        [
          String(title).trim(),
          String(description).trim(),
          dueDate,
          uploadType,
        ]
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error(
      '[ADMIN TASKS POST ERROR]',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }
}