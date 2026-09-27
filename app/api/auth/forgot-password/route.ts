import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { query } from "@/lib/postgres";
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
       REQUEST RESET CODE
       ====================================================== */

    if (action === "request-code") {
      /*
       * IMPORTANT:
       * Your users table does not have a "name" column.
       * Only select columns that exist.
       */
      const userResult = await query<{ id: number; email: string }>(
          `
          SELECT id, email
          FROM users
          WHERE lower(email) = lower(
          SELECT id, email
          FROM users
          WHERE lower(email) = ?
          LIMIT 1
          )
          LIMIT 1
          `,
          [email]
        );

        const user = userResult.rows[0] as
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
      await query(
        `
        UPDATE password_resets
        SET used = 1
        WHERE user_id = $1
        AND used = 0
        `,
        [user.id]
      );

      /* Store new reset code */
      await query(
        `
        INSERT INTO password_resets
        (
          user_id,
          email,
          code_hash,
          expires_at,
          used
        )
        VALUES ($1, $2, $3, $4, 0)
        `,
        [
          user.id,
          user.email,
          codeHash,
          expiresAt
        ]
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

      const resetResult = await query<{
        id: number;
        user_id: number;
        email: string;
        code_hash: string;
        expires_at: number;
        used: number;
      }>(
        `
        SELECT *
        FROM password_resets
        WHERE lower(email) = lower($1)
        AND used = 0
        ORDER BY id DESC
        LIMIT 1
        `,
        [email]
      );

      const reset = resetResult.rows[0] as
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
        await query(
          `
          UPDATE password_resets
          SET used = 1
          WHERE id = $1
          `,
          [reset.id]
        );

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

      const resetResult = await query<{
        id: number;
        user_id: number;
        email: string;
        code_hash: string;
        expires_at: number;
        used: number;
      }>(
        `
        SELECT *
        FROM password_resets
        WHERE lower(email) = lower($1)
        AND used = 0
        ORDER BY id DESC
        LIMIT 1
        `,
        [email]
      );

      const reset = resetResult.rows[0] as
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
        await query(
          `
          UPDATE password_resets
          SET used = 1
          WHERE id = $1
          `,
          [reset.id]
        );

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
      await query(
        `
        UPDATE users
        SET
          password_hash = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
          passwordHash,
          reset.user_id
        ]
      );

      /* Consume reset code */
      await query(
        `
        UPDATE password_resets
        SET used = 1
        WHERE user_id = $1
        `,
        [reset.user_id]
      );

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