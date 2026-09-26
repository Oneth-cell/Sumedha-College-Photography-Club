import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import db from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const action = String(body.action || "");
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    /* ======================================================
       RESET CODE TABLE
       ====================================================== */

    db.exec(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    /* ======================================================
       REQUEST RESET CODE
       ====================================================== */

    if (action === "request-code") {
      /*
       * IMPORTANT:
       * Your users table does not have a "name" column.
       * Only select columns that exist.
       */
      const user = db
        .prepare(
          `
          SELECT id, email
          FROM users
          WHERE lower(email) = ?
          LIMIT 1
          `
        )
        .get(email) as
        | {
            id: number;
            email: string;
          }
        | undefined;

      /*
       * Don't reveal whether an email exists.
       */
      if (!user) {
        return NextResponse.json({
          ok: true,
          message:
            "If an account exists for that email, a reset code has been sent.",
        });
      }

      /* Generate 6-digit code */
      const code = String(
        crypto.randomInt(100000, 1000000)
      );

      /* Hash the code before storing it */
      const codeHash = await bcrypt.hash(code, 10);

      /* 10 minute expiry */
      const expiresAt =
        Date.now() + 10 * 60 * 1000;

      /* Invalidate old codes */
      db.prepare(
        `
        UPDATE password_resets
        SET used = 1
        WHERE user_id = ?
        AND used = 0
        `
      ).run(user.id);

      /* Store new reset code */
      db.prepare(
        `
        INSERT INTO password_resets
        (
          user_id,
          email,
          code_hash,
          expires_at,
          used
        )
        VALUES (?, ?, ?, ?, 0)
        `
      ).run(
        user.id,
        user.email,
        codeHash,
        expiresAt
      );

      /*
       * We don't need a "name" column.
       * Use a simple safe display name.
       */
      const displayName =
        user.email.split("@")[0] || "Member";

      await sendPasswordResetEmail({
        to: user.email,
        name: displayName,
        code,
      });

      return NextResponse.json({
        ok: true,
        message:
          "A 6-digit password reset code has been sent to your email.",
      });
    }

    /* ======================================================
       VERIFY CODE
       ====================================================== */

    if (action === "verify-code") {
      const code = String(body.code || "").trim();

      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          {
            error:
              "Please enter the 6-digit verification code.",
          },
          { status: 400 }
        );
      }

      const reset = db
        .prepare(
          `
          SELECT *
          FROM password_resets
          WHERE lower(email) = ?
          AND used = 0
          ORDER BY id DESC
          LIMIT 1
          `
        )
        .get(email) as
        | {
            id: number;
            user_id: number;
            email: string;
            code_hash: string;
            expires_at: number;
            used: number;
          }
        | undefined;

      if (!reset) {
        return NextResponse.json(
          {
            error:
              "The verification code is invalid or has expired.",
          },
          { status: 400 }
        );
      }

      /* Check expiry */
      if (Date.now() > Number(reset.expires_at)) {
        db.prepare(
          `
          UPDATE password_resets
          SET used = 1
          WHERE id = ?
          `
        ).run(reset.id);

        return NextResponse.json(
          {
            error:
              "The verification code has expired. Request a new one.",
          },
          { status: 400 }
        );
      }

      /* Compare hashed code */
      const valid = await bcrypt.compare(
        code,
        reset.code_hash
      );

      if (!valid) {
        return NextResponse.json(
          {
            error:
              "The verification code is incorrect.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Code verified.",
      });
    }

    /* ======================================================
       RESET PASSWORD
       ====================================================== */

    if (action === "reset-password") {
      const code = String(body.code || "").trim();
      const password = String(body.password || "");

      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          {
            error: "Invalid verification code.",
          },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return NextResponse.json(
          {
            error:
              "Password must contain at least 8 characters.",
          },
          { status: 400 }
        );
      }

      const reset = db
        .prepare(
          `
          SELECT *
          FROM password_resets
          WHERE lower(email) = ?
          AND used = 0
          ORDER BY id DESC
          LIMIT 1
          `
        )
        .get(email) as
        | {
            id: number;
            user_id: number;
            email: string;
            code_hash: string;
            expires_at: number;
            used: number;
          }
        | undefined;

      if (!reset) {
        return NextResponse.json(
          {
            error:
              "The reset code is invalid or has expired.",
          },
          { status: 400 }
        );
      }

      /* Check expiry */
      if (Date.now() > Number(reset.expires_at)) {
        db.prepare(
          `
          UPDATE password_resets
          SET used = 1
          WHERE id = ?
          `
        ).run(reset.id);

        return NextResponse.json(
          {
            error:
              "The reset code has expired. Request a new one.",
          },
          { status: 400 }
        );
      }

      /* Check code */
      const valid = await bcrypt.compare(
        code,
        reset.code_hash
      );

      if (!valid) {
        return NextResponse.json(
          {
            error: "Invalid reset code.",
          },
          { status: 400 }
        );
      }

      /* Hash new password */
      const passwordHash = await bcrypt.hash(
        password,
        12
      );

      /* Update user's password */
      db.prepare(
        `
        UPDATE users
        SET password_hash = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `
      ).run(
        passwordHash,
        reset.user_id
      );

      /* Consume reset code */
      db.prepare(
        `
        UPDATE password_resets
        SET used = 1
        WHERE user_id = ?
        `
      ).run(reset.user_id);

      return NextResponse.json({
        ok: true,
        message:
          "Your password has been successfully updated.",
      });
    }

    return NextResponse.json(
      {
        error: "Invalid request.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Password reset failed. Please try again.",
      },
      { status: 500 }
    );
  }
}