# Deployment guide

The site runs on **Vercel** (Next.js), with **Supabase** (PostgreSQL, Auth, Storage),
**Stripe** (payments) and **Resend** (email). Work through these steps in order.
Everything in the app degrades safely until each service is connected: without
Stripe the site refuses online payment with a clear message (it never fakes a
checkout), and without Resend emails are logged as "skipped".

---

## 1. Supabase

1. Create a project at <https://supabase.com> — region **London (eu-west-2)**.
2. **Apply the database schema.** Either:
   - *Supabase CLI:* `supabase link --project-ref <ref>` then `supabase db push`
     (applies `supabase/migrations/*`), then run `supabase/seed.sql` once in the SQL editor; or
   - *This repo's script:* `DATABASE_URL=<direct connection URI, port 5432> npm run db:seed`
     (applies migrations in order and seeds an empty database; safe to re-run).
3. **Auth** → *URL Configuration*:
   - Site URL: `https://www.crieffanglingclub.org.uk`
   - Redirect URLs: `https://www.crieffanglingclub.org.uk/auth/callback`
     (plus `https://*-<team>.vercel.app/auth/callback` if you want preview deployments to sign in)
4. **Auth** → *Providers* → Email: keep **Confirm email** ON (required — customer
   records are only linked to an account after the address is confirmed).
5. **Auth** → *SMTP*: set up custom SMTP (e.g. Resend's SMTP) so sign-in emails
   come from the club domain and aren't rate-limited by Supabase's default sender.
6. **Storage**: the migration creates a public bucket named `media` (images only,
   15 MB max). Check it exists under Storage.
7. Collect for Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` (same page — **server only, never expose**)
   - `DATABASE_URL` — **Transaction pooler** URI (port **6543**) from *Connect*.
8. Run **Advisors** (Database → Advisors) and confirm there are no RLS warnings.

### Row Level Security
Every table has RLS enabled. The anon key can read *published* content only; a
signed-in angler can read their own bookings/memberships/returns; admins get
full access; nobody can write through the public API. The Next.js server uses
the private `DATABASE_URL` connection and enforces permissions in code
(`src/lib/auth.ts`, every admin action calls `assertAdmin()`).

## 2. First admin

1. Deploy (step 5), then go to `/register` and create an account with the
   secretary's email. Confirm the email.
2. Grant admin: `DATABASE_URL=... npm run admin:create -- secretary@example.com`
   (or in the SQL editor: `update profiles set role = 'admin' where email = '…';`).
3. Further admins and bailiffs can then be added from **Admin → Settings → Users & roles**.

## 3. Stripe

1. Create/activate the club's Stripe account (UK, GBP). Complete business verification.
2. Developers → API keys → copy the **secret key** → `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → **Add endpoint**
   - URL: `https://www.crieffanglingclub.org.uk/api/stripe/webhook`
   - Events:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `checkout.session.expired`
     - `payment_intent.payment_failed`
     - `charge.refunded`
   - Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
4. Settings → Branding: add the club logo/colours (shown on Stripe Checkout).
5. **Test first** with `sk_test_…` keys and a test-mode webhook, card `4242 4242 4242 4242`.
   Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

How payment works: the booking is created as `pending` and holds the permits
for the checkout lifetime (30 min + grace). Stripe Checkout takes the card; the
webhook (and the success page, whichever is first) marks it `paid` —
idempotently — and sends the permit. Abandoned/expired checkouts release the
permits. Refunds from the admin panel go through Stripe; refunds made in the
Stripe dashboard are picked up by the `charge.refunded` webhook.

## 4. Resend (email)

1. Create a Resend account, add the domain `crieffanglingclub.org.uk`, and add the
   DNS records it gives you (SPF, DKIM, and ideally DMARC) at the domain registrar.
2. Create an API key → `RESEND_API_KEY`.
3. `EMAIL_FROM` must use the verified domain, e.g. `Crieff Angling Club <permits@crieffanglingclub.org.uk>`.
4. Set `EMAIL_REPLY_TO` to a mailbox someone reads, and `ADMIN_NOTIFICATION_EMAIL`
   (or set it in Admin → Settings) for new-booking notifications.

Emails sent: booking confirmation with PDF permit, payment receipt, cancellation,
refund, admin new-booking notification, membership application received /
offer / confirmed, contact-form notification. All are logged in Admin → Settings → Email log.

## 5. Vercel

1. Import the Git repository into Vercel (framework: Next.js; defaults are fine).
2. Add **all** variables from `.env.example` for *Production* (and *Preview* with
   test keys if you use previews). Generate `IP_HASH_SALT` and `CRON_SECRET` with
   `openssl rand -hex 32`.
3. Region: `vercel.json` pins functions to London (`lhr1`) — next to the Supabase database.
4. Deploy. Public pages are pre-rendered from the database when `DATABASE_URL`
   is set. If it is not set yet, the build uses an in-process copy of the seed
   data so the site can still be browsed. That copy is not durable: checkout,
   messages, catch returns and membership applications are refused until the
   real database is connected, and nothing is charged. Set `DATABASE_URL` and
   redeploy before taking bookings.
5. Domains: add `www.crieffanglingclub.org.uk` and redirect the apex domain to it.
   Update the DNS at the registrar as Vercel instructs.
6. **Cron**: `vercel.json` schedules `/api/cron/housekeeping` daily; Vercel sends
   `CRON_SECRET` automatically.
7. After go-live, update `NEXT_PUBLIC_SITE_URL`, the Supabase Site URL, and the
   Stripe webhook URL if the domain changed.

## 6. Go-live checklist

- [ ] Committee has reviewed every **"Needs confirmation"** item (Admin dashboard shows the count)
- [ ] Prices, seasons, capacities and rules confirmed for the current season
- [ ] Privacy policy, terms and cancellation policy approved
- [ ] Real photographs uploaded (hero images for each water/beat, gallery)
- [ ] Beat map positions, access and parking details entered
- [ ] Test booking in Stripe **test mode** end to end: pay → email → PDF → QR scan → refund
- [ ] Switch to live Stripe keys + live webhook secret; make one real £ booking and refund it
- [ ] Decide what happens to the FishPal listing (avoid selling the same permits twice)
- [ ] Redirects from old URLs (see below) in place
- [ ] Google Search Console: verify domain, submit `/sitemap.xml`

### Redirects from the old site
Permanent (308) redirects for the old site's known URLs are configured in `next.config.ts` → `redirects()`:
`/index.htm → /`, `/prices.htm → /permits`, `/season.htm → /seasons`,
`/rules.htm → /rules`, `/river_beats.htm → /river-earn`, `/d_loch.htm → /drummond-loch`,
`/membership.htm → /membership`, `/news.htm → /news`, `/contact.htm → /contact`,
`/formv3.html → /catch-returns`.
Add any other old URLs the club knows about to the same list.

## Local development

```bash
cp .env.example .env.local        # fill in DATABASE_URL at minimum
npm install
DATABASE_URL=postgres://postgres@localhost:5432/crieff_dev npm run db:seed   # plain Postgres works (an auth shim is applied)
npm run dev
npm test                           # unit + integration tests (needs local Postgres on :5432)
```
