import pg from "pg";

// Return BIGINT columns (e.g. `created`) as numbers instead of strings.
pg.types.setTypeParser(20, Number);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.");
  process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

export const pool = new pg.Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5,
});

// Run a query and return all rows.
export async function all(sql, params) {
  return (await pool.query(sql, params)).rows;
}

// Run a query and return the first row (or undefined).
export async function one(sql, params) {
  return (await pool.query(sql, params)).rows[0];
}

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL,
      pw_hash    TEXT NOT NULL,
      salt       TEXT NOT NULL,
      is_admin   BOOLEAN NOT NULL DEFAULT FALSE,
      created    BIGINT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));

    -- Profile fields (added after launch, so they're ALTERs).
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS name      TEXT  NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS education TEXT  NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS location  TEXT  NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS bio       TEXT  NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS avatar    TEXT,
      ADD COLUMN IF NOT EXISTS links     JSONB NOT NULL DEFAULT '{}';

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created    BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS problems (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      num        INTEGER,
      diff       TEXT NOT NULL CHECK (diff IN ('Easy','Medium','Hard')),
      ds         TEXT NOT NULL DEFAULT '',
      pat        TEXT NOT NULL DEFAULT '',
      url        TEXT NOT NULL,
      created    BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progress (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      solved_on  TEXT,
      note       TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (user_id, problem_id)
    );

    -- Supabase exposes tables in the public schema through its REST API.
    -- Enabling RLS with no policies blocks that API entirely; this server
    -- connects as the postgres role, which bypasses RLS.
    ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
    ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
  `);
}
