# Crieff Angling Club — website & booking platform

Public website, online permit booking and club administration for
[Crieff Angling Club](https://www.crieffanglingclub.org.uk): three beats on the
River Earn and Drummond Loch, Perthshire.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · PostgreSQL on
Supabase (Auth, Storage, RLS) · Stripe Checkout · Resend · Vercel.

- `docs/DEPLOYMENT.md` — step-by-step setup of Supabase, Stripe, Resend and Vercel
- `docs/PROJECT_NOTES.md` — what was taken from the old site, assumptions,
  **items the committee must confirm**, keys, and remaining tasks

## What it does

**Visitors** see the waters, beats, seasons, prices and rules; pick a date on a
live-availability calendar; choose water → beat → permit; see exactly how many
permits are left; enter their details; accept the relevant rules; pay by card
(Stripe Checkout); and receive a digital permit (web + PDF) with a QR code per
angler. Club officials scan the QR to check validity. Anglers can submit catch
returns, apply for membership and keep an account.

**Administrators** get a dashboard (today's permits, upcoming, revenue,
membership), a searchable/filterable bookings table with CSV export, booking
detail with resend/cancel/refund/edit, manual (phone/in-person) bookings, a
capacity calendar with block/unblock and per-day capacity, and editors for
waters, beats, permit types & price periods, availability, boats, seasons,
rules, membership (applications, offers, members), news, gallery, pages,
settings, users & roles, catch returns, messages, email log and audit log.

## Architecture

```
src/
  app/(hero)/…        public pages with a full-bleed hero (statically rendered, revalidated every 5 min)
  app/(site)/…        booking, account, permits, forms, legal pages
  app/admin/…         admin (server-rendered, role-checked on every request and action)
  app/api/…           availability API, Stripe webhook, daily housekeeping cron
  lib/booking/        engine.ts (pure availability rules) · service.ts (holds, payment, refunds) · webhook.ts
  lib/permits/        permit loading, QR verification, PDF generation
  lib/email/          templates, Resend sender (logged), lifecycle notifier
  lib/admin/          declarative CRUD resources, admin actions
supabase/migrations/  schema, integrity functions/triggers, RLS policies
supabase/seed.sql     club data from the old site (flagged where unconfirmed)
tests/                vitest unit + PostgreSQL integration tests
```

### Booking integrity

- All prices, seasons, limits and rules are evaluated **server-side** by one pure
  engine (`lib/booking/engine.ts`) shared by the calendar, the booking step and checkout.
- A booking is inserted as `pending` inside a transaction holding a per-beat/day
  advisory lock; a **database trigger** independently rejects any write that would
  exceed capacity, and a **unique index** makes double-booking a boat impossible.
- Pending holds count toward capacity only until they expire, so abandoned
  checkouts never consume availability.
- Stripe webhooks are recorded by event id; every state transition is idempotent,
  and each email is sent once via atomic "claims".
- States: `pending → paid → (cancelled | refunded)`, or `pending → failed | cancelled`.

## Development

Requires Node 20.9+ and PostgreSQL (local Postgres works — a minimal Supabase
`auth` shim is applied automatically when not running on Supabase).

```bash
npm install
cp .env.example .env.local                      # set DATABASE_URL
DATABASE_URL=postgres://postgres@localhost:5432/crieff_dev npm run db:seed
npm run dev                                     # http://localhost:3000
npm test                                        # needs Postgres at localhost:5432
npm run typecheck && npm run lint && npm run build
```

| Script | |
|---|---|
| `npm run db:migrate` | apply pending migrations to `DATABASE_URL` |
| `npm run db:seed` | migrations + seed (only seeds an empty database) |
| `npm run db:reset` | **local only**: drop and rebuild the public schema |
| `npm run admin:create -- email` | make an existing account an admin |
| `node scripts/crawl.mjs`, `scripts/e2e-admin.mjs`, `scripts/e2e-book.mjs` | local browser checks (need `E2E_AUTH_BYPASS=1`, dev only) |
