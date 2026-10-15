
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
    .rm(target, { force: true })
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
  } catch (error) {
    console.error('[ADMIN MEDIA GET ERROR]', error);

    return NextResponse.json(
      { error: 'Could not load admin media.' },
      { status: 500 }
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
      status: requestedStatus,
    } = await req.json();

    /*
     * APPROVE OR REJECT AN ENTIRE SUBMISSION
     */

    if (
      action === 'approve_submission' ||
      action === 'reject_submission'
    ) {
      const id = Number(submissionId);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return NextResponse.json(
          { error: 'Invalid submission ID.' },
          { status: 400 }
        );
      }

      const status =
        action === 'approve_submission'
          ? 'approved'
          : 'rejected';

      const submissionResult = await query(
        `
        UPDATE submissions
        SET
          status = $1,
          reviewed_by = $2,
          reviewed_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id
        `,
        [status, admin.userId, id]
      );

      if (!submissionResult.rows.length) {
        return NextResponse.json(
          { error: 'Submission not found.' },
          { status: 404 }
        );
      }

      await query(
        `
        UPDATE media_items
        SET
          status = $1,
          weekly_best = CASE
            WHEN $1 = 'rejected' THEN 0
            ELSE weekly_best
          END
        WHERE submission_id = $2
        `,
        [status, id]
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
        status,
      });
    }

    /*
     * DELETE A MEDIA FILE
     */

    if (action === 'delete_media') {
      const id = Number(mediaId);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return NextResponse.json(
          { error: 'Invalid media ID.' },
          { status: 400 }
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
          { error: 'Media not found.' },
          { status: 404 }
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

      await query(
        `DELETE FROM media_variants WHERE media_id = $1`,
        [id]
      );

      await query(
        `DELETE FROM media_likes WHERE media_id = $1`,
        [id]
      );

      await query(
        `DELETE FROM media_ratings WHERE media_id = $1`,
        [id]
      );

      await query(
        `DELETE FROM media_comments WHERE media_id = $1`,
        [id]
      );

      await query(
        `DELETE FROM media_items WHERE id = $1`,
        [id]
      );

      for (const variant of variantsResult.rows) {
        await removePublicUpload(variant.media_url);
      }

      await removePublicUpload(media.media_url);
      await removePublicUpload(media.poster_url);

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
          JSON.stringify({ title: media.title }),
        ]
      );

      if (
        submissionIdValue !== null &&
        Number.isSafeInteger(submissionIdValue) &&
        submissionIdValue > 0
      ) {
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

        const remaining = Number(
          remainingResult.rows[0]?.count || 0
        );

        if (remaining === 0) {
          const submissionResult = await query<{
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

          const submission = submissionResult.rows[0];

          await query(
            `DELETE FROM submissions WHERE id = $1`,
            [submissionIdValue]
          );

          if (submission) {
            await removePublicUpload(submission.zip_path);
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
        } else {
          /*
           * Keep the parent submission status consistent
           * with any files that remain after deletion.
           */
          await syncSubmissionStatus(submissionIdValue, admin.userId);
        }
      }

      return NextResponse.json({
        ok: true,
      });
    }

    /*
     * APPROVE OR REJECT AN INDIVIDUAL PHOTO / VIDEO
     *
     * The client sends:
     * { action: 'media_status', mediaId, status: 'approved' }
     * or
     * { action: 'media_status', mediaId, status: 'rejected' }
     */

    if (action === 'media_status') {
      const id = Number(mediaId);
      const status = String(requestedStatus || '').toLowerCase();

      if (!Number.isSafeInteger(id) || id <= 0) {
        return NextResponse.json(
          { error: 'Invalid media ID.' },
          { status: 400 }
        );
      }

      if (status !== 'approved' && status !== 'rejected') {
        return NextResponse.json(
          {
            error: 'Status must be approved or rejected.',
          },
          { status: 400 }
        );
      }

      const mediaResult = await query<{
        submission_id: number | string | null;
      }>(
        `
        UPDATE media_items
        SET
          status = $1,
          weekly_best = CASE
            WHEN $1 = 'rejected' THEN 0
            ELSE weekly_best
          END
        WHERE id = $2
        RETURNING submission_id
        `,
        [status, id]
      );

      const media = mediaResult.rows[0];

      if (!media) {
        return NextResponse.json(
          { error: 'Media not found.' },
          { status: 404 }
        );
      }

      let submissionStatus: string | null = null;

      if (media.submission_id != null) {
        const parentId = Number(media.submission_id);

        if (
          Number.isSafeInteger(parentId) &&
          parentId > 0
        ) {
          submissionStatus = await syncSubmissionStatus(
            parentId,
            admin.userId
          );
        }
      }

      return NextResponse.json({
        ok: true,
        status,
        submissionStatus,
      });
    }

    /*
     * SET OR REMOVE WEEKLY BEST
     */

    if (action === 'weekly_best') {
      const id = Number(mediaId);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return NextResponse.json(
          { error: 'Invalid media ID.' },
          { status: 400 }
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
          { error: 'Media not found.' },
          { status: 404 }
        );
      }

      if (weeklyBest && media.status !== 'approved') {
        return NextResponse.json(
          {
            error: 'Only approved media can be Weekly Best.',
          },
          { status: 400 }
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
        [weeklyBest ? 1 : 0, id]
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
        weeklyBest: Boolean(weeklyBest),
      });
    }

    return NextResponse.json(
      { error: 'Unknown action.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[ADMIN MEDIA ERROR]', error);

    return NextResponse.json(
      {
        error: error?.message || 'Could not process media action.',
      },
      { status: 500 }
    );
  }
}

/*
 * Recalculate a parent submission from all its remaining media.
 *
 * Rules:
 * - Any unreviewed file -> pending
 * - No pending files, at least one rejected file -> rejected
 * - All files approved -> approved
 */
async function syncSubmissionStatus(
  submissionId: number,
  adminUserId: number | string
): Promise<string> {
  const countsResult = await query<{
    total_count: number;
    pending_count: number;
    rejected_count: number;
  }>(
    `
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status, 'pending'))
          NOT IN ('approved', 'rejected')
      )::int AS pending_count,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status, '')) = 'rejected'
      )::int AS rejected_count
    FROM media_items
    WHERE submission_id = $1
    `,
    [submissionId]
  );

  const counts = countsResult.rows[0];

  const totalCount = Number(counts?.total_count ?? 0);
  const pendingCount = Number(counts?.pending_count ?? 0);
  const rejectedCount = Number(counts?.rejected_count ?? 0);

  /*
   * No media files remain. The caller may be deleting the
   * last file, so do not label this as approved.
   */
  if (totalCount === 0) {
    return 'pending';
  }

  const submissionStatus =
    pendingCount > 0
      ? 'pending'
      : rejectedCount > 0
        ? 'rejected'
        : 'approved';

  await query(
    `
    UPDATE submissions
    SET
      status = $1,
      reviewed_by = CASE
        WHEN $1 = 'pending' THEN NULL
        ELSE $2
      END,
      reviewed_at = CASE
        WHEN $1 = 'pending' THEN NULL
        ELSE CURRENT_TIMESTAMP
      END
    WHERE id = $3
    `,
    [
      submissionStatus,
      adminUserId,
      submissionId,
    ]
  );

  return submissionStatus;
}
