// Promote an existing account to admin from the command line.
// Usage: npm run make-admin <username>
import { one, pool } from "../src/db.js";

const username = process.argv[2];
if (!username) {
  console.error("Usage: npm run make-admin <username>");
  process.exit(1);
}

const user = await one("UPDATE users SET is_admin = TRUE WHERE lower(username) = lower($1) RETURNING username", [
  username,
]);
console.log(user ? `${user.username} is now an admin.` : `No account named "${username}". Sign up first.`);
await pool.end();
process.exit(user ? 0 : 1);
