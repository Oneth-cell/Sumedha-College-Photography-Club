import { Pool, QueryResultRow } from 'pg';

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error('SUPABASE_DB_URL is missing');
}

declare global {
  // eslint-disable-next-line no-var
  var postgresPool: Pool | undefined;
}

const pool =
  global.postgresPool ??
  new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },

    // Keep this very low for Vercel + Supabase Session Pooler
    max: 1,
    min: 0,

    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
  });

global.postgresPool = pool;

export async function query<
  T extends QueryResultRow = QueryResultRow
>(
  text: string,
  values: unknown[] = []
) {
  return pool.query<T>(text, values);
}

export { pool };