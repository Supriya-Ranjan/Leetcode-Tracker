# LeetCode Tracker

A shared LeetCode practice tracker for a group. Admins curate a list of problems; every member ticks off what they've solved, keeps private notes per problem, and sees their progress by difficulty.

**Live app:** https://leetcode-tracker-02sf.onrender.com/

> Hosted on Render's free tier, so the first visit after a quiet spell can take 30–60 seconds while it wakes up.

- **React** (Vite) frontend in [`client/`](client/)
- **Node.js** (Express 5) API in [`server/`](server/)
- **Postgres** database, hosted on [Supabase](https://supabase.com)

## Features

- **Problem list**: title, LeetCode number, difficulty, data structure, pattern, and a link to solve it.
- **Progress**: mark problems solved (with the date), see overall and per-difficulty progress, filter by status, difficulty, data structure or pattern.
- **Notes**: each user keeps their own note per problem (approach, complexity, mistakes). Other users never see them.
- **Profiles**: name, education, location, bio, profile picture, and links (GitHub, LinkedIn, LeetCode, X, website). Users can change their password.
- **Forgot password**: "Forgot password?" on the sign-in screen emails a one-time reset link (valid 30 minutes).
- **Roles**: everyone who signs up is a **member**. **Admins** can add, edit and delete problems, see all users, and promote or demote them.

| | Member | Admin |
|---|:-:|:-:|
| View problems, track progress, write notes | ✓ | ✓ |
| Edit own profile and password | ✓ | ✓ |
| Add / edit / delete problems | | ✓ |
| See all users, change roles | | ✓ |

Permissions are enforced by the API, not just hidden in the UI.

## Getting started

### Requirements

- Node.js **22.13 or newer** (`node -v`)
- A Supabase project, or any Postgres database

### 1. Install

```bash
npm run install:all
```

This installs the root, `server/` and `client/` dependencies.

### 2. Connect the database

```bash
cp server/.env.example server/.env
```

In Supabase, open your project, click **Connect**, and copy the **Session pooler** connection string. Paste it into `server/.env` as `DATABASE_URL`, with your database password in place of `[YOUR-PASSWORD]`.

> **Use the Session pooler, not "Direct connection".** The direct host is IPv6-only and fails on most home networks and many hosts.
>
> If your password contains `@`, `#`, `/`, `?` or `:`, URL-encode those characters (for example `@` → `%40`), or reset the password to letters and numbers.

The server creates its tables on startup, so there are no migrations to run.

### 3. Run

```bash
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:4000 (Vite proxies `/api` to it)

The API restarts on changes via nodemon; the React app hot-reloads.

### 4. Make yourself admin

Sign up in the app, then:

```bash
npm run make-admin <your-username>
```

After that, you can promote other users from the **Members** tab.

## Scripts

Run from the project root:

| Command | What it does |
|---|---|
| `npm run install:all` | Install all dependencies |
| `npm run dev` | Start API and React dev server together |
| `npm run build` | Build the React app into `client/dist` |
| `npm start` | Start the API in production mode (also serves `client/dist`) |
| `npm run make-admin <username>` | Promote an existing account to admin |

## Configuration

Set in `server/.env` locally, or as environment variables when deployed:

| Variable | Required | Description |
|---|:-:|---|
| `DATABASE_URL` | ✓ | Postgres connection string |
| `PORT` | | API port (default `4000`) |
| `BREVO_API_KEY` | for emails | [Brevo](https://www.brevo.com) API key, used to send password reset emails |
| `MAIL_FROM` | for emails | Sender address, verified in Brevo |
| `MAIL_FROM_NAME` | | Sender name (default `LeetCode Tracker`) |
| `APP_URL` | | Public URL used in reset links. Defaults to Render's `RENDER_EXTERNAL_URL`, else `http://localhost:5173` |

Without `BREVO_API_KEY` and `MAIL_FROM`, reset links are printed in the server log instead of emailed, which is enough for local development. Email goes through Brevo's HTTPS API rather than SMTP because Render's free tier blocks outbound SMTP ports.

## Project structure

```
├── client/                 React app (Vite)
│   └── src/
│       ├── App.jsx           Auth gate: login screen or tracker
│       ├── Login.jsx         Sign in / sign up
│       ├── Tracker.jsx       Header, tabs, problem list
│       ├── ProblemForm.jsx   Add / edit a problem (admin)
│       ├── Members.jsx       User list and roles (admin)
│       ├── Profile.jsx       Profile details and password change
│       ├── Avatar.jsx, PasswordInput.jsx
│       ├── api.js            Fetch wrapper for the API
│       └── constants.js      Difficulties, data structures, patterns
├── server/                 Express API
│   ├── src/
│   │   ├── index.js          Routes
│   │   ├── auth.js           Password hashing, sessions, auth middleware
│   │   └── db.js             Postgres pool and schema
│   └── scripts/make-admin.js
└── package.json            Root scripts
```

## API

All endpoints except register and login need an `Authorization: Bearer <token>` header.

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/api/auth/register` | anyone | Create an account `{ username, email, password }` |
| POST | `/api/auth/login` | anyone | Sign in `{ username, password }` (username or email) → `{ token, user }` |
| POST | `/api/auth/forgot` | anyone | Email a reset link `{ email }`; same response whether or not the account exists |
| POST | `/api/auth/reset` | anyone | Set a new password `{ token, password }`; signs out all sessions, returns `{ token, user }` |
| POST | `/api/auth/logout` | user | End the current session |
| GET | `/api/me` | user | Current user |
| GET | `/api/profile` | user | Own full profile |
| PUT | `/api/profile` | user | Update profile `{ name, education, location, bio, links, avatar }` |
| PUT | `/api/profile/password` | user | Change password `{ current, next }`; signs out other sessions |
| GET | `/api/problems` | user | All problems |
| POST | `/api/problems` | admin | Add a problem |
| PUT | `/api/problems/:id` | admin | Edit a problem |
| DELETE | `/api/problems/:id` | admin | Delete a problem (and everyone's progress on it) |
| GET | `/api/progress` | user | Own progress `{ done, notes }` |
| PUT | `/api/progress/:problemId` | user | Update own progress `{ done?, note? }` |
| GET | `/api/users` | admin | All users with solved counts |
| PATCH | `/api/users/:id` | admin | Change role `{ isAdmin }` |

## Database

Four tables, created automatically by [`server/src/db.js`](server/src/db.js):

- `users`: account, role and profile fields. Passwords are hashed with scrypt and a per-user salt.
- `sessions`: login tokens.
- `password_resets`: pending reset links. Only a SHA-256 hash of each token is stored.
- `problems`: the shared problem list.
- `progress`: one row per user per problem (solved date and note).

Row-level security is enabled on every table with no policies. This blocks Supabase's public REST API from reading them; the server connects as the database owner, which bypasses RLS.

Profile pictures are cropped to 256×256 in the browser and stored in the `users` table as small JPEG data URLs, so no file storage is needed.

## Deployment

The API serves the built React app, so it deploys as a single Node.js web service. For example, on [Render](https://render.com) or [Railway](https://railway.com):

| Setting | Value |
|---|---|
| Build command | `npm run install:all && npm run build` |
| Start command | `npm start` |
| Environment | `DATABASE_URL` (the same Session pooler string), plus `BREVO_API_KEY` and `MAIL_FROM` for reset emails |

No persistent disk is needed; all data lives in Supabase.

## Legacy version

`index.html`, `app.js` and `styles.css` in the project root are the original single-page version, built to run as a claude.ai artifact (with a localStorage fallback when opened directly). The React app doesn't use them.
