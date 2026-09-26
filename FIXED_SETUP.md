# Sumedha College Photography Club — Fix / Setup

## The admin login problem was caused by the seed script

Next.js automatically loads `.env.local`, but `node scripts/seed.mjs` was only loading the default `.env` file. That meant `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env.local` were not being used by `npm run seed`.

This fixed version now:

- loads `.env.local` before `.env` in the seed script;
- creates the database schema automatically when the seed script runs;
- synchronizes the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` during admin login, so an old/missing seed cannot lock the admin out;
- keeps local development usable when Gmail SMTP fails by logging the email contents/code in the terminal;
- lets the Admin CRM continue showing sections even if one protected API request fails;
- fixes the Next.js `Metadata` typing and removes the deprecated `baseUrl` setting.

## Use your existing `.env.local`

The fixed ZIP intentionally does **not** contain your `.env.local` file. Keep your current one in the project root.

Required admin values:

```env
ADMIN_EMAIL=your-admin-email@gmail.com
ADMIN_PASSWORD=your-admin-password
JWT_SECRET=your-long-random-secret
```

## Start the project

Open a terminal in this project folder and run:

```bash
npm install
npm run seed
npm run dev
```

Then open:

```text
http://localhost:3000/login
```

Use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env.local`.

After the password is accepted, the system sends a 6-digit code. In local development, if SMTP cannot send the message, the code is printed in the VS Code terminal.

After verification, the admin account goes to:

```text
http://localhost:3000/admin
```

## Important for an existing project

Do **not** delete your existing `club.db` if it already contains registrations, members, media, meetings, or other data. Run `npm run seed` against that database so the admin account is created/updated without removing the data.

The fixed project does not include `node_modules`, `.next`, `club.db`, or `.env.local` so those local/generated files are not overwritten.
