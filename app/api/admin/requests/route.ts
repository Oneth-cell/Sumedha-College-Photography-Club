import { NextResponse } from "next/server";
import db from "@/lib/db";
import {
  sendApprovalEmail,
  sendRejectionEmail
} from "@/lib/mailer";

export const dynamic = "force-dynamic";

type UserRow = Record<string, any>;


/* =========================================================
   GENERIC VALUE HELPER
========================================================= */

function getValue(
  user: UserRow,
  keys: string[],
  fallback = ""
): string {
  for (const key of keys) {
    const value = user[key];

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


/* =========================================================
   STUDENT NAME
========================================================= */

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


/* =========================================================
   SURNAME
========================================================= */

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


/* =========================================================
   STUDENT ID
========================================================= */

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


/* =========================================================
   GRADE
========================================================= */

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


/* =========================================================
   CLASS
========================================================= */

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


/* =========================================================
   PARENT / GUARDIAN PHONE
========================================================= */

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


/* =========================================================
   ADDRESS
========================================================= */

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


/* =========================================================
   PROFILE PICTURE
========================================================= */

function getProfilePicture(
  user: UserRow
): string | null {
  const value = getValue(
    user,
    [
      "pfp_path",
      "profile_picture",
      "profilePicture"
    ]
  );

  return value || null;
}


/* =========================================================
   FORMAT STUDENT
   IMPORTANT:
   password_hash is NEVER included.
========================================================= */

function formatStudent(
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

  const email =
    getValue(
      user,
      ["email"]
    );

  const membershipType =
    getValue(
      user,
      [
        "membership_type",
        "membershipType"
      ],
      "member"
    );

  const role =
    getValue(
      user,
      ["role"],
      "student"
    );

  const status =
    getValue(
      user,
      ["status"],
      "pending"
    ).toLowerCase();

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

    email,

    pfp_path:
      getProfilePicture(user),

    role,

    status,

    membershipType,
    membership_type:
      membershipType,

    created_at:
      user.created_at ?? null,

    updated_at:
      user.updated_at ?? null
  };
}


/* =========================================================
   GET PENDING REGISTRATION REQUESTS
========================================================= */

export async function GET() {
  try {
    const rows = db
      .prepare(`
        SELECT *
        FROM users
        WHERE LOWER(
          COALESCE(status, '')
        ) = 'pending'
        ORDER BY id DESC
      `)
      .all() as UserRow[];

    /*
     * Only the safe student information returned by
     * formatStudent() reaches the browser.
     *
     * password_hash is never returned.
     */

    const requests =
      rows.map(
        formatStudent
      );

    return NextResponse.json({
      ok: true,

      requests,

      pending: requests,

      pendingRequests: requests,

      data: requests,

      count:
        requests.length
    });

  } catch (error) {
    console.error(
      "ADMIN REQUESTS GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to load registration requests.",

        requests: [],

        pending: [],

        pendingRequests: [],

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
   APPROVE / REJECT REGISTRATION
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
        body.action ??
        body.status ??
        ""
      )
        .trim()
        .toLowerCase();

    const reason =
      String(
        body.reason ??
        body.rejectionReason ??
        body.rejection_reason ??
        ""
      ).trim();


    /* =====================================================
       VALIDATE ID
    ===================================================== */

    if (
      !id ||
      Number.isNaN(id)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid registration ID."
        },
        {
          status: 400
        }
      );
    }


    /* =====================================================
       NORMALIZE ACTION
    ===================================================== */

    const isApprove =
      action === "approve" ||
      action === "approved";

    const isReject =
      action === "reject" ||
      action === "rejected";


    if (
      !isApprove &&
      !isReject
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid action. Use "approve" or "reject".'
        },
        {
          status: 400
        }
      );
    }


    /* =====================================================
       FIND USER
    ===================================================== */

    const user =
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


    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Registration not found."
        },
        {
          status: 404
        }
      );
    }


    /* =====================================================
       ONLY PENDING USERS CAN BE PROCESSED
    ===================================================== */

    const currentStatus =
      String(
        user.status ??
        ""
      )
        .trim()
        .toLowerCase();

    if (
      currentStatus !==
      "pending"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `This registration has already been processed. Current status: ${currentStatus || "unknown"}.`
        },
        {
          status: 409
        }
      );
    }


    /* =====================================================
       FORMAT SAFE STUDENT DATA
    ===================================================== */

    const student =
      formatStudent(user);


    /* =====================================================
       VALIDATE EMAIL
    ===================================================== */

    if (
      !student.email ||
      !student.email.includes("@")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Student email address was not found."
        },
        {
          status: 400
        }
      );
    }


    /* =====================================================
       APPROVE
    ===================================================== */

    if (isApprove) {

      db.prepare(`
        UPDATE users
        SET
          status = 'approved'
        WHERE id = ?
      `).run(id);


      /*
       * Send approval email.
       *
       * Password is NOT sent.
       */

      try {

        await sendApprovalEmail({
          to:
            student.email,

          name:
            student.fullName,

          surname:
            student.surname,

          studentId:
            student.studentId,

          grade:
            student.grade,

          className:
            student.className,

          parentPhone:
            student.parentPhone,

          address:
            student.address,

          email:
            student.email,

          profilePicture:
            student.pfp_path
        });

      } catch (emailError) {

        /*
         * The student is already approved.
         * Email failure should not undo the database
         * approval.
         */

        console.error(
          "APPROVAL EMAIL ERROR:",
          emailError
        );
      }


      return NextResponse.json({
        ok: true,

        success: true,

        action:
          "approved",

        student,

        message:
          "Registration approved successfully."
      });
    }


    /* =====================================================
       REJECT
    ===================================================== */

    const finalReason =
      reason ||
      "Your membership request was not approved by the club administration.";


    db.prepare(`
      UPDATE users
      SET
        status = 'rejected'
      WHERE id = ?
    `).run(id);


    /*
     * Send branded rejection email.
     */

    try {

      await sendRejectionEmail({
        to:
          student.email,

        name:
          student.fullName,

        surname:
          student.surname,

        studentId:
          student.studentId,

        grade:
          student.grade,

        className:
          student.className,

        parentPhone:
          student.parentPhone,

        address:
          student.address,

        email:
          student.email,

        profilePicture:
          student.pfp_path,

        reason:
          finalReason
      });

    } catch (emailError) {

      /*
       * Rejection stays saved even if the
       * email provider fails.
       */

      console.error(
        "REJECTION EMAIL ERROR:",
        emailError
      );
    }


    return NextResponse.json({
      ok: true,

      success: true,

      action:
        "rejected",

      student,

      reason:
        finalReason,

      message:
        "Registration rejected successfully."
    });

  } catch (error) {

    console.error(
      "ADMIN REQUEST POST ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to process registration request."
      },
      {
        status: 500
      }
    );
  }
}