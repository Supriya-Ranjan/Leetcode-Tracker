import pg from "pg";

// Return BIGINT columns (e.g. `created`) as numbers instead of strings.
pg.types.setTypeParser(20, Number);

function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// Make a pasted connection string safe to parse: trim stray quotes/whitespace and
// URL-encode the username and password, so characters like @ # / ? : in a password
// don't get mistaken for the host. Already-encoded values (%40) are left as they are.
function normalizeUrl(raw) {
  const s = raw.trim().replace(/^(["'])(.*)\1$/, "$2");
  const m = /^(postgres(?:ql)?:\/\/)(.*)@([^@]*)$/.exec(s);
  if (!m) return s;
  const [, scheme, userinfo, hostAndPath] = m;
  const i = userinfo.indexOf(":");
  const enc = (x) => encodeURIComponent(decode(x));
  const auth = i < 0 ? enc(userinfo) : enc(userinfo.slice(0, i)) + ":" + enc(userinfo.slice(i + 1));
  return `${scheme}${auth}@${hostAndPath}`;
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.");
  process.exit(1);
}
const url = normalizeUrl(process.env.DATABASE_URL);

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

try {
  const u = new URL(url);
  console.log(`Connecting to Postgres at ${u.hostname}:${u.port || 5432} as ${decode(u.username)}`);
} catch {
  console.error("DATABASE_URL doesn't look like a postgresql:// connection string.");
  process.exit(1);
}

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
      ADD COLUMN IF NOT EXISTS links     JSONB NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS email     TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email)) WHERE email IS NOT NULL;

    -- One-time password reset links. Only a SHA-256 hash of the token is stored.
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created    BIGINT NOT NULL,
      expires    BIGINT NOT NULL
    );

    -- Pending email changes, confirmed with a 6-digit code sent to the new address.
    -- One per user; only a hash of the code is stored.
    CREATE TABLE IF NOT EXISTS email_changes (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      new_email  TEXT NOT NULL,
      code_hash  TEXT NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      created    BIGINT NOT NULL,
      expires    BIGINT NOT NULL
    );

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
      ds         TEXT[] NOT NULL DEFAULT '{}',
      pat        TEXT[] NOT NULL DEFAULT '{}',
      url        TEXT NOT NULL,
      created    BIGINT NOT NULL
    );

    -- ds / pat used to hold a single value; convert them to lists once.
    DO $$
    BEGIN
      IF (SELECT data_type FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'problems' AND column_name = 'ds') = 'text' THEN
        ALTER TABLE problems
          ALTER COLUMN ds  DROP DEFAULT,
          ALTER COLUMN pat DROP DEFAULT,
          ALTER COLUMN ds  TYPE TEXT[] USING CASE WHEN ds  = '' THEN '{}' ELSE ARRAY[ds]  END,
          ALTER COLUMN pat TYPE TEXT[] USING CASE WHEN pat = '' THEN '{}' ELSE ARRAY[pat] END,
          ALTER COLUMN ds  SET DEFAULT '{}',
          ALTER COLUMN pat SET DEFAULT '{}';
      END IF;
    END $$;

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
    ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE email_changes ENABLE ROW LEVEL SECURITY;
  `);
}
