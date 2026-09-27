require("dotenv").config({ path: ".env.local" });

const Database = require("better-sqlite3");
const { Client } = require("pg");

const sqlite = new Database("club.db", {
  readonly: true,
});

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("ERROR: SUPABASE_DB_URL was not loaded from .env.local");
  process.exit(1);
}

const pg = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

const tables = [
  "users",
  "board_roster",
  "meetings",
  "tasks",
  "task_progress",
  "submissions",
  "media_items",
  "media_variants",
  "media_likes",
  "media_ratings",
  "media_comments",
  "events",
  "announcements",
  "chat_threads",
  "chat_messages",
  "subscribers",
  "settings",
  "audit_logs",
  "password_resets",
];

async function main() {
  console.log("Connecting to Supabase...");

  await pg.connect();

  console.log("Connected successfully.\n");

  for (const table of tables) {
    console.log(`Migrating ${table}...`);

    const rows = sqlite
      .prepare(`SELECT * FROM "${table}"`)
      .all();

    if (rows.length === 0) {
      console.log(`  ${table}: 0 rows`);
      continue;
    }

    const columns = Object.keys(rows[0]);

    const columnList = columns
      .map((column) => `"${column}"`)
      .join(", ");

    const placeholders = columns
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    const sql = `
      INSERT INTO "${table}" (${columnList})
      VALUES (${placeholders})
      ON CONFLICT DO NOTHING
    `;

    for (const row of rows) {
      const values = columns.map((column) => row[column]);

      await pg.query(sql, values);
    }

    console.log(
      `  ${table}: ${rows.length} rows migrated`
    );
  }

  console.log("\nMigration completed successfully!");

  await pg.end();
  sqlite.close();
}

main().catch(async (error) => {
  console.error("\nMigration failed:");
  console.error(error);

  try {
    await pg.end();
  } catch {}

  try {
    sqlite.close();
  } catch {}

  process.exit(1);
});