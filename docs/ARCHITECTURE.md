# Architecture

LastPlate is one Next.js 16 application (App Router, React 19, TypeScript). Its layers are separated so that business rules can be tested without a browser or a database, and so the database can be swapped without touching the UI.

```
Browser ──► proxy.ts (edge: session redirect, origin check, write throttle)
              │
              ├─► app/(marketing), app/(auth), app/(app)   Server Components render pages
              │       └─ client islands: forms, map, board, sidebar, charts
              │
              └─► app/api/*   Route Handlers (thin: parse, call service, return JSON)
                      │
                      ▼
                 server/services/*   Business logic and authorization
                      │       │
                      │       └─► domain/*   Pure rules (state machines, visibility, matching, duplicates, geo)
                      ▼
                 server/repositories/*   Prisma queries only
                      │
                      ▼
                 PostgreSQL (Prisma 7, @prisma/adapter-pg)

 server/integrations/*   Email (SMTP or outbox), private storage (disk), AI (OpenAI-compatible, optional)
```

## Layers

| Layer | Location | Responsibility | May import |
|---|---|---|---|
| Presentation | `src/app` (pages), `src/components` | Render and collect input. No direct database access. | services (server pages), `lib/client` (client) |
| Route handlers | `src/app/api` | HTTP shape, `apiRoute` wrapper, `readJson` and `parseQuery` validation, status codes | services, validation |
| Services | `src/server/services` | Use cases, transactions, authorization, notifications | domain, repositories, integrations, validation |
| Domain | `src/domain` | Pure functions: `donation-state`, `delivery-state`, `visibility`, `matching`, `duplicates`, `geo` | nothing from the app |
| Repositories | `src/server/repositories` | Prisma queries, row locks (`SELECT … FOR UPDATE`) | `lib/db` |
| Validation | `src/validation` | Zod schemas shared by forms and API routes | Zod |
| Integrations | `src/server/integrations` | Email, storage, AI | `lib/env` |
| Cross-cutting | `src/lib` | env, db client, errors, crypto, rate limit, http, nav, formatting | none |

## Key decisions

**Donation lifecycle.** A donation moves through `DRAFT → AVAILABLE → REQUESTED → CONFIRMED → PICKUP_IN_PROGRESS → COMPLETED`, with `REJECTED`, `CANCELLED`, `EXPIRED` and `FAILED_HANDOVER` as outcomes. The transition table lives in `domain/donation-state.ts`. Each transition locks the row, checks the current state, updates with a guard on the expected status, appends a `DonationEvent`, and writes notifications in the same transaction. The `Donation.version` column supports optimistic concurrency for edits.

**No double claims.** A claim is a conditional update inside a transaction: the row must still be `AVAILABLE` with no claimant. Two simultaneous claims give one winner and one `409 ALREADY_CLAIMED`. The same pattern governs volunteer acceptance, through the `Delivery` row, which has its own version. The lock order is always donation, then delivery, to avoid deadlocks.

**Delivery lifecycle.** `OPEN → ASSIGNED → PICKED_UP → DELIVERED`, with `FAILED` and release paths. Accepting a task moves the donation to `PICKUP_IN_PROGRESS`. Releasing returns both to their previous states. A failure report sets the donation to `FAILED_HANDOVER`.

**Handover code.** A 4-digit code is generated when the donor confirms a claim. The server keeps a hash for verification and an AES-GCM ciphertext for display. Only the claimant sees the code, and only while the handover is confirmed or in progress. Completion attempts are rate-limited per volunteer and delivery.

**Visibility.** `domain/visibility.ts` decides what each viewer sees: `FULL` (owner or admin), `PARTICIPANT` (the claiming recipient from confirmation onward, or the assigned volunteer), or `PUBLIC` (area label and an approximate, deterministically jittered point). Services apply this on every read. The UI never decides what to hide.

**Expiry.** `services/expiration.service.ts` is idempotent. It runs before discovery when due, from the worker, or from the cron endpoint. Each item is one transaction, and failures are counted rather than thrown.

**Analytics.** Aggregates are computed in PostgreSQL at request time. Demo rows are counted separately and labelled. Success rate is `COMPLETED / (COMPLETED + FAILED_HANDOVER)`, so open listings do not count against it.

**Matching.** `domain/matching.ts` uses hard filters (service radius, 30-minute lead time, required dietary tags, avoided allergens) and then weights distance 30, deadline urgency 20, quantity fit 15, receiving hours 15 and volunteer coverage 20. Recipients see ranked results. Public viewers see unranked results with approximate points.

**Duplicates.** `domain/duplicates.ts` scores a new listing against the same donor's listings from the last 72 hours: 0.4 title similarity, 0.2 description similarity, 0.25 location, 0.15 time. A score over 0.75 blocks the first publish until the donor acknowledges it. Flags are reviewed in moderation.

**AI.** `services/ai.service.ts` calls an OpenAI-compatible endpoint only when `AI_API_KEY` is set. Each feature has a deterministic fallback, and the response states its source. Photos are read only for the donor who owns them, and only to build a draft. The system prompts forbid claims about food safety.

**Authentication.** Opaque 32-byte session tokens are stored as SHA-256 hashes. The cookie is `lp_session`. Guards in `server/auth/guards.ts` (`requireUser`, `requirePageUser`, `requireVerified`) run in each service, not only in pages.

**Notifications.** Written in the same transaction as the state change. The sidebar's unread count and the notification list are read on each page load and refreshed after actions; there is no live push. Emails are dispatched after commit and recorded in the outbox (`OutboundEmail`) as `SENT`, `FAILED` or `LOGGED`.

## Testing strategy

- `tests/unit`: pure domain and validation logic, with no database.
- `tests/integration`: services against PostgreSQL (`*_test` databases only). Covers auth flows, permissions, lifecycle, concurrency with parallel promises, expiry, AI fallbacks and analytics.

The tests set the environment in `tests/setup.ts` before the app loads, so `src/lib/env.ts` validates a test configuration.

## Extension points

- **Storage**: `src/server/integrations/storage.ts` is the only place that touches the file system.
- **Email**: `src/server/integrations/email.ts`. Add a provider here; the outbox semantics stay the same.
- **AI**: `src/server/integrations/ai.ts` is the OpenAI-compatible client.
- **Rate limits**: `src/lib/rate-limit.ts`. Replace the in-memory map with a shared store.
- **Real-time**: notifications are read on load. A push channel can be added behind `notification.service.ts`.
