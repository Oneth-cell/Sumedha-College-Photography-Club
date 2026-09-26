import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'club.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 full_name TEXT NOT NULL,
 surname TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 student_id TEXT,
 grade TEXT NOT NULL,
 class_name TEXT NOT NULL,
 parent_phone TEXT NOT NULL,
 address TEXT NOT NULL,
 pfp_url TEXT,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
 membership_type TEXT NOT NULL DEFAULT 'member' CHECK(membership_type IN ('member','board')),
 board_position TEXT,
 board_order INTEGER,
 verification_hash TEXT,
 verification_expires INTEGER,
 lms_tour_seen INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS board_roster (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 position TEXT NOT NULL UNIQUE,
 person_name TEXT NOT NULL,
 user_id INTEGER,
 display_order INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS meetings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 start_time TEXT NOT NULL,
 zoom_url TEXT NOT NULL,
 agenda TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 due_date TEXT NOT NULL,
 upload_type TEXT NOT NULL DEFAULT 'photo' CHECK(upload_type IN ('photo','video','both')),
 max_zip_bytes INTEGER NOT NULL DEFAULT 5368709120,
 photo_max_bytes INTEGER NOT NULL DEFAULT 52428800,
 video_max_bytes INTEGER NOT NULL DEFAULT 4294967296,
 description_required INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS task_progress (
 user_id INTEGER NOT NULL,
 task_id INTEGER NOT NULL,
 done INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id, task_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS submissions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 task_id INTEGER,
 user_id INTEGER NOT NULL,
 description TEXT NOT NULL,
 zip_path TEXT NOT NULL,
 zip_size INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewed_by INTEGER,
 review_note TEXT,
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS media_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 submission_id INTEGER,
 user_id INTEGER NOT NULL,
 task_id INTEGER,
 kind TEXT NOT NULL CHECK(kind IN ('image','video')),
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 media_url TEXT NOT NULL,
 poster_url TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 weekly_best INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS media_variants (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 media_id INTEGER NOT NULL,
 label TEXT NOT NULL,
 quality TEXT NOT NULL,
 media_url TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(media_id, quality),
 FOREIGN KEY(media_id) REFERENCES media_items(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS media_likes (
 media_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(media_id, user_id),
 FOREIGN KEY(media_id) REFERENCES media_items(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS media_ratings (
 media_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(media_id, user_id),
 FOREIGN KEY(media_id) REFERENCES media_items(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS media_comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 media_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(media_id) REFERENCES media_items(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 event_date TEXT NOT NULL,
 location TEXT NOT NULL,
 description TEXT NOT NULL,
 trailer_url TEXT,
 aftermovie_url TEXT,
 album_url TEXT,
 cover_url TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS announcements (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS chat_threads (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chat_messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 thread_id INTEGER NOT NULL,
 sender_user_id INTEGER NOT NULL,
 sender_role TEXT NOT NULL CHECK(sender_role IN ('student','admin')),
 message TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 read_at TEXT,
 FOREIGN KEY(thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
 FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS subscribers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT UNIQUE NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_user_id INTEGER,
 action TEXT NOT NULL,
 entity_type TEXT NOT NULL,
 entity_id INTEGER,
 details TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);
`);

const ensureColumn = (table: string, column: string, definition: string) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
ensureColumn('users','lms_tour_seen','INTEGER NOT NULL DEFAULT 0');
ensureColumn('users','updated_at','TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');

export default db;
