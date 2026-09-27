
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import Busboy from "busboy";
import unzipper from "unzipper";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

export const MAX_ZIP_BYTES = 5 * 1024 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;

const imageExts = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
]);

const videoExts = new Set([
  "mp4",
  "mov",
  "m4v",
  "webm",
]);

/*
|--------------------------------------------------------------------------
| Cloudflare R2
|--------------------------------------------------------------------------
*/

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

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

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

export function extOf(name: string): string {
  return (
    name.split(".").pop() || ""
  ).toLowerCase();
}

export function mediaKind(
  name: string
): "image" | "video" | null {
  const ext = extOf(name);

  if (imageExts.has(ext)) {
    return "image";
  }

  if (videoExts.has(ext)) {
    return "video";
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Parse ZIP upload
|--------------------------------------------------------------------------
*/

export async function parseUpload(req: Request) {
  const contentType =
    req.headers.get("content-type") || "";

  if (
    !contentType.startsWith(
      "multipart/form-data"
    )
  ) {
    throw new Error(
      "multipart/form-data required"
    );
  }

  if (!req.body) {
    throw new Error(
      "Upload body missing"
    );
  }

  const bb = Busboy({
    headers: {
      "content-type": contentType,
    },
    limits: {
      files: 1,
      fields: 10,
      fileSize: MAX_ZIP_BYTES + 1,
    },
  });

  /*
   * IMPORTANT:
   * This is only temporary processing storage.
   * Final files are uploaded to R2.
   */
  const tmpDir = path.join(
    "/tmp",
    "photography-club-uploads"
  );

  await fsp.mkdir(tmpDir, {
    recursive: true,
  });

  let filePath = "";
  let fileName = "";
  let tooLarge = false;

  const fields: Record<
    string,
    string
  > = {};

  const completion =
    new Promise<void>(
      (resolve, reject) => {
        let filePipeline:
          | Promise<void>
          | null = null;

        bb.on(
          "field",
          (
            name: string,
            value: string
          ) => {
            fields[name] = value;
          }
        );

        bb.on(
          "file",
          (
            _fieldName,
            file,
            info
          ) => {
            fileName =
              info.filename ||
              "submission.zip";

            const safeName =
              `${Date.now()}-${crypto.randomUUID()}.zip`;

            filePath = path.join(
              tmpDir,
              safeName
            );

            const out =
              fs.createWriteStream(
                filePath
              );

            file.on("limit", () => {
              tooLarge = true;
            });

            filePipeline = pipeline(
              file,
              out
            ).catch((error) => {
              if (!tooLarge) {
                throw error;
              }
            });
          }
        );

        bb.on(
          "error",
          reject
        );

        bb.on(
          "finish",
          async () => {
            try {
              if (filePipeline) {
                await filePipeline;
              }

              resolve();
            } catch (error) {
              reject(error);
            }
          }
        );
      }
    );

  await pipeline(
    Readable.fromWeb(
      req.body as any
    ),
    bb
  );

  await completion;

  if (tooLarge) {
    if (filePath) {
      await fsp.rm(
        filePath,
        {
          force: true,
        }
      );
    }

    throw new Error(
      "ZIP exceeds the 5 GB maximum."
    );
  }

  if (!filePath) {
    throw new Error(
      "ZIP file is required."
    );
  }

  const stat =
    await fsp.stat(filePath);

  if (
    stat.size >
    MAX_ZIP_BYTES
  ) {
    await fsp.rm(
      filePath,
      {
        force: true,
      }
    );

    throw new Error(
      "ZIP exceeds the 5 GB maximum."
    );
  }

  if (
    extOf(fileName) !==
    "zip"
  ) {
    await fsp.rm(
      filePath,
      {
        force: true,
      }
    );

    throw new Error(
      "Only .zip submissions are accepted."
    );
  }

  return {
    fields,
    filePath,
    fileSize: stat.size,
  };
}

/*
|--------------------------------------------------------------------------
| Inspect and extract ZIP
|--------------------------------------------------------------------------
*/

export async function inspectAndExtractZip(
  zipPath: string,
  destRoot: string,
  uploadType:
    | "photo"
    | "video"
    | "both"
) {
  const directory =
    await unzipper.Open.file(
      zipPath
    );

  const files: Array<{
    entry: any;
    kind:
      | "image"
      | "video";
    path: string;
    size: number;
  }> = [];

  for (
    const entry of
    directory.files
  ) {
    if (
      entry.type !==
      "File"
    ) {
      continue;
    }

    const clean =
      String(entry.path)
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

    if (
      clean.startsWith("/") ||
      clean
        .split("/")
        .includes("..")
    ) {
      throw new Error(
        "ZIP contains an unsafe file path."
      );
    }

    const kind =
      mediaKind(clean);

    if (!kind) {
      throw new Error(
        `Unsupported file inside ZIP: ${clean}`
      );
    }

    if (
      uploadType === "photo" &&
      kind !== "image"
    ) {
      throw new Error(
        "This task accepts photos only."
      );
    }

    if (
      uploadType === "video" &&
      kind !== "video"
    ) {
      throw new Error(
        "This task accepts videos only."
      );
    }

    const size = Number(
      entry.uncompressedSize ||
        0
    );

    if (
      kind === "image" &&
      size > MAX_PHOTO_BYTES
    ) {
      throw new Error(
        `Photo must be 50 MB or less: ${clean}`
      );
    }

    if (
      kind === "video" &&
      size > MAX_VIDEO_BYTES
    ) {
      throw new Error(
        `Video must be 4 GB or less: ${clean}`
      );
    }

    files.push({
      entry,
      kind,
      path: clean,
      size,
    });

    if (
      files.length > 300
    ) {
      throw new Error(
        "A single submission may contain at most 300 media files."
      );
    }
  }

  if (!files.length) {
    throw new Error(
      "ZIP must contain at least one supported photo or video."
    );
  }

  /*
   * Temporary extraction directory.
   * Do NOT use public/uploads as permanent storage.
   */
  await fsp.mkdir(
    destRoot,
    {
      recursive: true,
    }
  );

  const extracted: Array<{
    kind:
      | "image"
      | "video";
    relPath: string;
    size: number;
    originalName: string;
    r2Key: string;
  }> = [];

  for (
    const file of files
  ) {
    const ext =
      extOf(file.path) ||
      "bin";

    const outName =
      `${crypto.randomUUID()}.${ext}`;

    const outPath =
      path.join(
        destRoot,
        outName
      );

    await pipeline(
      file.entry.stream(),
      fs.createWriteStream(
        outPath
      )
    );

    /*
     * R2 object key
     */
    const r2Key =
      `media/${crypto.randomUUID()}/${outName}`;

    /*
     * Upload file to Cloudflare R2
     */
    const fileBuffer =
      await fsp.readFile(
        outPath
      );

    await r2.send(
      new PutObjectCommand({
        Bucket:
          R2_BUCKET_NAME,
        Key: r2Key,
        Body: fileBuffer,
        ContentType:
          getContentType(ext),
      })
    );

    /*
     * Public URL.
     *
     * If your R2 bucket uses a custom public domain,
     * set R2_PUBLIC_URL in Vercel.
     */
    const publicBase =
      process.env.R2_PUBLIC_URL;

    const mediaUrl =
      publicBase
        ? `${publicBase.replace(
            /\/$/,
            ""
          )}/${r2Key}`
        : r2Key;

    extracted.push({
      kind: file.kind,
      relPath: mediaUrl,
      size: file.size,
      originalName:
        path.basename(
          file.path
        ),
      r2Key,
    });

    /*
     * Remove temporary local file
     */
    await fsp.rm(
      outPath,
      {
        force: true,
      }
    );
  }

  /*
   * Remove temporary extraction directory
   */
  await fsp.rm(
    destRoot,
    {
      recursive: true,
      force: true,
    }
  );

  return extracted;
}

/*
|--------------------------------------------------------------------------
| Content type
|--------------------------------------------------------------------------
*/

function getContentType(
  ext: string
): string {
  switch (
    ext.toLowerCase()
  ) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";

    case "png":
      return "image/png";

    case "webp":
      return "image/webp";

    case "gif":
      return "image/gif";

    case "mp4":
      return "video/mp4";

    case "mov":
      return "video/quicktime";

    case "m4v":
      return "video/x-m4v";

    case "webm":
      return "video/webm";

    default:
      return "application/octet-stream";
  }
}

