import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/postgres';
import fs from 'fs/promises';
import path from 'path';

async function removePublicUpload(
  url?: string | null
) {
  if (!url || !url.startsWith('/uploads/')) {
    return;
  }

  const root = path.resolve(
    process.cwd(),
    'public',
    'uploads'
  );

  const target = path.resolve(
    process.cwd(),
    'public',
    url.replace(/^\/+/, '')
  );

  if (
    target !== root &&
    !target.startsWith(root + path.sep)
  ) {
    return;
  }

  await fs
    .rm(target, {
      force: true,
    })
    .catch(() => {});
}

export async function GET() {
  try {
    await requireAdmin();

    const submissionsResult = await query(
      `
      SELECT
        s.id,
        s.description,
        s.zip_size AS "zipSize",
        s.status,
        s.created_at AS "createdAt",
        u.full_name AS student,
        t.title AS "taskTitle",
        t.upload_type AS "uploadType"
      FROM submissions s
      JOIN users u
        ON u.id = s.user_id
      LEFT JOIN tasks t
        ON t.id = s.task_id
      WHERE s.status = 'pending'
      ORDER BY s.created_at DESC
      `
    );

    const filesResult = await query(
      `
      SELECT
        m.id,
        m.submission_id AS "submissionId",
        m.kind,
        m.title,
        m.description,
        m.media_url AS "mediaUrl",
        m.poster_url AS "posterUrl",
        m.status,
        m.weekly_best AS "weeklyBest",
        u.full_name AS author
      FROM media_items m
      JOIN users u
        ON u.id = m.user_id
      ORDER BY m.created_at DESC
      LIMIT 500
      `
    );

    return NextResponse.json({
      submissions: submissionsResult.rows,
      files: filesResult.rows,
    });
  } catch {
    return NextResponse.json(
      {
        error: 'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();

    const {
      action,
      submissionId,
      mediaId,
      weeklyBest,
    } = await req.json();

    if (
      action === 'approve_submission' ||
      action === 'reject_submission'
    ) {
      const id = Number(submissionId);

      if (!Number.isFinite(id)) {
        return NextResponse.json(
          {
            error: 'Invalid submission ID.',
          },
          {
            status: 400,
          }
        );
      }

      const status =
        action === 'approve_submission'
          ? 'approved'
          : 'rejected';

      await query(
        `
        UPDATE submissions
        SET
          status = $1,
          reviewed_by = $2,
          reviewed_at = CURRENT_TIMESTAMP
        WHERE id = $3
        `,
        [
          status,
          admin.userId,
          id,
        ]
      );

      await query(
        `
        UPDATE media_items
        SET status = $1
        WHERE submission_id = $2
        `,
        [
          status,
          id,
        ]
      );

      await query(
        `
        INSERT INTO audit_logs(
          actor_user_id,
          action,
          entity_type,
          entity_id
        )
        VALUES($1, $2, $3, $4)
        `,
        [
          admin.userId,
          `submission_${status}`,
          'submission',
          id,
        ]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (action === 'delete_media') {
      const id = Number(mediaId);

      if (!Number.isFinite(id)) {
        return NextResponse.json(
          {
            error: 'Invalid media ID.',
          },
          {
            status: 400,
          }
        );
      }

      const mediaResult = await query(
        `
        SELECT *
        FROM media_items
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      const media = mediaResult.rows[0] as any;

      if (!media) {
        return NextResponse.json(
          {
            error: 'Media not found.',
          },
          {
            status: 404,
          }
        );
      }

      const variantsResult = await query<{
        media_url: string;
      }>(
        `
        SELECT media_url
        FROM media_variants
        WHERE media_id = $1
        `,
        [id]
      );

      const submissionIdValue =
        media.submission_id == null
          ? null
          : Number(media.submission_id);

      /*
       * SQLite previously handled these relationships
       * through ON DELETE CASCADE. The PostgreSQL schema
       * does not currently have those foreign keys, so
       * clean up dependent rows explicitly.
       */
      await query(
        `
        DELETE FROM media_variants
        WHERE media_id = $1
        `,
        [id]
      );

      await query(
        `
        DELETE FROM media_likes
        WHERE media_id = $1
        `,
        [id]
      );

      await query(
        `
        DELETE FROM media_ratings
        WHERE media_id = $1
        `,
        [id]
      );

      await query(
        `
        DELETE FROM media_comments
        WHERE media_id = $1
        `,
        [id]
      );

      await query(
        `
        DELETE FROM media_items
        WHERE id = $1
        `,
        [id]
      );

      for (const variant of variantsResult.rows) {
        await removePublicUpload(
          variant.media_url
        );
      }

      await removePublicUpload(
        media.media_url
      );

      await removePublicUpload(
        media.poster_url
      );

      await query(
        `
        INSERT INTO audit_logs(
          actor_user_id,
          action,
          entity_type,
          entity_id,
          details
        )
        VALUES($1, $2, $3, $4, $5)
        `,
        [
          admin.userId,
          'media_delete',
          'media',
          id,
          JSON.stringify({
            title: media.title,
          }),
        ]
      );

      if (submissionIdValue) {
        const remainingResult = await query<{
          count: string;
        }>(
          `
          SELECT COUNT(*)::text AS count
          FROM media_items
          WHERE submission_id = $1
          `,
          [submissionIdValue]
        );

        const remaining =
          Number(
            remainingResult.rows[0]?.count || 0
          );

        if (remaining === 0) {
          const submissionResult =
            await query<{
              zip_path: string;
            }>(
              `
              SELECT zip_path
              FROM submissions
              WHERE id = $1
              LIMIT 1
              `,
              [submissionIdValue]
            );

          const submission =
            submissionResult.rows[0];

          await query(
            `
            DELETE FROM submissions
            WHERE id = $1
            `,
            [submissionIdValue]
          );

          if (submission) {
            await removePublicUpload(
              submission.zip_path
            );
          }

          const mediaDir = path.join(
            process.cwd(),
            'public',
            'uploads',
            'media',
            String(submissionIdValue)
          );

          await fs
            .rm(mediaDir, {
              recursive: true,
              force: true,
            })
            .catch(() => {});
        }
      }

      return NextResponse.json({
        ok: true,
      });
    }

    if (action === 'media_status') {
      const id = Number(mediaId);

      if (!Number.isFinite(id)) {
        return NextResponse.json(
          {
            error: 'Invalid media ID.',
          },
          {
            status: 400,
          }
        );
      }

      const status =
        weeklyBest === true
          ? 'approved'
          : String(weeklyBest) === 'reject'
            ? 'rejected'
            : 'approved';

      await query(
        `
        UPDATE media_items
        SET
          status = $1,
          weekly_best = $2
        WHERE id = $3
        `,
        [
          status,
          weeklyBest === true ? 1 : 0,
          id,
        ]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (action === 'weekly_best') {
      const id = Number(mediaId);

      if (!Number.isFinite(id)) {
        return NextResponse.json(
          {
            error: 'Invalid media ID.',
          },
          {
            status: 400,
          }
        );
      }

      const mediaResult = await query<{
        id: number;
        status: string;
      }>(
        `
        SELECT id, status
        FROM media_items
        WHERE id = $1
        LIMIT 1
        `,
        [id]
      );

      const media = mediaResult.rows[0];

      if (!media) {
        return NextResponse.json(
          {
            error: 'Media not found.',
          },
          {
            status: 404,
          }
        );
      }

      if (weeklyBest) {
        await query(
          `
          UPDATE media_items
          SET weekly_best = 0
          WHERE weekly_best = 1
          `
        );
      }

      await query(
        `
        UPDATE media_items
        SET weekly_best = $1
        WHERE id = $2
        `,
        [
          weeklyBest ? 1 : 0,
          id,
        ]
      );

      await query(
        `
        INSERT INTO audit_logs(
          actor_user_id,
          action,
          entity_type,
          entity_id,
          details
        )
        VALUES($1, $2, $3, $4, $5)
        `,
        [
          admin.userId,
          weeklyBest
            ? 'weekly_best_set'
            : 'weekly_best_removed',
          'media',
          id,
          '',
        ]
      );

      return NextResponse.json({
        ok: true,
      });
    }

    return NextResponse.json(
      {
        error: 'Unknown action.',
      },
      {
        status: 400,
      }
    );
  } catch (error: any) {
    console.error(
      '[ADMIN MEDIA ERROR]',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unauthorized',
      },
      {
        status: 401,
      }
    );
  }
}