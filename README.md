# The Learning Steps Pre School portal

Small, database-backed parent portal with an authenticated admin area.

## Run locally

1. Copy `.env.example` to `.env` and set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a random `SESSION_SECRET`.
2. Run `node server.js` (Node 22.5+ is required for built-in SQLite).
3. Open `http://localhost:3000`. The admin login is at `/admin`.

The first launch creates `data/portal.db`, creates the configured admin account with an `scrypt` password hash, and adds clearly marked demo classes/content. Later, sign in and use **Change password** from the dashboard. Changing `ADMIN_PASSWORD` in `.env` does not overwrite an existing password, which prevents accidental resets.

## Included security controls

Admin-only API authorization, HTTP-only signed session cookies, SameSite cookies, origin checks for state-changing requests, scrypt password hashing, parameterized SQLite queries, server-side validation, response security headers, and no public write endpoints except validated enquiries.

Attachments are intentionally represented in the assignment data model but upload handling is deferred for this focused first version. This avoids exposing an insecure public file store; add a validated private object/file store when attachments are needed.
