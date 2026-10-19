import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { one, pool } from "./db.js";

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

export function checkPassword(password, salt, hash) {
  const a = scryptSync(password, salt, 64);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO sessions (token, user_id, created) VALUES ($1, $2, $3)", [token, userId, Date.now()]);
  return token;
}

export function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    isAdmin: !!u.is_admin,
    name: u.name || "",
    avatar: u.avatar || null,
    email: u.email || "",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns a lower-cased email, "" if blank, or null if it isn't a valid address.
export function readEmail(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!v) return "";
  return v.length <= 254 && EMAIL_RE.test(v) ? v : null;
}

// Everything the profile page shows and edits.
export function fullProfile(u) {
  return {
    ...publicUser(u),
    education: u.education || "",
    location: u.location || "",
    bio: u.bio || "",
    links: u.links || {},
    created: u.created,
  };
}

export async function requireAuth(req, res, next) {
  const m = /^Bearer (\w+)$/.exec(req.get("authorization") || "");
  const user =
    m && (await one("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1", [m[1]]));
  if (!user) return res.status(401).json({ error: "Please sign in." });
  req.user = user;
  req.token = m[1];
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: "Only admins can do that." });
  next();
}
