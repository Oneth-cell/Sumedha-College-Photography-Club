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
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  global.postgresPool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  return pool.query<T>(text, values);
}

export { pool };