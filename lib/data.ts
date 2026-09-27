import { query } from './postgres';

export async function getSetting(
  key: string,
  fallback = ''
) {
  const result = await query<{ value: string }>(
    `
    SELECT value
    FROM settings
    WHERE key = $1
    LIMIT 1
    `,
    [key]
  );

  return result.rows[0]?.value ?? fallback;
}

export async function getSettings() {
  const result = await query<{
    key: string;
    value: string;
  }>(
    `
    SELECT key, value
    FROM settings
    ORDER BY key
    `
  );

  return result.rows;
}

export async function getPublicMedia(limit = 12) {
  const result = await query(
    `
    SELECT
      m.*,
      u.full_name AS author,

      (
        SELECT COUNT(*)::int
        FROM media_likes l
        WHERE l.media_id = m.id
      ) AS likes,

      (
        SELECT ROUND(AVG(r.rating)::numeric, 1)::float
        FROM media_ratings r
        WHERE r.media_id = m.id
      ) AS rating,

      (
        SELECT COUNT(*)::int
        FROM media_ratings r
        WHERE r.media_id = m.id
      ) AS rating_count,

      (
        SELECT COUNT(*)::int
        FROM media_comments c
        WHERE c.media_id = m.id
          AND c.status = 'visible'
      ) AS comment_count,

      (
        SELECT media_url
        FROM media_variants v
        WHERE v.media_id = m.id
          AND v.quality = '1080p'
        LIMIT 1
      ) AS q1080,

      (
        SELECT media_url
        FROM media_variants v
        WHERE v.media_id = m.id
          AND v.quality = '720p'
        LIMIT 1
      ) AS q720,

      (
        SELECT media_url
        FROM media_variants v
        WHERE v.media_id = m.id
          AND v.quality = '480p'
        LIMIT 1
      ) AS q480

    FROM media_items m
    JOIN users u
      ON u.id = m.user_id

    WHERE m.status = 'approved'

    ORDER BY
      m.weekly_best DESC,
      m.created_at DESC

    LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

export async function getMediaComments(
  mediaId: number
) {
  const result = await query(
    `
    SELECT
      c.id,
      c.body,
      c.created_at AS "createdAt",
      u.full_name AS author,
      u.pfp_url AS pfp

    FROM media_comments c
    JOIN users u
      ON u.id = c.user_id

    WHERE c.media_id = $1
      AND c.status = 'visible'

    ORDER BY c.created_at DESC
    `,
    [mediaId]
  );

  return result.rows;
}

export async function getHomeData() {
  const weeklyResult = await query(
    `
    SELECT
      m.*,
      u.full_name AS author,

      (
        SELECT ROUND(AVG(r.rating)::numeric, 1)::float
        FROM media_ratings r
        WHERE r.media_id = m.id
      ) AS rating,

      (
        SELECT COUNT(*)::int
        FROM media_likes l
        WHERE l.media_id = m.id
      ) AS likes,

      (
        SELECT COUNT(*)::int
        FROM media_comments c
        WHERE c.media_id = m.id
          AND c.status = 'visible'
      ) AS comment_count

    FROM media_items m
    JOIN users u
      ON u.id = m.user_id

    WHERE m.status = 'approved'
      AND m.weekly_best = 1

    ORDER BY m.created_at DESC
    LIMIT 6
    `
  );

  const meetingResult = await query(
    `
    SELECT
      id,
      title,
      start_time AS "startTime",
      zoom_url AS "zoomUrl",
      agenda

    FROM meetings

    WHERE start_time::timestamptz >= NOW()

    ORDER BY start_time::timestamptz ASC

    LIMIT 1
    `
  );

  const eventsResult = await query(
    `
    SELECT
      id,
      title,
      event_date AS date,
      location,
      description,
      trailer_url AS "trailerUrl",
      aftermovie_url AS "aftermovieUrl",
      album_url AS "albumUrl",
      cover_url AS "coverUrl"

    FROM events

    ORDER BY event_date DESC

    LIMIT 3
    `
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

    LIMIT 3
    `
  );

  return {
    weeklyBest: weeklyResult.rows,
    nextMeeting: meetingResult.rows[0] ?? null,
    events: eventsResult.rows,
    announcements: announcementsResult.rows,
  };
}

export async function getBoard() {
  const result = await query(
    `
    SELECT *
    FROM board_roster

    WHERE active = 1

    ORDER BY display_order ASC
    `
  );

  return result.rows;
}