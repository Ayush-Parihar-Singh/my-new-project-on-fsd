# Deployment guide

This guide covers a single-server or small-VM deployment: one Node.js process behind a TLS reverse proxy, one PostgreSQL 16 database, one persistent directory for private photos, and a scheduler for the expiry sweep. The same steps apply to a container platform if you mount the photo directory on a persistent volume.

## 1. Prerequisites

- Node.js **20.19 or newer** and npm.
- PostgreSQL **16** (PostGIS is optional and not required by the app).
- A domain with HTTPS termination (Caddy, nginx, or your platform's load balancer).
- A persistent disk path for `STORAGE_DIR`, backed up like the database.
- Optional: an SMTP account for real email, and an OpenAI-compatible API key for AI features.

## 2. Environment

Create the environment from `.env.example` and keep it out of version control. Use your platform's secret store where possible.

| Variable | Production value |
|---|---|
| `APP_URL` | `https://your-domain.example` (exact public origin, no trailing slash) |
| `APP_ENV` | `production` |
| `APP_SECRET` | 32+ random characters, for example `openssl rand -base64 48`. Keep it stable: changing it hides existing handover codes. |
| `CRON_SECRET` | 16+ random characters, for example `openssl rand -hex 24` |
| `DATABASE_URL` | Pooled connection string used by the app |
| `DIRECT_URL` | Direct (non-pooled) connection string used by migrations |
| `SECURE_COOKIES` | `true` (also forced on when `APP_ENV=production`) |
| `STORAGE_DIR` | Absolute path on a persistent disk, outside the repository and `public/` |
| `MAX_UPLOAD_MB` | `5` unless you have a reason to change it (maximum 10) |
| `SMTP_*`, `EMAIL_FROM` | Your mail provider. Leave `SMTP_HOST` empty to keep messages in `OutboundEmail` only. |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Optional. Leave `AI_API_KEY` empty to run on the rule-based fallbacks. |
| `DEMO_PASSWORD` | Not used in production. The seed should not be run there. |

Startup fails with a clear message if a required value is missing or invalid. In production, the app also refuses the development `APP_SECRET` and a `CRON_SECRET` shorter than 16 characters.

## 3. Build and migrate

```bash
npm ci
npx prisma migrate deploy       # preferred where the Prisma schema engine can be downloaded
# or, in sealed networks:
npm run db:apply-sql            # applies prisma/migrations in order and records each one
npm run build
```

Run migrations as a separate step before starting the new version. Each applied migration is recorded, so running them again changes nothing.

**Do not run `npm run db:seed` in production.** The seed creates demo accounts with a known password. If you want a demo environment, use a separate database and a separate deployment.

## 4. Run the server

```bash
npm run start          # listens on 0.0.0.0:3000
```

Put the process behind a reverse proxy that terminates TLS and forwards `Host`, `X-Forwarded-Host` and `X-Forwarded-Proto`. The origin check on writes accepts the public origin named in `APP_URL` and the forwarded host, so a misconfigured host header causes write requests to fail with `FORBIDDEN_ORIGIN`.

Example Caddyfile:

```
your-domain.example {
  reverse_proxy 127.0.0.1:3000
}
```

Example systemd unit:

```ini
[Unit]
Description=LastPlate web
After=network-online.target postgresql.service

[Service]
WorkingDirectory=/srv/lastplate
EnvironmentFile=/etc/lastplate/lastplate.env
ExecStart=/usr/bin/npm run start
Restart=on-failure
User=lastplate

[Install]
WantedBy=multi-user.target
```

## 5. Expiry sweep

Listings must expire and reminders must go out even when nobody is using the site. Schedule one of the following. Both are idempotent.

**Option A: scheduler calls the endpoint** (simplest, works with any cron service)

```bash
# every 5 minutes
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain.example/api/cron/expire
```

`GET /api/cron/expire` returns 405 by design, so only POST with the secret runs the sweep.

**Option B: long-running worker** on the same host

```bash
npm run worker:expire           # loops every few minutes
npm run worker:expire -- --once # single run, for testing
```

Each item is processed in its own transaction, so one failing listing does not stop the rest.

## 6. Storage

- Photos are written under `STORAGE_DIR` with random keys and served only through `GET /api/files/photos/:id`, which applies the same visibility rules as the donation.
- Back up `STORAGE_DIR` together with the database. A database restore without the photos leaves broken references.
- If you replace the disk adapter with an object store, keep the bucket private, and keep serving bytes through the authorised route rather than public URLs.

## 7. Health and checks after deploy

1. `GET /` returns 200, and the landing page loads.
2. Sign in as a test admin, open **Analytics**, and confirm the numbers load.
3. Confirm that `Set-Cookie` for `lp_session` includes `HttpOnly`, `Secure` and `SameSite=Lax`.
4. Confirm that a write from another origin is refused with 403.
5. Run the expiry sweep once with `--once` and confirm it reports no errors.
6. If AI is enabled, sign in as a donor and request a listing suggestion. The UI should say which source produced it.

## 8. Operations

- **Logs**: errors are logged as JSON lines with a `requestId`. Shipping them to your log store is recommended.
- **Rate limits** are held in memory per process. Run a single instance, or move `src/lib/rate-limit.ts` to a shared store before scaling out.
- **Email**: with SMTP configured, emails are sent after the database transaction commits. Each send is recorded in `OutboundEmail` as `SENT` or `FAILED` (with the error), and failures are logged. There is no automatic retry. Without SMTP, messages are recorded as `LOGGED`.
- **Audit**: the audit log is append-only in the application. Restrict database access to the admin role to keep it that way.
- **Upgrades**: deploy the code, run migrations, restart. Keep `APP_SECRET` and the storage directory unchanged.

## 9. Security checklist

- [ ] `APP_ENV=production`, `SECURE_COOKIES=true`, HTTPS only.
- [ ] `APP_SECRET` and `CRON_SECRET` are random and stored in a secret store.
- [ ] The database is not reachable from the public internet.
- [ ] `STORAGE_DIR` is outside the web root and has restricted file permissions.
- [ ] The seed has not been run against this database.
- [ ] Backups cover both the database and `STORAGE_DIR`, and a restore has been tested.
- [ ] The admin accounts are real people with strong passwords, and the verification queue is staffed.
