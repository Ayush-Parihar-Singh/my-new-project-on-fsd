# LastPlate

**Good Food Deserves Another Chance.** LastPlate is a food rescue platform that connects restaurants, hotels, cafés, hostels and event organisers (donors) with verified nonprofits, shelters and community kitchens (recipients), and with volunteers who move the food. Every handover is recorded: who did what, when, and in what state.

The app is a single Next.js 16 (App Router) codebase with a PostgreSQL database. It runs locally with one database and one process, and it is structured so the services can be split out later.

- **Donor**: posts surplus food with a three-step form, drafts and edits listings, confirms recipients, cancels, and watches the status.
- **Recipient (NGO)**: finds food on a map, ranked by fit, requests it, and shows the handover code at pickup.
- **Volunteer**: accepts pickups within their radius, collects, completes the handover with the recipient's 4-digit code, or reports a problem.
- **Admin**: verifies organisations, suspends users, moderates listings and duplicates, reviews analytics and AI-assisted insights, and reads the audit log.

Full deployment steps are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). The architecture is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Contents

1. [Quick start](#quick-start)
2. [Demo accounts](#demo-accounts)
3. [Configuration](#configuration)
4. [Database: migrations and seed](#database-migrations-and-seed)
5. [Running the app](#running-the-app)
6. [Tests](#tests)
7. [Scripts](#scripts)
8. [What is built](#what-is-built)
9. [Security and privacy](#security-and-privacy)
10. [AI features and their limits](#ai-features-and-their-limits)
11. [Known limitations](#known-limitations)

---

## Quick start

Requirements: **Node.js 20.19 or newer**, npm, and **PostgreSQL 16** (PostGIS is optional; the docker image includes it).

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Start PostgreSQL (or point DATABASE_URL at your own server)
docker compose up -d db

# 3. Configure
cp .env.example .env          # then edit APP_SECRET and CRON_SECRET for anything beyond local use

# 4. Create the schema and demo data
npm run db:apply-sql          # applies prisma/migrations in order (see note below)
npm run db:seed               # fictional demo organisations, donations and history

# 5. Run
npm run dev                   # http://localhost:3000
```

Open http://localhost:3000, then sign in with one of the [demo accounts](#demo-accounts).

> **Migrations.** `npm run db:apply-sql` applies the SQL migrations in `prisma/migrations` and records each one. It works in sandboxes where Prisma cannot download its schema engine. Where it can, `npx prisma migrate deploy` does the same job and is the usual choice in CI and production.

## Demo accounts

The seed creates clearly labelled demo accounts. All of them use the password in `DEMO_PASSWORD` (default `LastPlate-Demo-2026`). Demo records are flagged `isDemo`, shown with a "Demo" label in the UI, and counted separately in analytics. None of the data refers to real people or organisations.

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@lastplate-demo.test` | Verification queue, moderation, users, analytics, audit |
| Donor | `kitchen@spiceroute.lastplate-demo.test` | Verified restaurant with active and completed listings |
| Recipient | `intake@ashanightshelter.lastplate-demo.test` | Verified shelter that can claim food |
| Volunteer | `ravi@lastplate-demo.test` | Verified volunteer with a service radius |

The seed also creates accounts awaiting verification, so the admin queue has items to review.

The seed is **idempotent**. Running `npm run db:seed` a second time prints "Demo data already present" and changes nothing. `npm run db:seed -- --reset` rebuilds only the demo rows and leaves real data alone.

## Configuration

All settings come from environment variables, validated at startup by `src/lib/env.ts`. [`.env.example`](.env.example) documents each one.

| Variable | Required | Purpose |
|---|---|---|
| `APP_URL` | yes | Public base URL. Also used by the origin check on writes. |
| `APP_ENV` | yes | `development`, `production` or `test`. Production refuses insecure defaults. |
| `APP_SECRET` | yes | Encrypts handover codes at rest. Use 32+ random characters. |
| `CRON_SECRET` | for the expiry job | Bearer token for `POST /api/cron/expire`. |
| `DATABASE_URL`, `DIRECT_URL` | yes | PostgreSQL connection strings. |
| `SESSION_TTL_DAYS`, `SECURE_COOKIES` | no | Session lifetime and cookie flags. |
| `STORAGE_DIR`, `MAX_UPLOAD_MB` | no | Private photo storage path and upload limit (default 5 MB). |
| `SMTP_*`, `EMAIL_FROM` | no | Real email. Without SMTP, emails are stored as `OutboundEmail` rows. |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_TIMEOUT_MS` | no | Enables the AI features. Without a key, rule-based fallbacks run. |
| `DEMO_PASSWORD` | no | Password for the seeded demo accounts. |

Keys are read only on the server. No secret is sent to the browser, and no `NEXT_PUBLIC_` variables are used.

## Database: migrations and seed

| Command | What it does |
|---|---|
| `npm run db:apply-sql` | Applies `prisma/migrations/*/migration.sql` in order, using a tracking table. |
| `npx prisma migrate deploy` | Standard Prisma migration deploy (needs the Prisma schema engine). |
| `npm run db:seed` | Creates demo data. Idempotent. |
| `npm run db:seed -- --reset` | Deletes and rebuilds demo rows only. |
| `npm run db:reset` | Drops the `public` schema and re-applies migrations. **Development only**; refuses `production`. |
| `npm run db:generate` | Regenerates the Prisma client into `src/generated/prisma`. |

The domain has these main tables: `User`, `Session`, `Organization`, `VolunteerProfile`, `VerificationRequest`, `Donation`, `DonationEvent` (status history), `DonationPhoto`, `Delivery`, `Report`, `Notification`, `AuditLog`, `OutboundEmail`, `PasswordReset`.

## Running the app

```bash
npm run dev         # development server on 0.0.0.0:3000
npm run build       # production build (runs prisma generate, then next build)
npm run start       # serve the production build on 0.0.0.0:3000
npm run worker:expire -- --once   # run the expiry sweep once, then exit
npm run worker:expire             # run the expiry sweep every few minutes
```

The expiry sweep marks unclaimed listings past their deadline as `EXPIRED`, marks confirmed but uncollected handovers as `FAILED_HANDOVER`, and sends one deadline reminder per listing. It is safe to run repeatedly. In production, either run the worker or call `POST /api/cron/expire` with `Authorization: Bearer $CRON_SECRET` from your scheduler. See the deployment guide.

## Tests

The suite has 97 tests in 7 files. The integration tests run against a real PostgreSQL database whose name ends in `_test`. The reset helper refuses any other name, so tests cannot wipe `lastplate`.

```bash
# one-time: create and migrate the test database
createdb lastplate_test     # or: psql -c 'CREATE DATABASE lastplate_test'
DATABASE_URL=postgresql://postgres@localhost:5432/lastplate_test npm run db:apply-sql

npm test                    # everything (unit + integration)
npm run test:unit           # pure logic: validation, visibility, duplicates, matching, state machines
npm run test:integration    # database: auth, permissions, lifecycle, concurrency, expiry, AI fallbacks, analytics
npx tsc --noEmit            # typecheck
```

Override the database with `TEST_DATABASE_URL`. The integration files run one at a time (`fileParallelism: false`) because they share a database.

What the tests cover:

- **Auth**: registration, hashed sessions and cookies, login with a generic error for unknown emails, logout, suspended users, password reset (single-use, revokes all sessions).
- **Permissions**: role checks on every sensitive operation, ownership checks, and visibility of exact addresses and contacts by relationship.
- **Creation**: draft save with optimistic versioning, publish readiness, duplicate detection and the "publish anyway" acknowledgement.
- **Concurrency**: six simultaneous claims on one listing produce one winner; four volunteers accepting one task produce one winner.
- **Lifecycle**: cancellation with notifications, confirm and decline, withdrawal, handover codes, delivery transitions, release, failed handovers.
- **Expiration**: unclaimed listings expire exactly once; a second sweep is a no-op; one reminder per listing.
- **Analytics**: live counts, labelled demo data, success rate.
- **AI**: the rule-based fallbacks, refusal to judge food safety, insights built only from database metrics.

## Scripts

| Script | Purpose |
|---|---|
| `dev`, `build`, `start` | Run and build the app |
| `typecheck` | `tsc --noEmit` |
| `test`, `test:unit`, `test:integration` | Test suites |
| `db:apply-sql`, `db:seed`, `db:reset`, `db:reset-demo`, `db:generate`, `db:migrate`, `db:migrate:dev` | Database |
| `worker:expire` | Expiry sweep worker |

## What is built

**Public**
- Landing page with the hero, "Donate Surplus Food" and "Find Food Near Me" calls to action, How It Works, featured open donations, impact figures from the database (demo data labelled), partners, and footer.
- Discovery at `/discover`, open to visitors without signing in. It has a Leaflet and OpenStreetMap map, filters, and sort options. Public locations are approximate.

**Accounts**
- Register with a role, log in, log out, password recovery, protected routes, role-based onboarding, and an organisation verification workflow.

**Donor**
- Dashboard with active listings, pending requests, confirmed pickups, completed handovers, a 14-day trend, and "Post a Donation".
- Three-step donation form: food details and photos; pickup address, pin on map, window, deadline and handling; review and publish. Drafts save with versioning. An AI listing assistant suggests fields that the donor must review and apply.
- Edit, cancel, publish, and the status history for each donation.

**Recipient**
- Dashboard with nearby donations, pending claims, confirmed collections, and best-match ranking from the organisation's location, capacity, receiving hours, dietary needs and volunteer coverage.
- Claims page, request and withdraw, and the handover code visible only once the donor has confirmed.

**Volunteer**
- Delivery board: available pickups within radius, accepted tasks with exact pickup instructions and donor contact, mark picked up, release, complete with the 4-digit code, report a problem. Contribution history.

**Admin**
- Operations overview, verification queue (approve or reject with a note), user search with suspend and reactivate (reason required), moderation queues (possible duplicates, reports, removals), analytics with a time range, AI or rule-based insights, and the audit log.

**Shared**
- Notifications with unread counts and mark-as-read. Email when SMTP is configured.
- Contextual assistant in the app. It answers questions about the platform from its rule set (with the model when configured) and never judges whether food is safe.

## Security and privacy

- **Passwords** are hashed with bcrypt. Unknown emails take the same time and return the same message, so the response does not reveal which accounts exist.
- **Sessions** are opaque random tokens. Only a hash is stored. The cookie is `httpOnly`, `SameSite=Lax`, and `Secure` over HTTPS. Suspension and password reset revoke sessions.
- **Authorization** is enforced in the services on every request, not only in the UI. The edge proxy adds a fast check for protected pages and an origin check on writes.
- **Rate limits** apply to login, registration, password recovery, handover-code attempts, and all writes.
- **Private data**: exact pickup addresses and contacts are shown only to the donor, a confirmed recipient, or the assigned volunteer. Public locations are moved 100 to 350 m, deterministically per listing.
- **Photos** are validated by their file signature (JPEG, PNG or WebP), not the browser's type. They are stored under random keys outside `public/` and served only through an authorised route. Anyone without access gets a 404.
- **Handover codes** are stored as a hash for checking and encrypted for display (AES-GCM, keyed from `APP_SECRET`).
- **Audit**: every admin decision writes an audit entry with the actor, IP address and reason.
- **Headers**: a Content-Security-Policy, frame and referrer policies, and `nosniff` are set in `next.config.ts`.
- **Errors** go through one handler that returns a stable code and message, and logs a request ID. Stack traces are not sent to users.

## AI features and their limits

LastPlate does not use AI to judge food. Photos are not checked for safety, freshness or edibility, and the app says so wherever it offers AI help.

| Feature | With `AI_API_KEY` | Without it (fallback) |
|---|---|---|
| Listing assistant | Drafts a title, category, description and dietary tags from text and photos | A rule-based draft from the text. Allergens to check are flagged. |
| Smart matching | Not AI. Ranks listings by distance, quantity, deadline, capacity, dietary fit, receiving hours and volunteer coverage. | Same |
| Duplicate detection | Not AI. Compares the same donor's listings in the last 72 hours by title, description, location and time. It flags for review and never blocks silently. | Same |
| Impact insights | Summarises aggregate database metrics and suggests improvements | A summary built from fixed rules over the same numbers |
| Assistant | Answers questions about the platform, using the platform rules as its only source. It never judges food safety. | Answers from the curated rule set |

Insights are built from aggregate counts only, and no personal data is sent to the model. The model is told to use only the numbers provided. If the model call fails or times out, the rule-based result is returned, and the UI says which one is shown.

## Known limitations

- **PostGIS** is optional and not required. Distances are computed in the application (haversine), which is accurate enough at city scale. The schema does not depend on PostGIS.
- **Rate limits** are in memory and per process. Run one instance, or move the limiter to Redis before scaling out.
- **Notifications** are read when a page loads and after each action; there is no live push. Email is sent only when SMTP is configured, and failed sends are recorded as `FAILED` without automatic retry.
- **Photo storage** is a local directory. Use a persistent volume with backups in production, or replace `src/server/integrations/storage.ts` with an object store that keeps files private.
- **Prisma CLI** downloads its engines on first use. In sealed networks, use `npm run db:apply-sql` and pre-fetch the engines.
- **Changing `APP_SECRET`** makes existing encrypted handover codes unreadable. Those codes are then hidden, and the handover must be verified another way. Keep the secret stable.
- **Accessibility** has been designed in (labels, error association, focus states, keyboard navigation), but a formal audit with assistive technology has not been run.
- **Map tiles** come from the public OpenStreetMap tile servers. They are subject to OSM's usage policy. For high traffic, use a tile provider with a key.

## Repository layout

```
src/
  app/                 Routes: (marketing) public, (auth), (app) protected, api/ route handlers
  components/          ui (primitives), layout, forms, dashboards, donations, deliveries, discover,
                       maps, charts, admin, notifications, profile, assistant, home
  domain/              Pure rules: donation and delivery state machines, visibility, duplicates, matching, geo
  server/
    auth/              Sessions, guards (requireUser, requirePageUser, requireVerified)
    services/          Business logic (donation, claim, delivery, discovery, admin, analytics, AI, photos)
    repositories/      Database access (Prisma)
    integrations/      Email, storage, AI client
  validation/          Zod schemas shared by forms and API routes
  lib/                 env, db, http helpers, errors, crypto, rate limit, nav, client fetch wrapper
prisma/                schema, SQL migrations, seed
scripts/               migration runner, expiry worker, dev reset
tests/                 unit and integration tests
docs/                  deployment and architecture
```
