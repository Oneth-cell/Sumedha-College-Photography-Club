import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { pool, query } from "@/lib/postgres";

export const dynamic = "force-dynamic";

type UserRow = Record<string, any>;

/* =========================================================
   VALUE HELPERS
========================================================= */

function getValue(
  row: UserRow,
  keys: string[],
  fallback = ""
): string {
  for (const key of keys) {
    const value = row[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return String(value).trim();
    }
  }

  return fallback;
}

function getStudentName(
  user: UserRow
): string {
  const fullName = getValue(
    user,
    [
      "full_name",
      "fullName",
      "student_name",
      "studentName",
      "display_name",
      "name",
    ]
  );

  if (fullName) {
    return fullName;
  }

  const firstName = getValue(
    user,
    ["first_name", "firstName"]
  );

  const surname = getValue(
    user,
    ["surname", "last_name", "lastName"]
  );

  const combined =
    `${firstName} ${surname}`.trim();

  if (combined) {
    return combined;
  }

  const email = getValue(
    user,
    ["email"]
  );

  if (email) {
    return email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(
        /\b\w/g,
        (char) => char.toUpperCase()
      );
  }

  return "Student";
}

function getSurname(
  user: UserRow
): string {
  return getValue(
    user,
    [
      "surname",
      "last_name",
      "lastName",
    ],
    "Not provided"
  );
}

function getStudentId(
  user: UserRow
): string {
  return getValue(
    user,
    [
      "student_id",
      "studentId",
    ],
    "Not provided"
  );
}

function getGrade(
  user: UserRow
): string {
  return getValue(
    user,
    [
      "grade",
      "student_grade",
      "grade_name",
    ],
    "Not provided"
  );
}

function getClassName(
  user: UserRow
): string {
  return getValue(
    user,
    [
      "class_name",
      "className",
      "class",
      "student_class",
    ],
    "Not provided"
  );
}

function getParentPhone(
  user: UserRow
): string {
  return getValue(
    user,
    [
      "parent_phone",
      "parentPhone",
      "parent_guardian_phone",
      "guardian_phone",
    ],
    "Not provided"
  );
}

function getAddress(
  user: UserRow
): string {
  return getValue(
    user,
    [
      "address",
      "home_address",
    ],
    "Not provided"
  );
}

function getMembershipType(
  user: UserRow
): string {
  return getValue(
    user,
    [
      "membership_type",
      "membershipType",
    ],
    "member"
  ).toLowerCase();
}

/* =========================================================
   FORMAT USER
   NEVER RETURN password_hash
========================================================= */

function formatUser(
  user: UserRow
) {
  const fullName =
    getStudentName(user);

  const surname =
    getSurname(user);

  const studentId =
    getStudentId(user);

  const grade =
    getGrade(user);

  const className =
    getClassName(user);

  const parentPhone =
    getParentPhone(user);

  const address =
    getAddress(user);

  const membershipType =
    getMembershipType(user);

  return {
    id: Number(user.id),

    fullName,
    full_name: fullName,

    surname,

    studentId,
    student_id: studentId,

    grade,

    className,
    class_name: className,

    parentPhone,
    parent_phone: parentPhone,

    address,

    email: getValue(
      user,
      ["email"]
    ),

    pfp_path:
      getValue(
        user,
        [
          "pfp_url",
          "pfp_path",
          "profile_picture",
          "profilePicture",
        ]
      ) || null,

    role:
      getValue(
        user,
        ["role"],
        "student"
      ).toLowerCase(),

    status:
      getValue(
        user,
        ["status"],
        "pending"
      ).toLowerCase(),

    membershipType,

    membership_type:
      membershipType,

    created_at:
      user.created_at ?? null,

    updated_at:
      user.updated_at ?? null,

    boardPosition: "",
  };
}

/* =========================================================
   GET MEMBER DIRECTORY
========================================================= */

export async function GET() {
  try {
    await requireAdmin();

    const usersResult =
      await query<UserRow>(
        `
        SELECT
          id,
          full_name,
          surname,
          email,
          student_id,
          grade,
          class_name,
          parent_phone,
          address,
          pfp_url,
          role,
          status,
          membership_type,
          board_position,
          board_order,
          verification_hash,
          verification_expires,
          lms_tour_seen,
          created_at,
          updated_at
        FROM users
        ORDER BY id DESC
        `
      );

    const users =
      usersResult.rows;

    const formatted =
      users.map(formatUser);

    /* =====================================================
       BOARD POSITIONS
    ===================================================== */

    const boardResult =
      await query<{
        user_id: number | string | null;
        position: string;
        person_name: string;
        display_order: number | string;
        active: number | string;
      }>(
        `
        SELECT
          user_id,
          position,
          person_name,
          display_order,
          active
        FROM board_roster
        WHERE active = 1
        ORDER BY display_order ASC
        `
      );

    const boardRows =
      boardResult.rows;

    for (
      const user of formatted
    ) {
      const board =
        boardRows.find(
          (row) =>
            row.user_id !== null &&
            Number(row.user_id) ===
              Number(user.id)
        );

      if (board) {
        user.boardPosition =
          board.position || "";
      } else {
        const userName =
          String(user.fullName)
            .trim()
            .toLowerCase();

        const nameMatch =
          boardRows.find(
            (row) =>
              String(
                row.person_name || ""
              )
                .trim()
                .toLowerCase() ===
              userName
          );

        if (nameMatch) {
          user.boardPosition =
            nameMatch.position || "";
        }
      }
    }

    return NextResponse.json({
      ok: true,

      users: formatted,

      data: formatted,

      count:
        formatted.length,
    });

  } catch (error) {
    console.error(
      "ADMIN USERS GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to load member directory.",

        users: [],

        data: [],

        count: 0,
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   UPDATE / DELETE USER
========================================================= */

export async function POST(
  req: Request
) {
  try {
    const admin =
      await requireAdmin();

    const body =
      await req.json();

    const id =
      Number(body.id);

    const action =
      String(
        body.action || ""
      )
        .trim()
        .toLowerCase();

    /* =====================================================
       VALIDATE USER ID
    ===================================================== */

    if (
      !id ||
      Number.isNaN(id)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid user ID.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       FIND USER
    ===================================================== */

    const existingResult =
      await query<UserRow>(
        `
        SELECT *
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

    const existing =
      existingResult.rows[0];

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    /* =====================================================
       DELETE USER
    ===================================================== */

    if (action === "delete") {

      const role =
        getValue(
          existing,
          ["role"],
          "student"
        ).toLowerCase();

      /*
       * Protect administrator accounts.
       */

      if (role === "admin") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Administrator accounts cannot be deleted from the member directory.",
          },
          {
            status: 403,
          }
        );
      }

      const client =
        await pool.connect();

      try {
        await client.query(
          "BEGIN"
        );

        /*
         * Remove board roster relation.
         */
        await client.query(
          `
          DELETE FROM board_roster
          WHERE user_id = $1
          `,
          [id]
        );

        /*
         * If an old name-based board row
         * exists, remove that too.
         */
        const personName =
          `${existing.full_name || ""} ${existing.surname || ""}`
            .trim();

        if (personName) {
          await client.query(
            `
            DELETE FROM board_roster
            WHERE LOWER(person_name) = LOWER($1)
            `,
            [personName]
          );
        }

        /*
         * Remove chat messages sent by the user.
         * PostgreSQL schema uses sender_user_id.
         */
        await client.query(
          `
          DELETE FROM chat_messages
          WHERE sender_user_id = $1
          `,
          [id]
        );

        /*
         * Remove the user's chat threads.
         */
        await client.query(
          `
          DELETE FROM chat_threads
          WHERE user_id = $1
          `,
          [id]
        );

        /*
         * Remove task progress.
         */
        await client.query(
          `
          DELETE FROM task_progress
          WHERE user_id = $1
          `,
          [id]
        );

        /*
         * Remove user's media-related records.
         */
        const mediaResult =
          await client.query<{
            id: number | string;
          }>(
            `
            SELECT id
            FROM media_items
            WHERE user_id = $1
            `,
            [id]
          );

        const mediaIds =
          mediaResult.rows.map(
            (row) =>
              Number(row.id)
          );

        if (mediaIds.length > 0) {
          await client.query(
            `
            DELETE FROM media_variants
            WHERE media_id = ANY($1::bigint[])
            `,
            [mediaIds]
          );

          await client.query(
            `
            DELETE FROM media_likes
            WHERE media_id = ANY($1::bigint[])
            `,
            [mediaIds]
          );

          await client.query(
            `
            DELETE FROM media_ratings
            WHERE media_id = ANY($1::bigint[])
            `,
            [mediaIds]
          );

          await client.query(
            `
            DELETE FROM media_comments
            WHERE media_id = ANY($1::bigint[])
            `,
            [mediaIds]
          );

          await client.query(
            `
            DELETE FROM media_items
            WHERE id = ANY($1::bigint[])
            `,
            [mediaIds]
          );
        }

        /*
         * Remove submissions owned by the user.
         */
        await client.query(
          `
          DELETE FROM submissions
          WHERE user_id = $1
          `,
          [id]
        );

        /*
         * Remove password reset records.
         */
        await client.query(
          `
          DELETE FROM password_resets
          WHERE user_id = $1
          `,
          [id]
        );

        /*
         * Audit logs should survive the account deletion,
         * but the actor reference is cleared.
         */
        await client.query(
          `
          UPDATE audit_logs
          SET actor_user_id = NULL
          WHERE actor_user_id = $1
          `,
          [id]
        );

        /*
         * Finally remove the user.
         */
        const deleteResult =
          await client.query(
            `
            DELETE FROM users
            WHERE id = $1
            `,
            [id]
          );

        if (
          deleteResult.rowCount !== 1
        ) {
          throw new Error(
            "User could not be deleted."
          );
        }

        await client.query(
          "COMMIT"
        );

      } catch (deleteError) {
        await client.query(
          "ROLLBACK"
        );

        console.error(
          "ADMIN USER DELETE ERROR:",
          deleteError
        );

        return NextResponse.json(
          {
            ok: false,
            error:
              deleteError instanceof Error
                ? deleteError.message
                : "Could not delete this user.",
          },
          {
            status: 409,
          }
        );

      } finally {
        client.release();
      }

      return NextResponse.json({
        ok: true,
        success: true,
        action: "delete",
        id,

        message:
          "User deleted successfully.",
      });
    }

    /* =====================================================
       UPDATE MEMBERSHIP
    ===================================================== */

    const status =
      String(
        body.status ??
          existing.status ??
          "approved"
      )
        .trim()
        .toLowerCase();

    const membershipType =
      String(
        body.membershipType ??
          body.membership_type ??
          existing.membership_type ??
          "member"
      )
        .trim()
        .toLowerCase();

    const boardPosition =
      String(
        body.boardPosition ??
          body.board_position ??
          ""
      ).trim();

    /* =====================================================
       VALIDATION
    ===================================================== */

    const validStatuses = [
      "approved",
      "pending",
      "suspended",
      "rejected",
    ];

    const validMembershipTypes = [
      "member",
      "board",
    ];

    if (
      !validStatuses.includes(status)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid status.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !validMembershipTypes.includes(
        membershipType
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid membership type.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       UPDATE USERS TABLE
    ===================================================== */

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      await client.query(
        `
        UPDATE users
        SET
          status = $1,
          membership_type = $2,
          board_position = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        `,
        [
          status,
          membershipType,
          boardPosition || null,
          id,
        ]
      );

      /* ===================================================
         BOARD MANAGEMENT
      =================================================== */

      const personName =
        getStudentName(existing);

      if (
        membershipType === "board" &&
        boardPosition
      ) {

        /*
         * Check whether this user already
         * has a board roster record.
         */
        const existingBoardResult =
          await client.query<{
            id: number | string;
          }>(
            `
            SELECT id
            FROM board_roster
            WHERE user_id = $1
            LIMIT 1
            `,
            [id]
          );

        const existingBoard =
          existingBoardResult.rows[0];

        /*
         * Check whether another board member
         * currently owns the selected position.
         */
        const existingPositionResult =
          await client.query<{
            id: number | string;
            user_id: number | string | null;
          }>(
            `
            SELECT id, user_id
            FROM board_roster
            WHERE LOWER(position) = LOWER($1)
            LIMIT 1
            `,
            [boardPosition]
          );

        const existingPosition =
          existingPositionResult.rows[0];

        const displayOrder =
          Number(
            body.displayOrder ?? 999
          );

        if (existingBoard) {

          /*
           * Update this user's existing row.
           */
          await client.query(
            `
            UPDATE board_roster
            SET
              position = $1,
              person_name = $2,
              display_order = $3,
              active = 1
            WHERE id = $4
            `,
            [
              boardPosition,
              personName,
              displayOrder,
              Number(existingBoard.id),
            ]
          );

          /*
           * If the chosen position belonged
           * to another row, remove that duplicate.
           */
          if (
            existingPosition &&
            Number(existingPosition.id) !==
              Number(existingBoard.id)
          ) {
            await client.query(
              `
              DELETE FROM board_roster
              WHERE id = $1
              `,
              [
                Number(
                  existingPosition.id
                ),
              ]
            );
          }

        } else if (
          existingPosition
        ) {

          /*
           * Reassign the existing position
           * to this user.
           */
          await client.query(
            `
            UPDATE board_roster
            SET
              user_id = $1,
              position = $2,
              person_name = $3,
              display_order = $4,
              active = 1
            WHERE id = $5
            `,
            [
              id,
              boardPosition,
              personName,
              displayOrder,
              Number(
                existingPosition.id
              ),
            ]
          );

        } else {

          /*
           * Create a new board roster row.
           */
          await client.query(
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
            `,
            [
              boardPosition,
              personName,
              id,
              displayOrder,
            ]
          );
        }

      } else {

        /*
         * User is no longer a board member.
         */
        await client.query(
          `
          DELETE FROM board_roster
          WHERE user_id = $1
          `,
          [id]
        );

        /*
         * Keep the users table consistent.
         */
        await client.query(
          `
          UPDATE users
          SET
            board_position = NULL,
            board_order = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          `,
          [id]
        );
      }

      await client.query(
        "COMMIT"
      );

    } catch (updateError) {

      await client.query(
        "ROLLBACK"
      );

      console.error(
        "ADMIN USER UPDATE ERROR:",
        updateError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            updateError instanceof Error
              ? updateError.message
              : "Failed to update member.",
        },
        {
          status: 409,
        }
      );

    } finally {
      client.release();
    }

    /* =====================================================
       RETURN UPDATED USER
    ===================================================== */

    const refreshedResult =
      await query<UserRow>(
        `
        SELECT *
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

    const refreshed =
      refreshedResult.rows[0];

    if (!refreshed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Updated user could not be loaded.",
        },
        {
          status: 500,
        }
      );
    }

    const result =
      formatUser(refreshed);

    /* =====================================================
       CURRENT BOARD POSITION
    ===================================================== */

    const boardPositionResult =
      await query<{
        position: string;
      }>(
        `
        SELECT position
        FROM board_roster
        WHERE user_id = $1
          AND active = 1
        LIMIT 1
        `,
        [id]
      );

    result.boardPosition =
      boardPositionResult.rows[0]
        ?.position || "";

    return NextResponse.json({
      ok: true,

      success: true,

      action:
        "update",

      user:
        result,

      message:
        "Member record updated successfully.",
    });

  } catch (error) {

    console.error(
      "ADMIN USERS POST ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to update member.",
      },
      {
        status: 500,
      }
    );
  }
}