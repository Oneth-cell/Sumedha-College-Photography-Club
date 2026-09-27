import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/postgres';

async function getOrCreateThread(userId: number) {
  const existing = await query(
    `
    SELECT *
    FROM chat_threads
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await query(
    `
    INSERT INTO chat_threads (user_id)
    VALUES ($1)
    RETURNING *
    `,
    [userId]
  );

  return created.rows[0];
}

export async function GET() {
  try {
    const s = await requireUser();

    const t =
      await getOrCreateThread(
        s.userId
      );

    if (!t) {
      return NextResponse.json(
        {
          error:
            'Could not create chat thread.',
        },
        {
          status: 500,
        }
      );
    }

    const messages =
      await query(
        `
        SELECT
          id,
          message,
          sender_role,
          created_at AS "createdAt"
        FROM chat_messages
        WHERE thread_id = $1
        ORDER BY created_at ASC
        `,
        [t.id]
      );

    return NextResponse.json({
      thread: t,
      messages: messages.rows,
    });
  } catch (error) {
    console.error(
      '[CHAT GET ERROR]',
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
    const s =
      await requireUser();

    const {
      message,
    } = await req.json();

    const text =
      String(message || '').trim();

    if (
      !text ||
      text.length > 2000
    ) {
      return NextResponse.json(
        {
          error:
            'Message must be 1–2000 characters.',
        },
        {
          status: 400,
        }
      );
    }

    const t =
      await getOrCreateThread(
        s.userId
      );

    if (!t) {
      return NextResponse.json(
        {
          error:
            'Could not create chat thread.',
        },
        {
          status: 500,
        }
      );
    }

    const result =
      await query(
        `
        INSERT INTO chat_messages (
          thread_id,
          sender_user_id,
          sender_role,
          message
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        RETURNING
          id,
          message,
          sender_role,
          created_at AS "createdAt"
        `,
        [
          t.id,
          s.userId,
          s.role,
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
      [t.id]
    );

    return NextResponse.json({
      ok: true,
      message:
        result.rows[0],
    });
  } catch (error) {
    console.error(
      '[CHAT POST ERROR]',
      error
    );

    return NextResponse.json(
      {
        error:
          'Could not send message.',
      },
      {
        status: 500,
      }
    );
  }
}