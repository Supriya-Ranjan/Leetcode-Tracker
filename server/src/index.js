import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { all, initSchema, one, pool } from "./db.js";
import {
  checkPassword,
  createSession,
  fullProfile,
  hashPassword,
  publicUser,
  requireAdmin,
  requireAuth,
} from "./auth.js";

const app = express();
// Profile pictures arrive as base64 data URLs, so allow a bit more than the 100kb default.
app.use(express.json({ limit: "1mb" }));

// ---------- auth ----------

app.post("/api/auth/register", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!/^[\w.-]{3,32}$/.test(username))
    return res.status(400).json({ error: "Username must be 3–32 letters, numbers, _ . or -" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters." });

  const { salt, hash } = hashPassword(password);
  let user;
  try {
    // New accounts are always members; admins promote them from the Members page
    // (or with `npm run make-admin <username>`).
    user = await one(
      `INSERT INTO users (username, pw_hash, salt, is_admin, created)
       VALUES ($1, $2, $3, FALSE, $4)
       RETURNING *`,
      [username, hash, salt, Date.now()],
    );
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That username is taken." });
    throw err;
  }
  res.status(201).json({ token: await createSession(user.id), user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const user = await one("SELECT * FROM users WHERE lower(username) = lower($1)", [username]);
  if (!user || !checkPassword(password, user.salt, user.pw_hash))
    return res.status(401).json({ error: "Wrong username or password." });
  res.json({ token: await createSession(user.id), user: publicUser(user) });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM sessions WHERE token = $1", [req.token]);
  res.status(204).end();
});

app.get("/api/me", requireAuth, (req, res) => res.json(publicUser(req.user)));

// ---------- profile (own account) ----------

const LINK_KEYS = ["github", "linkedin", "leetcode", "twitter", "website"];
const TEXT_LIMITS = { name: 60, education: 120, location: 60, bio: 500 };
const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const AVATAR_MAX = 400_000; // characters of base64, about 300 KB of image

// Returns { fields } on success or { error } with a message for the user.
function readProfile(body) {
  const fields = {};
  for (const [k, max] of Object.entries(TEXT_LIMITS)) {
    const v = String(body?.[k] ?? "").trim();
    if (v.length > max) return { error: `${k[0].toUpperCase() + k.slice(1)} can be at most ${max} characters.` };
    fields[k] = v;
  }

  const links = {};
  for (const k of LINK_KEYS) {
    let v = String(body?.links?.[k] ?? "").trim();
    if (!v) continue;
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    let ok = v.length <= 200;
    try {
      ok &&= /^https?:$/.test(new URL(v).protocol);
    } catch {
      ok = false;
    }
    if (!ok) return { error: `The ${k} link isn't a valid web address.` };
    links[k] = v;
  }
  fields.links = links;

  const avatar = body?.avatar ?? null;
  if (avatar !== null && (typeof avatar !== "string" || !AVATAR_RE.test(avatar) || avatar.length > AVATAR_MAX))
    return { error: "Profile picture must be a PNG, JPEG or WebP under 300 KB." };
  fields.avatar = avatar;

  return { fields };
}

app.get("/api/profile", requireAuth, (req, res) => res.json(fullProfile(req.user)));

app.put("/api/profile", requireAuth, async (req, res) => {
  const { fields: f, error } = readProfile(req.body);
  if (error) return res.status(400).json({ error });
  const user = await one(
    `UPDATE users SET name = $1, education = $2, location = $3, bio = $4, links = $5, avatar = $6
     WHERE id = $7 RETURNING *`,
    [f.name, f.education, f.location, f.bio, JSON.stringify(f.links), f.avatar, req.user.id],
  );
  res.json(fullProfile(user));
});

// Body: { current, next }. Signs out every other session for this account.
app.put("/api/profile/password", requireAuth, async (req, res) => {
  const current = String(req.body?.current || "");
  const next = String(req.body?.next || "");
  if (!checkPassword(current, req.user.salt, req.user.pw_hash))
    return res.status(400).json({ error: "Your current password is wrong." });
  if (next.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters." });
  if (next === current) return res.status(400).json({ error: "New password must be different from the current one." });

  const { salt, hash } = hashPassword(next);
  await pool.query("UPDATE users SET pw_hash = $1, salt = $2 WHERE id = $3", [hash, salt, req.user.id]);
  await pool.query("DELETE FROM sessions WHERE user_id = $1 AND token <> $2", [req.user.id, req.token]);
  res.status(204).end();
});

// ---------- users (admin) ----------

app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
  const rows = await all(`
    SELECT u.id, u.username, u.is_admin, u.created, u.name, u.avatar,
           COUNT(p.solved_on)::int AS solved
    FROM users u
    LEFT JOIN progress p ON p.user_id = u.id
    GROUP BY u.id
    ORDER BY u.is_admin DESC, lower(u.username)
  `);
  res.json(rows.map((u) => ({ ...publicUser(u), created: u.created, solved: u.solved })));
});

// Body: { isAdmin: boolean }
app.patch("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (typeof req.body?.isAdmin !== "boolean")
    return res.status(400).json({ error: "isAdmin must be true or false." });
  if (id === req.user.id)
    return res.status(400).json({ error: "You can't change your own role." });

  // Only demote if another admin will remain, checked in the same statement.
  const user = await one(
    `UPDATE users SET is_admin = $1
     WHERE id = $2
       AND ($1 OR (SELECT COUNT(*) FROM users WHERE is_admin AND id <> $2) > 0)
     RETURNING *`,
    [req.body.isAdmin, id],
  );
  if (!user) {
    const exists = await one("SELECT 1 FROM users WHERE id = $1", [id]);
    return exists
      ? res.status(400).json({ error: "There must be at least one admin." })
      : res.status(404).json({ error: "User not found." });
  }
  res.json(publicUser(user));
});

// ---------- problems ----------

const DIFFS = ["Easy", "Medium", "Hard"];

function readProblem(body) {
  const p = {
    title: String(body?.title || "").trim(),
    num: parseInt(body?.num, 10) || null,
    diff: DIFFS.includes(body?.diff) ? body.diff : "Medium",
    ds: String(body?.ds || ""),
    pat: String(body?.pat || ""),
    url: String(body?.url || "").trim(),
  };
  if (!p.title || !/^https?:\/\//i.test(p.url)) return null;
  return p;
}

function problemId(req) {
  const id = Number(req.params.id ?? req.params.problemId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

app.get("/api/problems", requireAuth, async (req, res) => {
  res.json(await all("SELECT * FROM problems ORDER BY created, id"));
});

app.post("/api/problems", requireAuth, requireAdmin, async (req, res) => {
  const p = readProblem(req.body);
  if (!p) return res.status(400).json({ error: "A title and a valid http(s) problem link are required." });
  const saved = await one(
    `INSERT INTO problems (title, num, diff, ds, pat, url, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [p.title, p.num, p.diff, p.ds, p.pat, p.url, Date.now()],
  );
  res.status(201).json(saved);
});

app.put("/api/problems/:id", requireAuth, requireAdmin, async (req, res) => {
  const p = readProblem(req.body);
  if (!p) return res.status(400).json({ error: "A title and a valid http(s) problem link are required." });
  const saved = await one(
    `UPDATE problems SET title = $1, num = $2, diff = $3, ds = $4, pat = $5, url = $6
     WHERE id = $7 RETURNING *`,
    [p.title, p.num, p.diff, p.ds, p.pat, p.url, problemId(req)],
  );
  if (!saved) return res.status(404).json({ error: "Problem not found." });
  res.json(saved);
});

app.delete("/api/problems/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM problems WHERE id = $1", [problemId(req)]);
  res.status(204).end();
});

// ---------- progress (per user) ----------

app.get("/api/progress", requireAuth, async (req, res) => {
  const rows = await all("SELECT problem_id, solved_on, note FROM progress WHERE user_id = $1", [req.user.id]);
  const done = {};
  const notes = {};
  for (const r of rows) {
    if (r.solved_on) done[r.problem_id] = { on: r.solved_on };
    if (r.note) notes[r.problem_id] = r.note;
  }
  res.json({ done, notes });
});

// Body: { done?: boolean, note?: string }. Omitted fields are left unchanged.
app.put("/api/progress/:problemId", requireAuth, async (req, res) => {
  const pid = problemId(req);
  if (!pid || !(await one("SELECT 1 FROM problems WHERE id = $1", [pid])))
    return res.status(404).json({ error: "Problem not found." });

  const cur = (await one("SELECT solved_on, note FROM progress WHERE user_id = $1 AND problem_id = $2", [
    req.user.id,
    pid,
  ])) || { solved_on: null, note: "" };
  let solvedOn = cur.solved_on;
  if (req.body?.done === true && !solvedOn)
    solvedOn = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (req.body?.done === false) solvedOn = null;
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : cur.note;

  if (!solvedOn && !note) {
    await pool.query("DELETE FROM progress WHERE user_id = $1 AND problem_id = $2", [req.user.id, pid]);
  } else {
    await pool.query(
      `INSERT INTO progress (user_id, problem_id, solved_on, note) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, problem_id) DO UPDATE SET solved_on = excluded.solved_on, note = excluded.note`,
      [req.user.id, pid, solvedOn, note],
    );
  }
  res.json({ done: solvedOn ? { on: solvedOn } : null, note });
});

// ---------- serve the built React app in production ----------

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(resolve(dist, "index.html")));
}

app.use((err, req, res, next) => {
  // Client errors from body parsing (bad JSON, body too large) carry their own status.
  if (err.status === 413) return res.status(413).json({ error: "That upload is too large." });
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: "Bad request." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

await initSchema();
const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
