import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId) {
    throw new Error("R2_ACCOUNT_ID is missing");
  }

  if (!accessKeyId) {
    throw new Error("R2_ACCESS_KEY_ID is missing");
  }

  if (!secretAccessKey) {
    throw new Error("R2_SECRET_ACCESS_KEY is missing");
  }

  if (!bucket) {
    throw new Error("R2_BUCKET_NAME is missing");
  }

  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
    bucket,
  };
}

export async function POST(req: Request) {
  try {
    // Make sure the user is logged in.
    const session = await requireUser();

    if (!session?.userId) {
      return NextResponse.json(
        { error: "You must be logged in to upload files." },
        { status: 401 }
      );
    }

    let body: {
      filename?: string;
      contentType?: string;
      folder?: string;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const filename = String(body.filename || "").trim();
    const suppliedContentType = String(
      body.contentType || ""
    )
      .trim()
      .toLowerCase();

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required." },
        { status: 400 }
      );
    }

    const lowerFilename = filename.toLowerCase();

    const isZip = lowerFilename.endsWith(".zip");

    const isImage = ALLOWED_IMAGE_TYPES.has(
      suppliedContentType
    );

    const isVideo = ALLOWED_VIDEO_TYPES.has(
      suppliedContentType
    );

    if (!isZip && !isImage && !isVideo) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${
            suppliedContentType || "unknown"
          }.`,
        },
        { status: 400 }
      );
    }

    const contentType = isZip
      ? "application/zip"
      : suppliedContentType;

    const folder = String(body.folder || "uploads")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "");

    const safeFilename =
      filename
        .replace(/\\/g, "/")
        .split("/")
        .pop()
        ?.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload";

    const { client, bucket } = getR2Client();

    const key = `${folder}/${session.userId}/${crypto.randomUUID()}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: 3600,
    });

    const publicBase = process.env.R2_PUBLIC_URL?.trim();

    const publicUrl = publicBase
      ? `${publicBase.replace(/\/+$/, "")}/${key}`
      : null;

    return NextResponse.json({
      ok: true,
      key,
      uploadUrl,
      publicUrl,
      contentType,
    });
  } catch (error) {
    console.error("[R2 PRESIGN ERROR]", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not create upload URL.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}