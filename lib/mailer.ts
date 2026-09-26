// lib/mailer.ts

import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

/* =========================================================
   SMTP CONFIGURATION
========================================================= */

const SMTP_HOST =
  process.env.SMTP_HOST || "smtp.gmail.com";

const SMTP_PORT = Number(
  process.env.SMTP_PORT || 587
);

const SMTP_USER =
  process.env.SMTP_USER || "";

const SMTP_PASS =
  process.env.SMTP_PASS || "";

const SMTP_FROM =
  process.env.SMTP_FROM ||
  SMTP_USER ||
  "scgphotographyclub@gmail.com";

/*
 * The administrator email that should receive
 * new registration notifications.
 *
 * Recommended:
 * ADMIN_EMAIL=your-admin-gmail@gmail.com
 *
 * If ADMIN_EMAIL is not configured, SMTP_USER
 * is used as the fallback recipient.
 */
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ||
  SMTP_USER;


/* =========================================================
   MAIL TRANSPORTER
========================================================= */

const transporter =
  nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,

    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });


/* =========================================================
   EMAIL LOGO
========================================================= */

/*
 * Put the actual club logo here:
 *
 * public/email-logo.png
 */

const logoPath = path.join(
  process.cwd(),
  "public",
  "email-logo.png"
);


function logoExists(): boolean {
  try {
    return fs.existsSync(
      logoPath
    );
  } catch {
    return false;
  }
}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
  value: unknown
): string {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   HTML -> PLAIN TEXT
========================================================= */

function stripHtml(
  html: string
): string {
  return String(
    html || ""
  )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ""
    )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ""
    )
    .replace(
      /<br\s*\/?>/gi,
      "\n"
    )
    .replace(
      /<\/p>/gi,
      "\n\n"
    )
    .replace(
      /<\/div>/gi,
      "\n"
    )
    .replace(
      /<\/h[1-6]>/gi,
      "\n"
    )
    .replace(
      /<[^>]+>/g,
      ""
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#039;/gi,
      "'"
    )
    .replace(
      /[ \t]{2,}/g,
      " "
    )
    .replace(
      /\n[ \t]+/g,
      "\n"
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}


/* =========================================================
   COMMON EMAIL TEMPLATE
========================================================= */

function emailTemplate(
  content: string
): string {

  const logoHtml =
    logoExists()

      ? `
        <img
          src="cid:sumedha-logo"
          alt="Sumedha College Photography Club"
          style="
            display:block;
            width:340px;
            max-width:85%;
            height:auto;
            margin:0 auto;
          "
        />
      `

      : `
        <div
          style="
            color:#ffffff;
            font-family:Arial,Helvetica,sans-serif;
            font-size:22px;
            font-weight:700;
            text-align:center;
          "
        >
          Sumedha College Photography Club
        </div>
      `;


  return `
<!DOCTYPE html>

<html lang="en">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width,initial-scale=1.0"
  >

  <title>
    Sumedha College Photography Club
  </title>

</head>


<body
  style="
    margin:0;
    padding:0;
    background:#ededed;
    font-family:Arial,Helvetica,sans-serif;
    color:#171717;
  "
>

  <div
    style="
      width:100%;
      background:#ededed;
      padding:34px 14px;
      box-sizing:border-box;
    "
  >

    <div
      style="
        width:100%;
        max-width:680px;
        margin:0 auto;
        background:#ffffff;
        border-radius:18px;
        overflow:hidden;
        box-shadow:0 15px 50px rgba(0,0,0,.10);
      "
    >

      <!-- HEADER -->

      <div
        style="
          background:#101010;
          padding:34px 22px;
          text-align:center;
        "
      >
        ${logoHtml}
      </div>


      <!-- BODY -->

      <div
        style="
          padding:42px 36px;
        "
      >
        ${content}
      </div>


      <!-- FOOTER -->

      <div
        style="
          background:#101010;
          padding:30px 20px;
          text-align:center;
        "
      >

        <div
          style="
            color:#ffffff;
            font-size:14px;
            font-weight:700;
            margin-bottom:9px;
          "
        >
          Sumedha College Photography Club
        </div>


        <div
          style="
            color:#858585;
            font-size:11px;
            line-height:1.6;
            margin-bottom:7px;
          "
        >
          © 2026 Oneth Wickramaarachchi
          All rights reserved.
        </div>


        <div
          style="
            color:#5f5f5f;
            font-size:10px;
          "
        >
          Official Club Communication
        </div>

      </div>

    </div>

  </div>

</body>

</html>
`;
}


/* =========================================================
   STUDENT INFORMATION TABLE
========================================================= */

function studentInformationTable({
  name,
  surname,
  studentId,
  grade,
  className,
  parentPhone,
  address,
  email,
  profilePicture,
}: {
  name?: string;
  surname?: string;
  studentId?: string;
  grade?: string;
  className?: string;
  parentPhone?: string;
  address?: string;
  email?: string;
  profilePicture?: string | null;
}): string {

  const rows = [
    [
      "Full Name",
      name || "Not provided"
    ],

    [
      "Surname",
      surname || "Not provided"
    ],

    [
      "Student ID",
      studentId || "Not provided"
    ],

    [
      "Grade",
      grade || "Not provided"
    ],

    [
      "Class",
      className || "Not provided"
    ],

    [
      "Parent / Guardian Phone",
      parentPhone || "Not provided"
    ],

    [
      "Address",
      address || "Not provided"
    ],

    [
      "Email",
      email || "Not provided"
    ],

    [
      "Profile Picture",
      profilePicture
        ? "Uploaded"
        : "Not uploaded"
    ],
  ];


  return `
    <div
      style="
        margin:25px 0;
        border:1px solid #e4e4e4;
        border-radius:12px;
        overflow:hidden;
        background:#fafafa;
      "
    >

      ${rows
        .map(
          ([label, value], index) => `
            <div
              style="
                border-bottom:${
                  index ===
                  rows.length - 1
                    ? "none"
                    : "1px solid #e7e7e7"
                };
              "
            >

              <div
                style="
                  padding:11px 14px;
                  background:#f3f3f3;
                  color:#666666;
                  font-size:12px;
                  font-weight:700;
                "
              >
                ${escapeHtml(label)}
              </div>


              <div
                style="
                  padding:11px 14px;
                  color:#222222;
                  font-size:13px;
                  line-height:1.6;
                  word-break:break-word;
                "
              >
                ${escapeHtml(value)}
              </div>

            </div>
          `
        )
        .join("")}

    </div>
  `;
}


/* =========================================================
   NORMALIZE EMAIL
========================================================= */

function normalizeEmailHtml(
  body: string
): string {

  const value =
    String(body || "").trim();


  if (!value) {

    return emailTemplate(`
      <p
        style="
          margin:0;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        This is an official communication from the
        Sumedha College Photography Club.
      </p>
    `);
  }


  if (
    value
      .toLowerCase()
      .includes("<!doctype html") ||
    value
      .toLowerCase()
      .includes("<html")
  ) {
    return value;
  }


  const containsHtml =
    /<([a-z][\s\S]*?)>/i.test(
      value
    );


  if (containsHtml) {
    return emailTemplate(
      value
    );
  }


  const paragraphs =
    value
      .split(/\r?\n/)
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean)
      .map(
        line => `
          <p
            style="
              margin:0 0 14px;
              font-size:15px;
              line-height:1.7;
              color:#4c4c4c;
            "
          >
            ${escapeHtml(line)}
          </p>
        `
      )
      .join("");


  return emailTemplate(
    paragraphs
  );
}


/* =========================================================
   GENERIC SEND EMAIL
========================================================= */

export async function sendEmail(
  to: string,
  subject: string,
  body: string
) {

  const html =
    normalizeEmailHtml(body);

  const text =
    stripHtml(html);


  const mailOptions: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;

    attachments?: Array<{
      filename: string;
      path: string;
      cid: string;
      contentDisposition:
        | "inline";
    }>;
  } = {

    from:
      `"Sumedha College Photography Club" <${SMTP_FROM}>`,

    to,

    subject,

    html,

    text,
  };


  /*
   * Add club logo as an inline CID attachment.
   */

  if (logoExists()) {

    mailOptions.attachments = [
      {
        filename:
          "sumedha-logo.png",

        path:
          logoPath,

        cid:
          "sumedha-logo",

        contentDisposition:
          "inline",
      },
    ];
  }


  await transporter.sendMail(
    mailOptions
  );
}


/* =========================================================
   OTP / LOGIN VERIFICATION EMAIL
========================================================= */

export async function sendOtpEmail({
  to,
  name,
  email,
  grade,
  className,
  code,
  surname,
  studentId,
  parentPhone,
  address,
  profilePicture,
}: {
  to: string;

  name?: string;

  email?: string;

  grade?: string;

  className?: string;

  code: string;

  surname?: string;

  studentId?: string;

  parentPhone?: string;

  address?: string;

  profilePicture?: string | null;
}) {

  const safeName =
    escapeHtml(
      name || "Member"
    );

  const safeCode =
    escapeHtml(code);


  const html =
    emailTemplate(`

      <h1
        style="
          margin:0 0 18px;
          font-size:29px;
          line-height:1.2;
          color:#111111;
          font-weight:700;
        "
      >
        Your verification code
      </h1>


      <p
        style="
          margin:0 0 14px;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        Hello

        <strong
          style="
            color:#111111;
          "
        >
          ${safeName}
        </strong>,
      </p>


      <p
        style="
          margin:0 0 14px;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        Use the verification code below to continue
        signing in to the Sumedha College Photography
        Club portal.
      </p>


      <div
        style="
          margin:26px 0;
          padding:24px 18px;
          background:#111111;
          border-radius:14px;
          text-align:center;
        "
      >

        <div
          style="
            color:#999999;
            font-size:11px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:10px;
          "
        >
          6-Digit Verification Code
        </div>


        <div
          style="
            color:#ffffff;
            font-size:36px;
            line-height:1;
            font-weight:700;
            letter-spacing:8px;
          "
        >
          ${safeCode}
        </div>

      </div>


      <h2
        style="
          margin:28px 0 12px;
          font-size:18px;
          color:#111111;
        "
      >
        Account Information
      </h2>


      ${studentInformationTable({
        name,
        surname,
        studentId,
        grade,
        className,
        parentPhone,
        address,
        email:
          email || to,
        profilePicture,
      })}


      <div
        style="
          margin:22px 0;
          padding:17px 19px;
          border-left:4px solid #c9a85f;
          background:#faf7ef;
          border-radius:8px;
        "
      >

        <p
          style="
            margin:0;
            color:#4d4637;
            font-size:14px;
            line-height:1.6;
          "
        >
          This verification code expires in
          <strong>
            10 minutes
          </strong>.
        </p>

      </div>


      <p
        style="
          margin:0;
          color:#808080;
          font-size:12px;
          line-height:1.6;
        "
      >
        If you did not attempt to sign in, you can
        safely ignore this email.
      </p>

    `);


  await sendEmail(
    to,
    "Your Sumedha Photography Club verification code",
    html
  );
}


/* =========================================================
   NEW REGISTRATION -> ADMIN EMAIL
========================================================= */

/*
 * This email is sent to ADMIN_EMAIL.
 *
 * It contains:
 *
 * Full Name
 * Surname
 * Student ID
 * Grade
 * Class
 * Parent / Guardian Phone
 * Address
 * Email
 * Profile Picture status
 *
 * IMPORTANT:
 *
 * Password and Confirm Password are NEVER
 * included in this email.
 */

export async function sendRegistrationAdminEmail({
  to,
  name,
  email,
  grade,
  className,
  surname,
  studentId,
  parentPhone,
  address,
  profilePicture,
}: {
  to: string;

  name: string;

  email: string;

  grade: string;

  className: string;

  surname?: string;

  studentId?: string;

  parentPhone?: string;

  address?: string;

  profilePicture?: string | null;
}) {

  /*
   * Create the subject dynamically.
   *
   * Example:
   *
   * New registration request from
   * Asela Wickramarachchi
   */

  const displayName =
    `${name || ""} ${
      surname || ""
    }`.trim() ||
    "Student";


  const safeDisplayName =
    escapeHtml(
      displayName
    );


  const html =
    emailTemplate(`

      <!-- TITLE -->

      <h1
        style="
          margin:0 0 18px;
          font-size:29px;
          line-height:1.2;
          color:#111111;
          font-weight:700;
        "
      >
        New registration request
      </h1>


      <!-- INTRO -->

      <p
        style="
          margin:0 0 14px;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        A new student has submitted a registration
        request to the
        <strong style="color:#111111;">
          Sumedha College Photography Club
        </strong>.
      </p>


      <!-- STUDENT NAME -->

      <div
        style="
          margin:24px 0;
          padding:18px 20px;
          background:#111111;
          border-radius:14px;
        "
      >

        <div
          style="
            color:#999999;
            font-size:10px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:8px;
          "
        >
          Student
        </div>


        <div
          style="
            color:#ffffff;
            font-size:22px;
            line-height:1.3;
            font-weight:700;
          "
        >
          ${safeDisplayName}
        </div>

      </div>


      <!-- STUDENT INFORMATION -->

      <h2
        style="
          margin:28px 0 12px;
          font-size:18px;
          color:#111111;
        "
      >
        Complete Registration Information
      </h2>


      ${studentInformationTable({
        name,
        surname,
        studentId,
        grade,
        className,
        parentPhone,
        address,
        email,
        profilePicture,
      })}


      <!-- STATUS -->

      <div
        style="
          margin:22px 0;
          padding:18px 20px;
          border-left:4px solid #c9a85f;
          background:#faf7ef;
          border-radius:8px;
        "
      >

        <p
          style="
            margin:0 0 5px;
            color:#4d4637;
            font-size:13px;
            font-weight:700;
          "
        >
          Registration status
        </p>


        <p
          style="
            margin:0;
            color:#4d4637;
            font-size:14px;
            line-height:1.6;
          "
        >
          Pending Admin Approval
        </p>

      </div>


      <!-- SECURITY -->

      <div
        style="
          margin:22px 0;
          padding:17px 19px;
          border:1px solid #e4e4e4;
          background:#f8f8f8;
          border-radius:8px;
        "
      >

        <p
          style="
            margin:0;
            color:#666666;
            font-size:12px;
            line-height:1.7;
          "
        >
          <strong style="color:#333333;">
            Security:
          </strong>

          The student's password and confirm-password
          fields are intentionally excluded from this
          notification.
        </p>

      </div>


      <!-- ADMIN ACTION -->

      <p
        style="
          margin:0;
          font-size:14px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        Please review the registration in the
        Photography Club Admin CRM and approve or
        reject the request.
      </p>

    `);


  /*
   * Send to the configured admin address.
   *
   * The function accepts `to`, so your registration
   * API can pass ADMIN_EMAIL explicitly.
   */

  await sendEmail(
    to,
    `New registration request from ${displayName}`,
    html
  );
}


/* =========================================================
   APPROVAL EMAIL
========================================================= */

export async function sendApprovalEmail({
  to,
  name,
  surname = "",
  studentId = "",
  grade = "",
  className = "",
  parentPhone = "",
  address = "",
  email = to,
  profilePicture = null,
}: {
  to: string;

  name: string;

  surname?: string;

  studentId?: string;

  grade?: string;

  className?: string;

  parentPhone?: string;

  address?: string;

  email?: string;

  profilePicture?: string | null;
}) {

  const html =
    emailTemplate(`

      <h1
        style="
          margin:0 0 18px;
          font-size:29px;
          line-height:1.2;
          color:#111111;
          font-weight:700;
        "
      >
        Registration approved
      </h1>


      <p
        style="
          margin:0 0 14px;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        Hello

        <strong
          style="
            color:#111111;
          "
        >
          ${escapeHtml(name)}
        </strong>,
      </p>


      <p
        style="
          margin:0 0 18px;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        Your registration for the

        <strong
          style="
            color:#111111;
          "
        >
          Sumedha College Photography Club
        </strong>

        has been approved by the club administration.
      </p>


      <h2
        style="
          margin:28px 0 12px;
          font-size:18px;
          color:#111111;
        "
      >
        Student Information
      </h2>


      ${studentInformationTable({
        name,
        surname,
        studentId,
        grade,
        className,
        parentPhone,
        address,
        email,
        profilePicture,
      })}


      <div
        style="
          margin:22px 0;
          padding:18px 20px;
          border-left:4px solid #c9a85f;
          background:#faf7ef;
          border-radius:8px;
        "
      >

        <p
          style="
            margin:0;
            color:#4d4637;
            font-size:14px;
            line-height:1.6;
          "
        >
          Your account is now active.
          You can sign in using your registered
          email and password.
        </p>

      </div>


      <p
        style="
          margin:0;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        After signing in, you will receive a
        <strong
          style="color:#111111;"
        >
          6-digit verification code
        </strong>
        to complete the login process.
      </p>


      <p
        style="
          margin:20px 0 0;
          color:#808080;
          font-size:12px;
          line-height:1.6;
        "
      >
        Welcome to the Sumedha College Photography Club.
      </p>

    `);


  await sendEmail(
    to,
    "Your Sumedha Photography Club registration has been approved",
    html
  );
}


/* =========================================================
   REJECTION EMAIL
========================================================= */

export async function sendRejectionEmail({
  to,
  name,
  surname = "",
  studentId = "",
  grade = "",
  className = "",
  parentPhone = "",
  address = "",
  email = to,
  profilePicture = null,
  reason = "",
}: {
  to: string;

  name: string;

  surname?: string;

  studentId?: string;

  grade?: string;

  className?: string;

  parentPhone?: string;

  address?: string;

  email?: string;

  profilePicture?: string | null;

  reason?: string;
}) {

  const finalReason =
    reason ||
    "Your membership request was not approved by the club administration.";


  const html =
    emailTemplate(`

      <h1
        style="
          margin:0 0 18px;
          font-size:29px;
          line-height:1.2;
          color:#111111;
          font-weight:700;
        "
      >
        Membership request update
      </h1>


      <p
        style="
          margin:0 0 14px;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        Hello

        <strong
          style="
            color:#111111;
          "
        >
          ${escapeHtml(name)}
        </strong>,
      </p>


      <p
        style="
          margin:0 0 18px;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        We are writing regarding your membership request
        for the

        <strong
          style="
            color:#111111;
          "
        >
          Sumedha College Photography Club
        </strong>.
      </p>


      <h2
        style="
          margin:28px 0 12px;
          font-size:18px;
          color:#111111;
        "
      >
        Registration Information
      </h2>


      ${studentInformationTable({
        name,
        surname,
        studentId,
        grade,
        className,
        parentPhone,
        address,
        email,
        profilePicture,
      })}


      <div
        style="
          margin:24px 0;
          padding:20px;
          border-left:4px solid #b86f6f;
          background:#fbf4f4;
          border-radius:8px;
        "
      >

        <p
          style="
            margin:0 0 8px;
            color:#5a2f2f;
            font-size:14px;
            font-weight:700;
          "
        >
          Membership request declined
        </p>


        <p
          style="
            margin:0;
            color:#684444;
            font-size:14px;
            line-height:1.7;
          "
        >
          ${escapeHtml(
            finalReason
          )}
        </p>

      </div>


      <p
        style="
          margin:0;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        If you believe this decision was made in error,
        please contact the Photography Club administration.
      </p>


      <p
        style="
          margin:20px 0 0;
          color:#808080;
          font-size:12px;
          line-height:1.6;
        "
      >
        This is an official communication from the
        Sumedha College Photography Club.
      </p>

    `);


  await sendEmail(
    to,
    "Sumedha Photography Club membership rejected",
    html
  );
}


/* =========================================================
   PASSWORD RESET EMAIL
========================================================= */

export async function sendPasswordResetEmail({
  to,
  name,
  code,
}: {
  to: string;

  name: string;

  code: string;
}) {

  const html =
    emailTemplate(`

      <h1
        style="
          margin:0 0 18px;
          font-size:29px;
          line-height:1.2;
          color:#111111;
          font-weight:700;
        "
      >
        Password reset code
      </h1>


      <p
        style="
          margin:0 0 14px;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        Hello

        <strong
          style="
            color:#111111;
          "
        >
          ${escapeHtml(name)}
        </strong>,
      </p>


      <p
        style="
          margin:0 0 14px;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        A password reset request was made for your
        Sumedha College Photography Club account.
      </p>


      <div
        style="
          margin:26px 0;
          padding:24px 18px;
          background:#111111;
          border-radius:14px;
          text-align:center;
        "
      >

        <div
          style="
            color:#999999;
            font-size:11px;
            letter-spacing:2px;
            text-transform:uppercase;
            margin-bottom:10px;
          "
        >
          Password Reset Code
        </div>


        <div
          style="
            color:#ffffff;
            font-size:36px;
            line-height:1;
            font-weight:700;
            letter-spacing:8px;
          "
        >
          ${escapeHtml(code)}
        </div>

      </div>


      <div
        style="
          margin:22px 0;
          padding:17px 19px;
          border-left:4px solid #c9a85f;
          background:#faf7ef;
          border-radius:8px;
        "
      >

        <p
          style="
            margin:0;
            color:#4d4637;
            font-size:14px;
            line-height:1.6;
          "
        >
          This code expires in
          <strong>
            10 minutes
          </strong>.
        </p>

      </div>


      <p
        style="
          margin:0;
          font-size:15px;
          line-height:1.7;
          color:#4c4c4c;
        "
      >
        Enter this code on the password reset page
        to create your new password.
      </p>


      <p
        style="
          margin:20px 0 0;
          color:#808080;
          font-size:12px;
          line-height:1.6;
        "
      >
        If you did not request a password reset,
        please ignore this email.
      </p>

    `);


  await sendEmail(
    to,
    "Your Sumedha Photography Club password reset code",
    html
  );
}


/* =========================================================
   VERIFY SMTP CONNECTION
========================================================= */

export async function verifyMailerConnection() {

  try {

    await transporter.verify();

    console.log(
      "Sumedha College Photography Club mail server connection successful."
    );

    return true;

  } catch (error) {

    console.error(
      "Sumedha College Photography Club mail server connection failed:"
    );

    console.error(
      error
    );

    return false;
  }
}