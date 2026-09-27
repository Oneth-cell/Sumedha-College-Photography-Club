import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

// Next.js loads .env.local automatically, but this standalone Node script does not.
// Load .env.local first so the admin credentials in your local project are used.
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const db = new Database(path.join(process.cwd(), 'club.db'));

// Make the seed command self-contained: create the database schema when needed.
const schema = fs.readFileSync(path.join(process.cwd(), 'schema.sql'), 'utf8');
db.exec(schema);

const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ScgPhotograpghyclub26', 12);
const email = (process.env.ADMIN_EMAIL || 'scgphotograpghyclub@gmail.com').toLowerCase().trim();

db.prepare(`
  INSERT INTO users(full_name,surname,email,student_id,grade,class_name,parent_phone,address,password_hash,role,status,membership_type)
  VALUES(?,?,?,?,?,?,?,?,?,'admin','approved','board')
  ON CONFLICT(email) DO UPDATE SET
    password_hash=excluded.password_hash,
    role='admin',
    status='approved',
    membership_type='board',
    updated_at=CURRENT_TIMESTAMP
`).run(
  'Sumedha College Photography Club Admin',
  'Admin',
  email,
  'ADMIN',
  'Staff',
  'Office',
  '',
  'Club Office',
  hash
);

const settings = {
  instagram_url: 'https://instagram.com/',
  facebook_url: 'https://facebook.com/',
  youtube_url: 'https://youtube.com/',
  tiktok_url: 'https://tiktok.com/',
  club_trailer_url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  club_trailer_poster: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1800&q=85',
  contact_email: email,
  copyright_text: '© 2026 Oneth Wickramaraachchi. All rights reserved.'
};
for (const [k, v] of Object.entries(settings)) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v);
}

const board = [
  ['President', 'Senula Thiwen', 1],
  ['Vice President', 'Oneth Wickramaarchchi', 2],
  ['Secretary', 'Deneth Akarsha', 3],
  ['Treasurer', 'Abeeth Senitha', 4],
  ['Chief Photo Editor', 'Chanithu Hansith', 5],
  ['Chief Video Editor', 'Tishan', 6],
  ['Vice Video Editor', 'Kenodh Witharana', 7],
  ['Aerial Photographer', 'Sanithu Dinhas', 8],
  ['Chief Organizer', 'Sasen Kemitha', 9],
  ['Vice Organizer', 'Minula Insara', 10]
];
for (const [position, name, order] of board) {
  db.prepare(`
    INSERT INTO board_roster(position,person_name,display_order) VALUES(?,?,?)
    ON CONFLICT(position) DO UPDATE SET person_name=excluded.person_name,display_order=excluded.display_order
  `).run(position, name, order);
}

const tasks = [
  ['Weekly visual challenge', 'Create one original visual story matching this week\'s theme. Submit photo, video or both in a ZIP with a description.', '2026-09-25T18:00', 'both'],
  ['Exposure practice', 'Practice shutter speed, aperture and ISO and submit your best examples.', '2026-09-28T18:00', 'photo'],
  ['Mini after-movie', 'Create a short school-life after movie. Include the project files in a ZIP.', '2026-10-02T18:00', 'video']
];
for (const [title, description, due, uploadType] of tasks) {
  if (!db.prepare('SELECT 1 FROM tasks WHERE title=?').get(title)) {
    db.prepare('INSERT INTO tasks(title,description,due_date,upload_type) VALUES(?,?,?,?)').run(title, description, due, uploadType);
  }
}

if (!db.prepare('SELECT 1 FROM meetings').get()) {
  db.prepare('INSERT INTO meetings(title,start_time,zoom_url,agenda) VALUES(?,?,?,?)').run(
    'Photography Fundamentals',
    new Date(Date.now() + 2 * 86400000).toISOString(),
    'https://zoom.us/',
    'Composition · Lighting · Manual exposure · Weekly challenge briefing'
  );
}
if (!db.prepare('SELECT 1 FROM events').get()) {
  db.prepare('INSERT INTO events(title,event_date,location,description,trailer_url,aftermovie_url,album_url) VALUES(?,?,?,?,?,?,?)').run(
    'Creative Media Day',
    '2026-10-04',
    'Sumedha College',
    'Photography, video and storytelling across the school day.',
    'https://youtube.com/',
    'https://youtube.com/',
    'https://photos.google.com/'
  );
}
if (!db.prepare('SELECT 1 FROM announcements').get()) {
  db.prepare('INSERT INTO announcements(title,body) VALUES(?,?)').run(
    'Welcome to the new club portal',
    'Registration, LMS, submissions, gallery, meetings and admin support are now managed in one place.'
  );
}

console.log(`Seeded admin: ${email}`);
