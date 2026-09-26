import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

type UserRow = Record<string, any>;


/* =========================================================
   DATABASE HELPERS
========================================================= */

function tableExists(
  tableName: string
): boolean {
  const row = db
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
      LIMIT 1
    `)
    .get(tableName) as
    | { name?: string }
    | undefined;

  return Boolean(row?.name);
}


function columnExists(
  tableName: string,
  columnName: string
): boolean {
  if (!tableExists(tableName)) {
    return false;
  }

  const rows = db
    .prepare(
      `PRAGMA table_info(${tableName})`
    )
    .all() as Array<{
      name: string;
    }>;

  return rows.some(
    row => row.name === columnName
  );
}


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
      "name"
    ]
  );

  if (fullName) {
    return fullName;
  }

  const firstName = getValue(
    user,
    [
      "first_name",
      "firstName"
    ]
  );

  const surname = getValue(
    user,
    [
      "surname",
      "last_name",
      "lastName"
    ]
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
        char => char.toUpperCase()
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
      "lastName"
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
      "studentId"
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
      "grade_name"
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
      "student_class"
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
      "guardian_phone"
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
      "home_address"
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
      "membershipType"
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

    email:
      getValue(
        user,
        ["email"]
      ),

    pfp_path:
      getValue(
        user,
        [
          "pfp_path",
          "profile_picture",
          "profilePicture"
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

    boardPosition: ""
  };
}


/* =========================================================
   GET MEMBER DIRECTORY
========================================================= */

export async function GET() {
  try {
    if (!tableExists("users")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The users table does not exist."
        },
        {
          status: 500
        }
      );
    }

    /*
     * Only select columns that actually exist.
     * This prevents SQLite errors caused by optional
     * columns such as pfp_path or timestamps.
     */

    const possibleColumns = [
      "id",
      "full_name",
      "surname",
      "email",
      "student_id",
      "grade",
      "class_name",
      "parent_phone",
      "address",
      "role",
      "status",
      "membership_type",
      "pfp_path",
      "created_at",
      "updated_at"
    ];

    const selectedColumns =
      possibleColumns.filter(
        column =>
          column === "id" ||
          columnExists(
            "users",
            column
          )
      );

    const users = db
      .prepare(`
        SELECT ${selectedColumns.join(", ")}
        FROM users
        ORDER BY id DESC
      `)
      .all() as UserRow[];

    const formatted =
      users.map(
        formatUser
      );


    /* =====================================================
       BOARD POSITIONS
    ===================================================== */

    if (
      tableExists("board_roster")
    ) {

      /*
       * Newer schema:
       * board_roster.user_id
       */

      if (
        columnExists(
          "board_roster",
          "user_id"
        )
      ) {

        const boardColumns =
          ["user_id"];

        if (
          columnExists(
            "board_roster",
            "position"
          )
        ) {
          boardColumns.push(
            "position"
          );
        }

        const boardRows =
          db
            .prepare(`
              SELECT ${boardColumns.join(", ")}
              FROM board_roster
              WHERE user_id IS NOT NULL
            `)
            .all() as Array<{
              user_id: number;
              position?: string;
            }>;

        for (
          const user
          of formatted
        ) {

          const board =
            boardRows.find(
              row =>
                Number(
                  row.user_id
                ) ===
                Number(
                  user.id
                )
            );

          if (board) {
            user.boardPosition =
              board.position ||
              "";
          }
        }

      } else {

        /*
         * Current seed schema:
         * board_roster(position, person_name, display_order)
         *
         * There is no user_id, so match the roster
         * against the student's full name.
         */

        const boardRows =
          db
            .prepare(`
              SELECT
                position,
                person_name,
                display_order
              FROM board_roster
              ORDER BY display_order ASC
            `)
            .all() as Array<{
              position: string;
              person_name: string;
              display_order?: number;
            }>;

        for (
          const user
          of formatted
        ) {

          const userName =
            String(
              user.fullName
            )
              .trim()
              .toLowerCase();

          const board =
            boardRows.find(
              row =>
                String(
                  row.person_name ||
                  ""
                )
                  .trim()
                  .toLowerCase() ===
                userName
            );

          if (board) {
            user.boardPosition =
              board.position ||
              "";
          }
        }
      }
    }


    return NextResponse.json({
      ok: true,

      users: formatted,

      data: formatted,

      count:
        formatted.length
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

        count: 0
      },
      {
        status: 500
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
            "Invalid user ID."
        },
        {
          status: 400
        }
      );
    }


    /* =====================================================
       FIND USER
    ===================================================== */

    const existing =
      db
        .prepare(`
          SELECT *
          FROM users
          WHERE id = ?
          LIMIT 1
        `)
        .get(id) as
        | UserRow
        | undefined;


    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "User not found."
        },
        {
          status: 404
        }
      );
    }


    /* =====================================================
       DELETE USER
    ===================================================== */

    if (
      action === "delete"
    ) {

      const role =
        getValue(
          existing,
          ["role"],
          "student"
        ).toLowerCase();


      /*
       * Protect administrator accounts.
       */

      if (
        role === "admin"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Administrator accounts cannot be deleted from the member directory."
          },
          {
            status: 403
          }
        );
      }


      try {

        const deleteUser =
          db.transaction(
            (
              userId: number
            ) => {

              /*
               * Remove board relation.
               */

              if (
                tableExists(
                  "board_roster"
                )
              ) {

                if (
                  columnExists(
                    "board_roster",
                    "user_id"
                  )
                ) {

                  db.prepare(`
                    DELETE FROM board_roster
                    WHERE user_id = ?
                  `).run(userId);

                } else if (
                  columnExists(
                    "board_roster",
                    "person_name"
                  )
                ) {

                  const deletedUser =
                    db
                      .prepare(`
                        SELECT
                          full_name,
                          surname
                        FROM users
                        WHERE id = ?
                      `)
                      .get(userId) as
                      | {
                          full_name?: string;
                          surname?: string;
                        }
                      | undefined;

                  const personName =
                    `${deletedUser?.full_name || ""} ${deletedUser?.surname || ""}`
                      .trim();

                  if (personName) {
                    db.prepare(`
                      DELETE FROM board_roster
                      WHERE LOWER(person_name) = LOWER(?)
                    `).run(
                      personName
                    );
                  }
                }
              }


              /*
               * Chat messages
               */

              if (
                tableExists(
                  "chat_messages"
                ) &&
                columnExists(
                  "chat_messages",
                  "user_id"
                )
              ) {
                db.prepare(`
                  DELETE FROM chat_messages
                  WHERE user_id = ?
                `).run(userId);
              }


              /*
               * Chat threads
               */

              if (
                tableExists(
                  "chat_threads"
                ) &&
                columnExists(
                  "chat_threads",
                  "user_id"
                )
              ) {
                db.prepare(`
                  DELETE FROM chat_threads
                  WHERE user_id = ?
                `).run(userId);
              }


              /*
               * Onboarding
               */

              if (
                tableExists(
                  "onboarding"
                ) &&
                columnExists(
                  "onboarding",
                  "user_id"
                )
              ) {
                db.prepare(`
                  DELETE FROM onboarding
                  WHERE user_id = ?
                `).run(userId);
              }


              /*
               * Finally delete user.
               */

              const result =
                db
                  .prepare(`
                    DELETE FROM users
                    WHERE id = ?
                  `)
                  .run(userId);

              if (
                result.changes !== 1
              ) {
                throw new Error(
                  "User could not be deleted."
                );
              }
            }
          );

        deleteUser(id);

      } catch (deleteError) {

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
                : "Could not delete this user. Related records may still exist."
          },
          {
            status: 409
          }
        );
      }


      return NextResponse.json({
        ok: true,
        success: true,
        action: "delete",
        id,

        message:
          "User deleted successfully."
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
      "rejected"
    ];

    const validMembershipTypes = [
      "member",
      "board"
    ];


    if (
      !validStatuses.includes(
        status
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid status."
        },
        {
          status: 400
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
            "Invalid membership type."
        },
        {
          status: 400
        }
      );
    }


    /* =====================================================
       UPDATE USERS TABLE
    ===================================================== */

    db.prepare(`
      UPDATE users
      SET
        status = ?,
        membership_type = ?
      WHERE id = ?
    `).run(
      status,
      membershipType,
      id
    );


    /* =====================================================
       BOARD MANAGEMENT
    ===================================================== */

    if (
      tableExists(
        "board_roster"
      )
    ) {

      /*
       * ---------------------------------------------------
       * SCHEMA WITH user_id
       * ---------------------------------------------------
       */

      if (
        columnExists(
          "board_roster",
          "user_id"
        )
      ) {

        const existingBoard =
          db
            .prepare(`
              SELECT id
              FROM board_roster
              WHERE user_id = ?
              LIMIT 1
            `)
            .get(id) as
            | { id: number }
            | undefined;


        if (
          membershipType ===
            "board" &&
          boardPosition
        ) {

          const displayOrder =
            Number(
              body.displayOrder ??
              999
            );


          if (
            existingBoard
          ) {

            if (
              columnExists(
                "board_roster",
                "display_order"
              )
            ) {

              db.prepare(`
                UPDATE board_roster
                SET
                  position = ?,
                  person_name = ?,
                  display_order = ?
                WHERE id = ?
              `).run(
                boardPosition,
                getStudentName(
                  existing
                ),
                displayOrder,
                existingBoard.id
              );

            } else {

              db.prepare(`
                UPDATE board_roster
                SET
                  position = ?,
                  person_name = ?
                WHERE id = ?
              `).run(
                boardPosition,
                getStudentName(
                  existing
                ),
                existingBoard.id
              );
            }

          } else {

            if (
              columnExists(
                "board_roster",
                "display_order"
              )
            ) {

              db.prepare(`
                INSERT INTO board_roster
                (
                  position,
                  person_name,
                  user_id,
                  display_order
                )
                VALUES (?, ?, ?, ?)
              `).run(
                boardPosition,
                getStudentName(
                  existing
                ),
                id,
                displayOrder
              );

            } else {

              db.prepare(`
                INSERT INTO board_roster
                (
                  position,
                  person_name,
                  user_id
                )
                VALUES (?, ?, ?)
              `).run(
                boardPosition,
                getStudentName(
                  existing
                ),
                id
              );
            }
          }

        } else {

          /*
           * Student is a normal Member.
           * Remove existing Board link.
           */

          db.prepare(`
            DELETE FROM board_roster
            WHERE user_id = ?
          `).run(id);
        }


      } else {

        /*
         * ---------------------------------------------------
         * CURRENT PROJECT SCHEMA
         *
         * board_roster:
         * position
         * person_name
         * display_order
         * ---------------------------------------------------
         */

        const personName =
          getStudentName(
            existing
          );

        if (
          membershipType ===
            "board" &&
          boardPosition
        ) {

          /*
           * Check if this student already
           * exists in the roster.
           */

          const existingPerson =
            db
              .prepare(`
                SELECT id
                FROM board_roster
                WHERE LOWER(person_name)
                  = LOWER(?)
                LIMIT 1
              `)
              .get(personName) as
              | { id: number }
              | undefined;


          if (
            existingPerson
          ) {

            if (
              columnExists(
                "board_roster",
                "display_order"
              )
            ) {

              const displayOrder =
                Number(
                  body.displayOrder ??
                  999
                );

              db.prepare(`
                UPDATE board_roster
                SET
                  position = ?,
                  person_name = ?,
                  display_order = ?
                WHERE id = ?
              `).run(
                boardPosition,
                personName,
                displayOrder,
                existingPerson.id
              );

            } else {

              db.prepare(`
                UPDATE board_roster
                SET
                  position = ?,
                  person_name = ?
                WHERE id = ?
              `).run(
                boardPosition,
                personName,
                existingPerson.id
              );
            }

          } else {

            /*
             * Prevent two students from being assigned
             * the same board position.
             */

            const existingPosition =
              db
                .prepare(`
                  SELECT id
                  FROM board_roster
                  WHERE LOWER(position)
                    = LOWER(?)
                  LIMIT 1
                `)
                .get(
                  boardPosition
                ) as
                | { id: number }
                | undefined;


            if (
              existingPosition
            ) {

              if (
                columnExists(
                  "board_roster",
                  "display_order"
                )
              ) {

                const displayOrder =
                  Number(
                    body.displayOrder ??
                    999
                  );

                db.prepare(`
                  UPDATE board_roster
                  SET
                    position = ?,
                    person_name = ?,
                    display_order = ?
                  WHERE id = ?
                `).run(
                  boardPosition,
                  personName,
                  displayOrder,
                  existingPosition.id
                );

              } else {

                db.prepare(`
                  UPDATE board_roster
                  SET
                    position = ?,
                    person_name = ?
                  WHERE id = ?
                `).run(
                  boardPosition,
                  personName,
                  existingPosition.id
                );
              }

            } else {

              if (
                columnExists(
                  "board_roster",
                  "display_order"
                )
              ) {

                const displayOrder =
                  Number(
                    body.displayOrder ??
                    999
                  );

                db.prepare(`
                  INSERT INTO board_roster
                  (
                    position,
                    person_name,
                    display_order
                  )
                  VALUES (?, ?, ?)
                `).run(
                  boardPosition,
                  personName,
                  displayOrder
                );

              } else {

                db.prepare(`
                  INSERT INTO board_roster
                  (
                    position,
                    person_name
                  )
                  VALUES (?, ?)
                `).run(
                  boardPosition,
                  personName
                );
              }
            }
          }

        } else {

          /*
           * User changed from Board to Member.
           * Remove their board roster row.
           */

          db.prepare(`
            DELETE FROM board_roster
            WHERE LOWER(person_name)
              = LOWER(?)
          `).run(
            personName
          );
        }
      }
    }


    /* =====================================================
       RETURN UPDATED USER
    ===================================================== */

    const refreshed =
      db
        .prepare(`
          SELECT *
          FROM users
          WHERE id = ?
          LIMIT 1
        `)
        .get(id) as UserRow;


    const result =
      formatUser(
        refreshed
      );


    /*
     * Get the current board position.
     */

    if (
      tableExists(
        "board_roster"
      )
    ) {

      if (
        columnExists(
          "board_roster",
          "user_id"
        )
      ) {

        const row =
          db
            .prepare(`
              SELECT position
              FROM board_roster
              WHERE user_id = ?
              LIMIT 1
            `)
            .get(id) as
            | {
                position?: string;
              }
            | undefined;

        result.boardPosition =
          row?.position ||
          "";

      } else {

        const personName =
          getStudentName(
            refreshed
          );

        const row =
          db
            .prepare(`
              SELECT position
              FROM board_roster
              WHERE LOWER(person_name)
                = LOWER(?)
              LIMIT 1
            `)
            .get(personName) as
            | {
                position?: string;
              }
            | undefined;

        result.boardPosition =
          row?.position ||
          "";
      }
    }


    return NextResponse.json({
      ok: true,

      success: true,

      action:
        "update",

      user:
        result,

      message:
        "Member record updated successfully."
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
            : "Failed to update member."
      },
      {
        status: 500
      }
    );
  }
}