import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query, pool } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const result = await query(
      `
      SELECT *
      FROM board_roster
      ORDER BY display_order ASC
      `
    );

    return NextResponse.json({
      board: result.rows,
    });
  } catch (error) {
    console.error(
      '[ADMIN BOARD GET ERROR]',
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
    await requireAdmin();

    const {
      action,
      id,
      position,
      personName,
      userId,
      displayOrder,
      active,
    } = await req.json();

    const boardId = Number(id);
    const memberId =
      userId === null ||
      userId === undefined ||
      userId === ''
        ? null
        : Number(userId);

    const order = Number(
      displayOrder || 0
    );

    if (
      memberId !== null &&
      !Number.isFinite(memberId)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid user ID.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      displayOrder !== undefined &&
      !Number.isFinite(order)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid display order.',
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       DELETE BOARD MEMBER
    ===================================================== */

    if (action === 'delete') {
      if (!Number.isFinite(boardId)) {
        return NextResponse.json(
          {
            error:
              'Invalid board member ID.',
          },
          {
            status: 400,
          }
        );
      }

      const oldResult =
        await query<{
          user_id: number | null;
        }>(
          `
          SELECT user_id
          FROM board_roster
          WHERE id = $1
          LIMIT 1
          `,
          [boardId]
        );

      const old =
        oldResult.rows[0];

      const client =
        await pool.connect();

      try {
        await client.query(
          'BEGIN'
        );

        await client.query(
          `
          DELETE FROM board_roster
          WHERE id = $1
          `,
          [boardId]
        );

        if (
          old?.user_id !== null &&
          old?.user_id !== undefined
        ) {
          await client.query(
            `
            UPDATE users
            SET
              membership_type = 'member',
              board_position = NULL,
              board_order = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [Number(old.user_id)]
          );
        }

        await client.query(
          'COMMIT'
        );
      } catch (error) {
        await client.query(
          'ROLLBACK'
        );
        throw error;
      } finally {
        client.release();
      }

      return NextResponse.json({
        ok: true,
      });
    }

    /* =====================================================
       UPDATE EXISTING BOARD ENTRY
    ===================================================== */

    if (Number.isFinite(boardId)) {
      const client =
        await pool.connect();

      try {
        await client.query(
          'BEGIN'
        );

        const previousResult =
          await client.query<{
            user_id: number | null;
          }>(
            `
            SELECT user_id
            FROM board_roster
            WHERE id = $1
            LIMIT 1
            `,
            [boardId]
          );

        const previous =
          previousResult.rows[0];

        await client.query(
          `
          UPDATE board_roster
          SET
            position = $1,
            person_name = $2,
            user_id = $3,
            display_order = $4,
            active = $5
          WHERE id = $6
          `,
          [
            String(position || ''),
            String(personName || ''),
            memberId,
            order,
            active === false ? 0 : 1,
            boardId,
          ]
        );

        /*
         * If the old user is being replaced,
         * restore that user to normal membership.
         */
        if (
          previous?.user_id !== null &&
          previous?.user_id !== undefined &&
          Number(previous.user_id) !==
            memberId
        ) {
          await client.query(
            `
            UPDATE users
            SET
              membership_type = 'member',
              board_position = NULL,
              board_order = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [
              Number(
                previous.user_id
              ),
            ]
          );
        }

        /*
         * Synchronize the new user.
         */
        if (memberId !== null) {
          await client.query(
            `
            UPDATE users
            SET
              membership_type = 'board',
              board_position = $1,
              board_order = $2,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            `,
            [
              String(position || ''),
              order,
              memberId,
            ]
          );
        }

        await client.query(
          'COMMIT'
        );
      } catch (error) {
        await client.query(
          'ROLLBACK'
        );
        throw error;
      } finally {
        client.release();
      }

      return NextResponse.json({
        ok: true,
      });
    }

    /* =====================================================
       CREATE BOARD ENTRY
    ===================================================== */

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const insertResult =
        await client.query<{
          id: number;
        }>(
          `
          INSERT INTO board_roster
          (
            position,
            person_name,
            user_id,
            display_order,
            active
          )
          VALUES
          ($1, $2, $3, $4, 1)
          RETURNING id
          `,
          [
            String(position || ''),
            String(personName || ''),
            memberId,
            order,
          ]
        );

      if (memberId !== null) {
        await client.query(
          `
          UPDATE users
          SET
            membership_type = 'board',
            board_position = $1,
            board_order = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          `,
          [
            String(position || ''),
            order,
            memberId,
          ]
        );
      }

      await client.query(
        'COMMIT'
      );

      return NextResponse.json({
        ok: true,
        id:
          insertResult.rows[0]?.id
            ? Number(
                insertResult.rows[0].id
              )
            : null,
      });
    } catch (error) {
      await client.query(
        'ROLLBACK'
      );
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error(
      '[ADMIN BOARD POST ERROR]',
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