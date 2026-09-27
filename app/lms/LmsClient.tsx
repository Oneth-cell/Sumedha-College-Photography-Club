import { NextResponse } from "next/server";
import crypto from "crypto";

import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// R2 ENVIRONMENT
// ============================================================

const R2_ACCOUNT_ID =
  process.env.R2_ACCOUNT_ID;

const R2_ACCESS_KEY_ID =
  process.env.R2_ACCESS_KEY_ID;

const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY;

const R2_BUCKET_NAME =
  process.env.R2_BUCKET_NAME;

if (
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME
) {
  throw new Error(
    "R2 environment variables are missing"
  );
}

// ============================================================
// R2 CLIENT
// ============================================================

const r2 = new S3Client({
  region: "auto",

  endpoint:
    `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,

  credentials: {
    accessKeyId:
      R2_ACCESS_KEY_ID,

    secretAccessKey:
      R2_SECRET_ACCESS_KEY,
  },

  // Important:
  // Do not automatically add optional checksum
  // parameters to the presigned URL.
  requestChecksumCalculation:
    "WHEN_REQUIRED",

  responseChecksumValidation:
    "WHEN_REQUIRED",
});

// ============================================================
// ALLOWED FILE TYPES
// ============================================================

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

const ZIP_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

// ============================================================
// HELPERS
// ============================================================

function safeFilename(
  filename: string
): string {
  return filename
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(
      /[^\w.\- ()]/g,
      "_"
    )
    .replace(
      /\s+/g,
      "_"
    );
}

function safeFolder(
  folder: string
): string {
  return folder
    .replace(/\\/g, "/")
    .split("/")
    .filter(
      (part) =>
        part &&
        part !== "." &&
        part !== ".."
    )
    .map((part) =>
      part.replace(
        /[^\w.\-]/g,
        "_"
      )
    )
    .join("/");
}

// ============================================================
// POST
// ============================================================

export async function POST(
  req: Request
) {
  try {
    // --------------------------------------------------------
    // AUTHENTICATION
    // --------------------------------------------------------

    const session =
      await requireUser();

    if (!session?.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // --------------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------------

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON request.",
        },
        {
          status: 400,
        }
      );
    }

    const filename =
      String(
        body?.filename || ""
      ).trim();

    let contentType =
      String(
        body?.contentType || ""
      ).trim().toLowerCase();

    const folder =
      String(
        body?.folder ||
          "submissions"
      ).trim();

    // --------------------------------------------------------
    // VALIDATE FILENAME
    // --------------------------------------------------------

    if (!filename) {
      return NextResponse.json(
        {
          ok: false,
          error: "Filename is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      filename.length > 255
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Filename is too long.",
        },
        {
          status: 400,
        }
      );
    }

    const cleanFilename =
      safeFilename(filename);

    if (
      !cleanFilename ||
      cleanFilename === "."
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid filename.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // ZIP MIME TYPE
    // --------------------------------------------------------

    const lowerName =
      cleanFilename.toLowerCase();

    if (
      lowerName.endsWith(".zip")
    ) {
      // Browser sometimes sends:
      // application/zip
      // application/x-zip-compressed
      // or an empty / generic MIME type.
      //
      // R2 should receive application/zip.
      contentType =
        "application/zip";
    }

    // --------------------------------------------------------
    // VALIDATE FILE TYPE
    // --------------------------------------------------------

    const isImage =
      IMAGE_TYPES.has(
        contentType
      );

    const isVideo =
      VIDEO_TYPES.has(
        contentType
      );

    const isZip =
      lowerName.endsWith(".zip");

    if (
      !isImage &&
      !isVideo &&
      !isZip
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unsupported file type.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // SANITIZE FOLDER
    // --------------------------------------------------------

    const cleanFolder =
      safeFolder(
        folder ||
          "submissions"
      );

    if (!cleanFolder) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid upload folder.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // CREATE R2 KEY
    // --------------------------------------------------------

    const key =
      `${cleanFolder}/` +
      `${session.userId}/` +
      `${crypto.randomUUID()}-` +
      `${cleanFilename}`;

    // --------------------------------------------------------
    // CREATE PUT COMMAND
    // --------------------------------------------------------

    const command =
      new PutObjectCommand({
        Bucket:
          R2_BUCKET_NAME,

        Key:
          key,

        ContentType:
          contentType,

        // IMPORTANT:
        // Do not manually set checksum headers here.
      });

    // --------------------------------------------------------
    // CREATE PRESIGNED URL
    // --------------------------------------------------------

    const uploadUrl =
      await getSignedUrl(
        r2,
        command,
        {
          expiresIn: 3600,
        }
      );

    // --------------------------------------------------------
    // OPTIONAL PUBLIC URL
    // --------------------------------------------------------

    const publicBase =
      process.env.R2_PUBLIC_URL;

    const publicUrl =
      publicBase
        ? `${publicBase.replace(
            /\/+$/,
            ""
          )}/${key}`
        : null;

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return NextResponse.json(
      {
        ok: true,

        key,

        uploadUrl,

        publicUrl,

        contentType,
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(
      "R2 presign error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Could not create upload URL.",
      },
      {
        status: 500,
      }
    );
  }
}