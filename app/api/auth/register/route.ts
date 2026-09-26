import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { sendEmail } from '@/lib/mailer';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let data: Record<string, string> = {};
    let pfp: File | null = null;

    // ------------------------------------------------------------
    // Read registration data
    // ------------------------------------------------------------
    if (contentType.startsWith('multipart/form-data')) {
      const form = await req.formData();

      for (const key of [
        'fullName',
        'surname',
        'studentId',
        'grade',
        'className',
        'parentPhone',
        'address',
        'email',
        'password',
      ]) {
        data[key] = String(form.get(key) || '').trim();
      }

      const uploaded = form.get('pfp');

      if (uploaded instanceof File && uploaded.size > 0) {
        pfp = uploaded;
      }
    } else {
      const json = await req.json();

      data = {
        fullName: String(json.fullName || '').trim(),
        surname: String(json.surname || '').trim(),
        studentId: String(json.studentId || '').trim(),
        grade: String(json.grade || '').trim(),
        className: String(json.className || '').trim(),
        parentPhone: String(json.parentPhone || '').trim(),
        address: String(json.address || '').trim(),
        email: String(json.email || '').trim(),
        password: String(json.password || ''),
      };
    }

    // ------------------------------------------------------------
    // Validate required fields
    // ------------------------------------------------------------
    const requiredFields = [
      'fullName',
      'surname',
      'grade',
      'className',
      'parentPhone',
      'address',
      'email',
      'password',
    ];

    const missingField = requiredFields.some((field) => !data[field]);

    if (missingField) {
      return NextResponse.json(
        {
          error: 'All required registration fields must be completed.',
        },
        { status: 400 }
      );
    }

    if (data.password.length < 8) {
      return NextResponse.json(
        {
          error: 'Password must be at least 8 characters.',
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------
    // Validate profile picture
    // ------------------------------------------------------------
    if (pfp) {
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
      ];

      if (!allowedTypes.includes(pfp.type)) {
        return NextResponse.json(
          {
            error:
              'Profile picture must be JPG, PNG or WEBP and 5 MB or less.',
          },
          { status: 400 }
        );
      }

      if (pfp.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          {
            error:
              'Profile picture must be JPG, PNG or WEBP and 5 MB or less.',
          },
          { status: 400 }
        );
      }
    }

    // ------------------------------------------------------------
    // Normalize email
    // ------------------------------------------------------------
    const email = data.email.toLowerCase();

    // ------------------------------------------------------------
    // Check existing account
    // ------------------------------------------------------------
    const existing = db
      .prepare('SELECT status FROM users WHERE email=?')
      .get(email) as { status?: string } | undefined;

    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.status === 'pending'
              ? 'Registration is already pending admin review.'
              : 'An account already exists for this email.',
        },
        { status: 409 }
      );
    }

    // ------------------------------------------------------------
    // Hash password
    // ------------------------------------------------------------
    const passwordHash = await bcrypt.hash(data.password, 12);

    // ------------------------------------------------------------
    // Create pending user
    // ------------------------------------------------------------
    const info = db
      .prepare(
        `
        INSERT INTO users(
          full_name,
          surname,
          email,
          student_id,
          grade,
          class_name,
          parent_phone,
          address,
          password_hash,
          status
        )
        VALUES(
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'pending'
        )
        `
      )
      .run(
        data.fullName,
        data.surname,
        email,
        data.studentId || null,
        data.grade,
        data.className,
        data.parentPhone,
        data.address,
        passwordHash
      );

    const userId = Number(info.lastInsertRowid);

    // ------------------------------------------------------------
    // Save profile picture
    // ------------------------------------------------------------
    let profilePictureUploaded = false;

    if (pfp) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const crypto = await import('crypto');

      const directory = path.join(
        process.cwd(),
        'public',
        'uploads',
        'profiles'
      );

      await fs.mkdir(directory, { recursive: true });

      const extension =
        pfp.type === 'image/png'
          ? 'png'
          : pfp.type === 'image/webp'
            ? 'webp'
            : 'jpg';

      const filename = `${userId}-${crypto.randomUUID()}.${extension}`;

      const filePath = path.join(directory, filename);

      await fs.writeFile(
        filePath,
        Buffer.from(await pfp.arrayBuffer())
      );

      db.prepare(
        `
        UPDATE users
        SET pfp_url=?,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=?
        `
      ).run(`/uploads/profiles/${filename}`, userId);

      profilePictureUploaded = true;
    }

    // ------------------------------------------------------------
    // ADMIN EMAIL
    // ------------------------------------------------------------
    // IMPORTANT:
    // Password and confirm password are intentionally NOT included.
    // ------------------------------------------------------------

    const adminEmail =
      process.env.ADMIN_EMAIL ||
      process.env.SMTP_USER ||
      '';

    if (!adminEmail) {
      console.error(
        'Registration created but ADMIN_EMAIL / SMTP_USER is not configured.'
      );
    } else {
      const displayName =
        `${data.fullName} ${data.surname}`.trim();

      const studentDetailsHtml = `
        <div style="
          font-family: Arial, Helvetica, sans-serif;
          max-width: 720px;
          margin: 0 auto;
          color: #111111;
          background: #ffffff;
          padding: 32px;
        ">

          <div style="
            border-bottom: 1px solid #dddddd;
            padding-bottom: 20px;
            margin-bottom: 26px;
          ">
            <div style="
              font-size: 12px;
              letter-spacing: 2px;
              text-transform: uppercase;
              color: #888888;
              margin-bottom: 8px;
            ">
              Sumedha College Photography Club
            </div>

            <h1 style="
              margin: 0;
              font-size: 28px;
              line-height: 1.2;
              color: #111111;
            ">
              New registration request
            </h1>

            <p style="
              margin: 10px 0 0;
              color: #666666;
              font-size: 15px;
            ">
              A new student has submitted a membership registration request.
            </p>
          </div>

          <div style="
            background: #f7f7f7;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
          ">
            <div style="
              font-size: 12px;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              color: #888888;
              margin-bottom: 7px;
            ">
              Applicant
            </div>

            <div style="
              font-size: 22px;
              font-weight: 700;
              color: #111111;
            ">
              ${escapeHtml(displayName)}
            </div>
          </div>

          <h2 style="
            font-size: 18px;
            margin: 0 0 14px;
            color: #111111;
          ">
            Student information
          </h2>

          <table style="
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            border: 1px solid #e1e1e1;
            border-radius: 10px;
            overflow: hidden;
          ">
            <tbody>

              <tr>
                <td style="
                  width: 34%;
                  padding: 13px;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e1e1e1;
                  font-weight: 600;
                ">
                  Full Name
                </td>

                <td style="
                  padding: 13px;
                  border-bottom: 1px solid #e1e1e1;
                ">
                  ${escapeHtml(data.fullName)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 13px;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e1e1e1;
                  font-weight: 600;
                ">
                  Surname
                </td>

                <td style="
                  padding: 13px;
                  border-bottom: 1px solid #e1e1e1;
                ">
                  ${escapeHtml(data.surname)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 13px;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e1e1e1;
                  font-weight: 600;
                ">
                  Student ID
                </td>

                <td style="
                  padding: 13px;
                  border-bottom: 1px solid #e1e1e1;
                ">
                  ${escapeHtml(data.studentId || 'Not provided')}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 13px;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e1e1e1;
                  font-weight: 600;
                ">
                  Grade
                </td>

                <td style="
                  padding: 13px;
                  border-bottom: 1px solid #e1e1e1;
                ">
                  ${escapeHtml(data.grade)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 13px;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e1e1e1;
                  font-weight: 600;
                ">
                  Class
                </td>

                <td style="
                  padding: 13px;
                  border-bottom: 1px solid #e1e1e1;
                ">
                  ${escapeHtml(data.className)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 13px;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e1e1e1;
                  font-weight: 600;
                ">
                  Parent / Guardian Phone
                </td>

                <td style="
                  padding: 13px;
                  border-bottom: 1px solid #e1e1e1;
                ">
                  ${escapeHtml(data.parentPhone)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 13px;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e1e1e1;
                  font-weight: 600;
                ">
                  Address
                </td>

                <td style="
                  padding: 13px;
                  border-bottom: 1px solid #e1e1e1;
                  white-space: pre-line;
                ">
                  ${escapeHtml(data.address)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 13px;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e1e1e1;
                  font-weight: 600;
                ">
                  Email
                </td>

                <td style="
                  padding: 13px;
                  border-bottom: 1px solid #e1e1e1;
                ">
                  ${escapeHtml(email)}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 13px;
                  background: #f5f5f5;
                  border-bottom: 1px solid #e1e1e1;
                  font-weight: 600;
                ">
                  Profile Picture
                </td>

                <td style="
                  padding: 13px;
                  border-bottom: 1px solid #e1e1e1;
                ">
                  ${profilePictureUploaded ? 'Uploaded' : 'Not uploaded'}
                </td>
              </tr>

              <tr>
                <td style="
                  padding: 13px;
                  background: #f5f5f5;
                  font-weight: 600;
                ">
                  Account Status
                </td>

                <td style="
                  padding: 13px;
                  font-weight: 700;
                ">
                  Pending Admin Approval
                </td>
              </tr>

            </tbody>
          </table>

          <div style="
            margin-top: 26px;
            padding: 16px 18px;
            border-left: 4px solid #111111;
            background: #f7f7f7;
            color: #555555;
            font-size: 13px;
            line-height: 1.6;
          ">
            <strong style="color:#111111;">
              Security note:
            </strong>
            The student's password and confirm-password value are never included
            in this notification email.
          </div>

          <div style="
            margin-top: 34px;
            padding-top: 18px;
            border-top: 1px solid #e5e5e5;
            color: #999999;
            font-size: 12px;
            line-height: 1.6;
          ">
            © 2026 Oneth Wickramaraachchi. All rights reserved.
          </div>

        </div>
      `;

      await sendEmail(
        adminEmail,
        `New registration request from ${displayName}`,
        studentDetailsHtml
      );
    }

    // ------------------------------------------------------------
    // Success response
    // ------------------------------------------------------------
    return NextResponse.json({
      ok: true,
      requestId: userId,
      status: 'pending',
    });

  } catch (error: any) {
    console.error('Registration error:', error);

    return NextResponse.json(
      {
        error: error?.message || 'Registration failed.',
      },
      { status: 500 }
    );
  }
}