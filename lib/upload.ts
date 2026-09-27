import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { pipeline } from "stream/promises";

import Busboy from "busboy";
import unzipper from "unzipper";

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// ============================================================
// LIMITS
// ============================================================

export const MAX_ZIP_BYTES =
  5 * 1024 * 1024 * 1024; // 5 GB

export const MAX_PHOTO_BYTES =
  50 * 1024 * 1024; // 50 MB

export const MAX_VIDEO_BYTES =
  4 * 1024 * 1024 * 1024; // 4 GB

// ============================================================
// ALLOWED EXTENSIONS
// ============================================================

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".m4v",
]);

// ============================================================
// R2 ENVIRONMENT
// ============================================================

const R2_ACCOUNT_ID =
  process.env.R2_ACCOUNT_ID;

const R2_ACCESS_KEY_ID =
  process.env.R2_ACCESS_KEY_ID;

const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY;

export const R2_BUCKET_NAME =
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
});

// ============================================================
// HELPERS
// ============================================================

function extOf(
  filename: string
): string {
  return path
    .extname(filename)
    .toLowerCase();
}

function mediaKind(
  filename: string
): "image" | "video" | null {
  const ext =
    extOf(filename);

  if (
    IMAGE_EXTENSIONS.has(ext)
  ) {
    return "image";
  }

  if (
    VIDEO_EXTENSIONS.has(ext)
  ) {
    return "video";
  }

  return null;
}

function getContentType(
  ext: string
): string {
  switch (
    ext.toLowerCase()
  ) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";

    case ".png":
      return "image/png";

    case ".webp":
      return "image/webp";

    case ".gif":
      return "image/gif";

    case ".mp4":
      return "video/mp4";

    case ".mov":
      return "video/quicktime";

    case ".webm":
      return "video/webm";

    case ".m4v":
      return "video/x-m4v";

    default:
      return "application/octet-stream";
  }
}

function safeFilename(
  filename: string
): string {
  return path
    .basename(filename)
    .replace(
      /[^\w.\- ()]/g,
      "_"
    )
    .replace(
      /\s+/g,
      "_"
    );
}

function safeRelativePath(
  filename: string
): string {
  return filename
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(
      (part) =>
        part &&
        part !== "." &&
        part !== ".."
    )
    .map((part) =>
      part.replace(
        /[^\w.\- ()]/g,
        "_"
      )
    )
    .join("/");
}

function getPublicR2Url(
  key: string
): string {
  const publicUrl =
    process.env.R2_PUBLIC_URL;

  if (publicUrl) {
    return (
      `${publicUrl.replace(
        /\/+$/,
        ""
      )}/${key}`
    );
  }

  return (
    `https://${R2_BUCKET_NAME}.` +
    `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`
  );
}

// ============================================================
// PARSE MULTIPART UPLOAD
// ============================================================

export async function parseUpload(
  req: Request
): Promise<{
  fields: Record<string, string>;
  filePath: string;
  fileSize: number;
}> {
  const tmpDir =
    path.join(
      "/tmp",
      "photography-club-uploads"
    );

  await fsp.mkdir(
    tmpDir,
    {
      recursive: true,
    }
  );

  return new Promise(
    (resolve, reject) => {
      let filePath = "";

      let fileSize = 0;

      let tooLarge = false;

      let filePipeline:
        | Promise<void>
        | undefined;

      const fields: Record<
        string,
        string
      > = {};

      let settled = false;

      // --------------------------------------------------------
      // REJECT ONCE
      // --------------------------------------------------------

      const finishReject = (
        error: unknown
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        reject(
          error instanceof Error
            ? error
            : new Error(
                String(error)
              )
        );
      };

      // --------------------------------------------------------
      // RESOLVE ONCE
      // --------------------------------------------------------

      const finishResolve = () => {
        if (settled) {
          return;
        }

        settled = true;

        resolve({
          fields,
          filePath,
          fileSize,
        });
      };

      // --------------------------------------------------------
      // BUSBOY
      // --------------------------------------------------------

      let bb: any;

      try {
        bb = Busboy({
          headers: {
            "content-type":
              req.headers.get(
                "content-type"
              ) || "",
          },

          limits: {
            fileSize:
              MAX_ZIP_BYTES,

            files: 1,
          },
        });
      } catch (error) {
        finishReject(error);
        return;
      }

      // ========================================================
      // FORM FIELDS
      // ========================================================

      bb.on(
        "field",
        (
          name: string,
          value: string
        ) => {
          fields[name] = value;
        }
      );

      // ========================================================
      // FILE
      // ========================================================

      bb.on(
        "file",
        (
          _fieldName: string,
          file: any,
          info: any
        ) => {
          const originalName =
            info?.filename ||
            "submission.zip";

          const ext =
            extOf(
              originalName
            );

          if (ext !== ".zip") {
            file.resume();

            finishReject(
              new Error(
                "Only ZIP files are allowed."
              )
            );

            return;
          }

          const safeName =
            `${Date.now()}-` +
            `${crypto.randomUUID()}.zip`;

          filePath =
            path.join(
              tmpDir,
              safeName
            );

          const output =
            fs.createWriteStream(
              filePath
            );

          // ------------------------------------------------------
          // TRACK SIZE
          // ------------------------------------------------------

          file.on(
            "data",
            (chunk: Buffer) => {
              fileSize +=
                chunk.length;
            }
          );

          // ------------------------------------------------------
          // BUSBOY SIZE LIMIT
          // ------------------------------------------------------

          file.on(
            "limit",
            () => {
              tooLarge = true;
            }
          );

          // ------------------------------------------------------
          // PIPE TO TEMP FILE
          // ------------------------------------------------------

          filePipeline =
            pipeline(
              file,
              output
            );
        }
      );

      // ========================================================
      // BUSBOY ERROR
      // ========================================================

      bb.on(
        "error",
        (error: unknown) => {
          finishReject(error);
        }
      );

      // ========================================================
      // FINISHED
      // ========================================================

      bb.on(
        "finish",
        async () => {
          try {
            if (filePipeline) {
              await filePipeline;
            }

            // --------------------------------------------------
            // SIZE LIMIT
            // --------------------------------------------------

            if (tooLarge) {
              if (filePath) {
                await fsp
                  .rm(
                    filePath,
                    {
                      force: true,
                    }
                  )
                  .catch(
                    () => {}
                  );
              }

              finishReject(
                new Error(
                  "ZIP file is larger than the 5 GB limit."
                )
              );

              return;
            }

            // --------------------------------------------------
            // NO FILE
            // --------------------------------------------------

            if (!filePath) {
              finishReject(
                new Error(
                  "No ZIP file was uploaded."
                )
              );

              return;
            }

            // --------------------------------------------------
            // VERIFY FILE SIZE
            // --------------------------------------------------

            const stat =
              await fsp.stat(
                filePath
              );

            fileSize =
              stat.size;

            if (
              fileSize >
              MAX_ZIP_BYTES
            ) {
              await fsp
                .rm(
                  filePath,
                  {
                    force: true,
                  }
                )
                .catch(
                  () => {}
                );

              finishReject(
                new Error(
                  "ZIP file is larger than the 5 GB limit."
                )
              );

              return;
            }

            // --------------------------------------------------
            // SUCCESS
            // --------------------------------------------------

            finishResolve();
          } catch (error) {
            if (filePath) {
              await fsp
                .rm(
                  filePath,
                  {
                    force: true,
                  }
                )
                .catch(
                  () => {}
                );
            }

            finishReject(error);
          }
        }
      );

      // ========================================================
      // REQUEST BODY
      // ========================================================

      if (!req.body) {
        finishReject(
          new Error(
            "Request body is missing."
          )
        );

        return;
      }

      req.body
        .pipeTo(
          new WritableStream({
            write(chunk) {
              bb.write(
                Buffer.from(chunk)
              );
            },

            close() {
              bb.end();
            },

            abort(error) {
              bb.destroy(error);
            },
          })
        )
        .catch(
          (error) => {
            bb.destroy(error);
          }
        );
    }
  );
}

// ============================================================
// EXTRACTED MEDIA TYPE
// ============================================================

export type ExtractedMedia = {
  kind:
    | "image"
    | "video";

  relPath: string;

  mediaUrl: string;

  r2Key: string;

  size: number;

  originalName: string;
};

// ============================================================
// INSPECT ZIP + EXTRACT + UPLOAD TO R2
// ============================================================

export async function inspectAndExtractZip(
  zipPath: string,
  destRoot: string,
  uploadType: string
): Promise<
  ExtractedMedia[]
> {
  const uploadedKeys: string[] =
    [];

  try {
    // ----------------------------------------------------------
    // CREATE TEMP DIRECTORY
    // ----------------------------------------------------------

    await fsp.mkdir(
      destRoot,
      {
        recursive: true,
      }
    );

    // ----------------------------------------------------------
    // OPEN ZIP
    // ----------------------------------------------------------

    const directory =
      await unzipper.Open.file(
        zipPath
      );

    const entries =
      directory.files;

    // ----------------------------------------------------------
    // EMPTY ZIP
    // ----------------------------------------------------------

    if (
      entries.length === 0
    ) {
      throw new Error(
        "The ZIP file is empty."
      );
    }

    // ----------------------------------------------------------
    // MAX FILE COUNT
    // ----------------------------------------------------------

    if (
      entries.length > 300
    ) {
      throw new Error(
        "ZIP contains too many files. Maximum is 300 files."
      );
    }

    const results:
      ExtractedMedia[] = [];

    // ==========================================================
    // EACH ZIP ENTRY
    // ==========================================================

    for (
      const entry of entries
    ) {
      const rawPath =
        entry.path;

      // Skip directories
      if (
        rawPath.endsWith("/")
      ) {
        continue;
      }

      const cleanPath =
        safeRelativePath(
          rawPath
        );

      if (!cleanPath) {
        continue;
      }

      // --------------------------------------------------------
      // DETERMINE MEDIA TYPE
      // --------------------------------------------------------

      const kind =
        mediaKind(
          cleanPath
        );

      // Unsupported files are ignored
      if (!kind) {
        continue;
      }

      const ext =
        extOf(
          cleanPath
        );

      const size =
        Number(
          entry.uncompressedSize ||
            0
        );

      // --------------------------------------------------------
      // IMAGE SIZE
      // --------------------------------------------------------

      if (
        kind === "image" &&
        size > MAX_PHOTO_BYTES
      ) {
        throw new Error(
          `Image "${cleanPath}" is larger than the 50 MB limit.`
        );
      }

      // --------------------------------------------------------
      // VIDEO SIZE
      // --------------------------------------------------------

      if (
        kind === "video" &&
        size > MAX_VIDEO_BYTES
      ) {
        throw new Error(
          `Video "${cleanPath}" is larger than the 4 GB limit.`
        );
      }

      // --------------------------------------------------------
      // UPLOAD TYPE
      // --------------------------------------------------------

      const normalizedUploadType =
        String(
          uploadType || ""
        )
          .trim()
          .toLowerCase();

      if (
        (
          normalizedUploadType ===
            "photo" ||
          normalizedUploadType ===
            "photos"
        ) &&
        kind !== "image"
      ) {
        throw new Error(
          `"${cleanPath}" is not an image. This task only accepts photos.`
        );
      }

      if (
        (
          normalizedUploadType ===
            "video" ||
          normalizedUploadType ===
            "videos"
        ) &&
        kind !== "video"
      ) {
        throw new Error(
          `"${cleanPath}" is not a video. This task only accepts videos.`
        );
      }

      // ========================================================
      // TEMP OUTPUT PATH
      // ========================================================

      const outputPath =
        path.join(
          destRoot,
          cleanPath
        );

      const outputDir =
        path.dirname(
          outputPath
        );

      await fsp.mkdir(
        outputDir,
        {
          recursive: true,
        }
      );

      // ========================================================
      // EXTRACT ZIP ENTRY
      // ========================================================

      const source =
        entry.stream();

      const output =
        fs.createWriteStream(
          outputPath
        );

      await pipeline(
        source,
        output
      );

      // ========================================================
      // VERIFY EXTRACTED FILE
      // ========================================================

      const stat =
        await fsp.stat(
          outputPath
        );

      const maxAllowed =
        kind === "image"
          ? MAX_PHOTO_BYTES
          : MAX_VIDEO_BYTES;

      if (
        stat.size >
        maxAllowed
      ) {
        throw new Error(
          `Extracted file "${cleanPath}" exceeds the allowed size.`
        );
      }

      // ========================================================
      // CREATE UNIQUE R2 KEY
      // ========================================================

      const uniqueId =
        crypto.randomUUID();

      const baseName =
        safeFilename(
          path.basename(
            cleanPath
          )
        );

      const r2Key =
        `media/${uniqueId}-${baseName}`;

      // ========================================================
      // STREAM FILE TO R2
      // ========================================================

      const fileStream =
        fs.createReadStream(
          outputPath
        );

      await r2.send(
        new PutObjectCommand({
          Bucket:
            R2_BUCKET_NAME,

          Key:
            r2Key,

          Body:
            fileStream,

          ContentType:
            getContentType(
              ext
            ),

          ContentLength:
            stat.size,
        })
      );

      uploadedKeys.push(
        r2Key
      );

      // ========================================================
      // CREATE PUBLIC URL
      // ========================================================

      const mediaUrl =
        getPublicR2Url(
          r2Key
        );

      results.push({
        kind,

        relPath:
          cleanPath,

        mediaUrl,

        r2Key,

        size:
          stat.size,

        originalName:
          path.basename(
            cleanPath
          ),
      });

      // ========================================================
      // DELETE TEMP FILE
      // ========================================================

      await fsp
        .rm(
          outputPath,
          {
            force: true,
          }
        )
        .catch(
          () => {}
        );
    }

    // ==========================================================
    // NO SUPPORTED FILES
    // ==========================================================

    if (
      results.length === 0
    ) {
      throw new Error(
        "No supported image or video files were found inside the ZIP."
      );
    }

    return results;
  } catch (error) {
    // ==========================================================
    // CLEANUP R2 FILES
    // ==========================================================

    await Promise.all(
      uploadedKeys.map(
        async (key) => {
          try {
            await r2.send(
              new DeleteObjectCommand({
                Bucket:
                  R2_BUCKET_NAME,

                Key:
                  key,
              })
            );
          } catch {
            // Ignore cleanup errors
          }
        }
      )
    );

    throw error;
  } finally {
    // ==========================================================
    // CLEANUP TEMP DIRECTORY
    // ==========================================================

    await fsp
      .rm(
        destRoot,
        {
          recursive: true,
          force: true,
        }
      )
      .catch(
        () => {}
      );
  }
}

// ============================================================
// CLEANUP ZIP
// ============================================================

export async function cleanupUpload(
  filePath: string
): Promise<void> {
  await fsp
    .rm(
      filePath,
      {
        force: true,
      }
    )
    .catch(
      () => {}
    );
}