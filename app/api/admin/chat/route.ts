import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    await requireAdmin();

    const threadsResult = await query(
      `
      SELECT
        t.id,
        t.status,
        t.updated_at AS "updatedAt",
        u.full_name AS student,
        u.email
      FROM chat_threads t
      JOIN users u
        ON u.id = t.user_id
      ORDER BY t.updated_at DESC
      `
    );

    const messagesResult = await query(
      `
      SELECT
        m.id,
        m.thread_id AS "threadId",
        m.message,
        m.sender_role AS "senderRole",
        m.created_at AS "createdAt"
      FROM chat_messages m
      ORDER BY m.created_at ASC
      `
    );

    return NextResponse.json({
      threads: threadsResult.rows,
      messages: messagesResult.rows,
    });
  } catch (error) {
    console.error('[ADMIN CHAT GET ERROR]', error);

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
    const admin = await requireAdmin();

    const {
      threadId,
      message,
      close,
    } = await req.json();

    const id = Number(threadId);

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        {
          error: 'Invalid thread ID.',
        },
        {
          status: 400,
        }
      );
    }

    if (close) {
      await query(
        `
        UPDATE chat_threads
        SET
          status = 'closed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [id]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    const text = String(message || '').trim();

    if (!text) {
      return NextResponse.json(
        {
          error: 'Message required.',
        },
        {
          status: 400,
        }
      );
    }

    const threadResult = await query<{
      user_id: number;
    }>(
      `
      SELECT user_id
      FROM chat_threads
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const thread = threadResult.rows[0];

    if (!thread) {
      return NextResponse.json(
        {
          error: 'Thread not found.',
        },
        {
          status: 404,
        }
      );
    }

    const messageResult = await query<{
      id: number;
      message: string;
      sender_role: string;
      created_at: string;
    }>(
      `
      INSERT INTO chat_messages(
        thread_id,
        sender_user_id,
        sender_role,
        message
      )
      VALUES($1, $2, 'admin', $3)
      RETURNING
        id,
        message,
        sender_role,
        created_at
      `,
      [
        id,
        admin.userId,
        text,
      ]
    );

    await query(
      `
      UPDATE chat_threads
      SET
        status = 'open',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [id]
    );

    const inserted = messageResult.rows[0];

    return NextResponse.json({
      ok: true,
      message: inserted
        ? {
            id: Number(inserted.id),
            message: inserted.message,
            senderRole: inserted.sender_role,
            createdAt: inserted.created_at,
          }
        : null,
    });
  } catch (error) {
    console.error('[ADMIN CHAT POST ERROR]', error);

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