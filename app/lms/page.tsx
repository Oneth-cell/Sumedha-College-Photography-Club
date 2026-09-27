import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/postgres';
import LmsClient from './LmsClient';

export const dynamic = 'force-dynamic';

export default async function LMS() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const userResult = await query(
    `
    SELECT
      id,
      full_name,
      surname,
      email,
      grade,
      class_name,
      parent_phone,
      address,
      pfp_url,
      membership_type,
      board_position,
      lms_tour_seen
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [session.userId]
  );

  const user = userResult.rows[0];

  if (!user) {
    redirect('/login');
  }

  const tasksResult = await query(
    `
    SELECT
      t.*,
      COALESCE(tp.done, 0) AS done
    FROM tasks t
    LEFT JOIN task_progress tp
      ON tp.task_id = t.id
     AND tp.user_id = $1
    ORDER BY
      t.due_date ASC,
      t.id DESC
    `,
    [session.userId]
  );

  const meetingsResult = await query(
    `
    SELECT
      id,
      title,
      start_time AS "startTime",
      zoom_url AS "zoomUrl",
      agenda
    FROM meetings
    WHERE start_time::timestamptz >= CURRENT_TIMESTAMP
    ORDER BY start_time::timestamptz ASC
    LIMIT 5
    `
  );

  const submissionsResult = await query(
    `
    SELECT
      s.id,
      s.description,
      s.status,
      s.zip_size AS "zipSize",
      s.created_at AS "createdAt",
      t.title AS "taskTitle",
      t.title AS task_title
    FROM submissions s
    LEFT JOIN tasks t
      ON t.id = s.task_id
    WHERE s.user_id = $1
    ORDER BY s.created_at DESC
    LIMIT 10
    `,
    [session.userId]
  );

  const announcementsResult = await query(
    `
    SELECT
      id,
      title,
      body,
      created_at AS "createdAt"
    FROM announcements
    WHERE active = 1
    ORDER BY created_at DESC
    LIMIT 6
    `
  );

  return (
    <LmsClient
      user={user}
      tasks={tasksResult.rows}
      meetings={meetingsResult.rows}
      submissions={submissionsResult.rows}
      announcements={announcementsResult.rows}
    />
  );
}