# Sumedha College Photography Club — Full Portal + Admin CRM

A full-stack Next.js portal for the Sumedha College Photography Club.

## Includes

- Animated cinematic public Home with the supplied club logo.
- Public gallery for approved photos and videos.
- Weekly Best, likes, 1–5 ratings and comments.
- Custom video player with play/pause, seek timeline, volume, speed, fullscreen, Picture-in-Picture and quality switching when variants exist.
- Guest view hides private meeting/LMS details.
- Student registration with full name, surname, student ID, grade, class, parent/guardian phone, address, email, password and optional profile picture.
- Admin approval queue before student account activation.
- Email 6-digit confirmation code with 10-minute expiry.
- Secure httpOnly sameSite session cookie after verification.
- LMS first-use tutorial.
- Registration first-use tutorial.
- Student dashboard with meetings, Zoom access, daily work, learning, announcements, task upload and profile editing.
- Admin-created tasks for photo, video or both.
- Submission rules enforced server-side: ZIP only, maximum 5 GB; photos must be < 50 MB each; videos must be <= 4 GB each; description required.
- ZIP validation for file types and unsafe paths, then media extraction into the local upload store.
- Admin CRM for members, Board/member status, Board positions, media moderation, Weekly Best, tasks, meetings, events, comments, announcements, subscribers, support chat and public/social settings.
- Student ↔ admin support chat.
- Executive committee roster matching the supplied list.

## Stack

Next.js 15 + React 19 + TypeScript + SQLite (`better-sqlite3`) + JWT (`jose`) + bcrypt + Nodemailer + Busboy + Unzipper.

## Local setup

```bash
npm install
cp .env.example .env.local
# edit .env.local
npm run seed
npm run dev
```

Open http://localhost:3000

The seed script loads `.env.local`, and the admin account comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD` there. The login route also synchronizes the configured admin account if the database seed is missing or stale.

## Email

Without SMTP variables, emails are logged to the server console for local development. If SMTP is configured but fails during local development, the email contents are also logged so the local portal remains testable. Configure working SMTP in `.env.local` before public use.

## Uploads

This starter stores uploads in `public/uploads`. For a real 5 GB production deployment, use object storage + managed Postgres and direct-to-storage multipart uploads. The included local route streams the ZIP to disk and validates media before publishing.

## Production security

Set a long random `JWT_SECRET`, HTTPS, SMTP, backups, antivirus/content scanning, object storage, rate limiting and managed Postgres before opening the portal publicly. Never use the seed password in production.
