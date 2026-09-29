# Project notes — Crieff Angling Club website & booking platform

Running record of what was found, what was assumed, and what still needs doing.
Last updated: 29 September 2026.

---

## 1. How the old site was inspected

The build environment's network policy **blocked direct access** to
`crieffanglingclub.org.uk` (and to the Web Archive), so the old site could not
be crawled page by page. Its content was recovered from search-engine
snapshots of these pages: `index.htm`, `prices.htm`, `season.htm`,
`rules.htm`, `river_beats.htm`, `d_loch.htm`, `membership.htm`, `news.htm`,
`contact.htm`, `formv3.html` (catch return), `application_form.pdf`,
`River_Earn_Rules_&_Guidance_for_Anglers.pdf` (dated 06/01/18), plus the
club's FishPal listing and Facebook page.

**Action:** someone with access to the old site should compare it against the
seed data (Admin → items marked *Needs confirmation*) before go-live. No
images could be retrieved; all photography must be uploaded by the club.

### What the old site said (and where it went)

| Topic | Old site | New site |
|---|---|---|
| Waters | 3 River Earn beats (Upper Strowan, Braidhaugh, Drummond Castle) + Drummond Loch | Waters & beats tables, one page each |
| Beat descriptions | Strowan Estate water between Comrie and Crieff; Braidhaugh a shorter stretch immediately above Crieff Bridge; Drummond Castle the more extensive and productive beat below the bridge | Beat descriptions |
| Length | "some 5 miles, mostly both banks" **and** "nearly 6 miles of double bank" | Not stated as a number anywhere — **confirm** |
| Species | Salmon, sea trout, brown trout, grayling | Species table |
| Salmon & sea trout | 1 Feb – 31 Oct, no Sundays; all sea trout and hen salmon returned after 31 Aug; killing salmon illegal (Category 3) | Season + rules |
| Brown trout | 15 Mar – 6 Oct | Season |
| Grayling | 15 Nov – 15 Jan, Drummond Castle only, fly & bait, no wading or crossing | Season, permit restricted to that beat, rule |
| Salmon day ticket | **£20 and £25 both appear** for 1 Feb – 31 Jul; £30 1 Aug – 15 Oct; no bait before 1 May; no Saturday fishing in October; no day tickets for last 2 weeks of October | Three price periods (seeded £25/£30/£30) — **confirm** |
| Brown trout / grayling | £7 adult, £3 junior | Price periods — **confirm** |
| Visitor limit | Non-members limited to **4 tickets per beat per day** | Default beat capacity = 4 |
| Drummond Loch | ~86-acre SSSI, Drummond Castle Estate; stocked with 12" brown trout, fish to 4lb; **fly only, boat only, no bank fishing**; 3 Clansman boats (bought Dec 2002) each comfortably taking 3 anglers; non-members £10/day; returns in box at boat house; parking at Bennybeg car park opposite | Loch page, 3 boats × 3 anglers, £10 permit, rules |
| Membership | Local (within 6 miles of Crieff) £140; Country £190; £20 joining fee first year; applications held by Secretary until there is room | Membership types + waiting-list application flow |
| Where to buy | Crieff Visitor Centre garden centre (Strowan & Drummond Castle), 01764 652722, 7 days 9–5; Braidhaugh Holiday Park (Braidhaugh), 01764 652951; FishPal online | "Other permit outlets" setting — **confirm still valid** |
| Contact | Secretary 07586 774905 **or** 01764 656063; also 07922 267829 and a personal iCloud email | One phone number shown; email left blank — **confirm** |
| News | AGM notice (Royal British Legion, 7.30pm, Tue 2 Dec); river level link | News CMS; river level link setting |
| Catch returns | Online form `formv3.html` open to anyone | Public catch-return form (no login needed) + account history for signed-in anglers |

## 2. Assumptions made

1. **Visitors book per angler, per beat, per day.** One booking = one date + one beat + one permit type, with one named permit (and QR code) per angler.
2. **Capacity** counts all visitor permits on a beat per day, across permit types (4, per the old site). A permit type can have an extra daily limit.
3. **Checkout holds** permits for 30 minutes (+6 min grace). Holds release automatically; they never need a clean-up job to free space.
4. **Drummond Loch**: each booking gets one whole boat (up to 3 anglers). Loch "capacity" is 9 anglers; boats are the real limit and can never be double-booked (database constraint). **Boat hire charge set to £0** because the old site gave no figure ("very reasonable rates").
5. **Salmon price Feb–Jul seeded at £25** (the more recent-looking figure) — the old site shows £20 in one place.
6. **Brown trout Sunday fishing** is allowed (the old site only excluded Sundays for salmon/sea trout, which is the statutory position).
7. **Junior age limit** is unknown, so junior permits ask the buyer to confirm eligibility rather than enforcing an age.
8. **Membership expiry** set to 31 December; memberships bought within 60 days of expiry run to the following year. **Confirm the club's membership year.**
9. **Online membership is by application** (matching the old waiting-list process). The committee offers a place from the admin panel; the applicant then pays online by a secure link, or payment can be recorded offline.
10. **Same-day booking** closes at 20:00 UK time; bookings open up to 365 days ahead. Both adjustable in Settings.
11. **Map positions are approximate** (area centres) and labelled as such on every map. No access/parking details were invented — pages say "Details to follow" until the club adds them.
12. Legal pages (privacy, terms, cancellation) are sensible drafts, clearly flagged, not legal advice.
13. Customer cancellations: the draft policy says refunds for angler cancellations are at the committee's discretion, and a full refund/move is given if the club closes the water. **Committee to decide.**

## 3. Information requiring club confirmation

Every item below is also flagged in the admin panel with a yellow **Needs confirmation** badge (the dashboard shows the total).

- [ ] All permit prices for the current season (salmon £20 vs £25 especially)
- [ ] Whether day permits are still sold for the last two weeks of October (currently: no)
- [ ] No-Saturday rule in October for day permits
- [ ] "No bait before 1 May" and whether "fly only in summer" also applies (the rules PDF mentions both)
- [ ] Current conservation grading for the Earn (Category 3 → catch & release) for this season
- [ ] Daily visitor permit limit per beat (4) and whether it differs per beat
- [ ] Drummond Loch: boat hire price, permit price, anglers per boat, boat names, season dates
- [ ] Junior age limit and any adult-supervision rule
- [ ] Membership prices, joining fee, eligibility wording, benefits, membership year/expiry; any junior/senior/family categories
- [ ] Beat lengths, banks, access, parking, boundaries and map coordinates
- [ ] Contact phone/email to publish; postal address; admin notification email
- [ ] Whether Crieff Visitor Centre / Braidhaugh still sell permits in person
- [ ] Whether the FishPal listing continues (risk of double-selling the same permits)
- [ ] Privacy policy, terms, cancellation policy
- [ ] Permit conditions wording ("personal and date-specific", "show on request")

## 4. Required API keys / credentials

| Variable | From | Notes |
|---|---|---|
| `DATABASE_URL` | Supabase → Connect → Transaction pooler | server only |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API | server only; image uploads |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys | server only |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → endpoint | server only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | optional (hosted Checkout) |
| `RESEND_API_KEY` | Resend → API keys | server only |
| `EMAIL_FROM`, `EMAIL_REPLY_TO`, `ADMIN_NOTIFICATION_EMAIL` | club | |
| `IP_HASH_SALT`, `CRON_SECRET` | generate (`openssl rand -hex 32`) | |
| `NEXT_PUBLIC_SITE_URL` | the live domain | |

## 5. External services

- **Supabase** — PostgreSQL, Auth (email + password / magic link), Storage (`media` bucket)
- **Stripe** — Checkout, webhooks, refunds (club Stripe account, business verification)
- **Resend** — transactional email (domain DNS: SPF/DKIM/DMARC)
- **Vercel** — hosting, image optimisation, daily cron
- **OpenStreetMap** — embedded maps (no key, no cookies)
- Domain registrar for `crieffanglingclub.org.uk` (DNS changes for Vercel + Resend)

## 6. Remaining production tasks

- [ ] Provision Supabase, Stripe, Resend, Vercel (see `docs/DEPLOYMENT.md`) — needs the club's accounts
- [ ] Run a full Stripe **test-mode** booking against the deployed site (Stripe was not reachable from the build environment, so the Stripe integration is covered by automated tests with a Stripe stand-in, not a live call)
- [ ] Sign-in flows against real Supabase Auth (the automated tests used a development-only sign-in shim that cannot be enabled in production)
- [ ] Upload photography (hero image per water/beat, gallery); the site shows illustrated landscapes until then
- [ ] Committee review of every "Needs confirmation" item
- [ ] Enter real access/parking/boundary information and accurate map coordinates for each beat
- [ ] Import existing members (use "Paid offline" on an application, or ask for a bulk import script)
- [ ] Decide on FishPal and in-person outlets (in-person sales can be recorded as manual bookings so capacity stays accurate)
- [ ] Add a DMARC record and Supabase custom SMTP for deliverability
- [ ] Google Search Console + sitemap submission; old-URL redirects are already in place
- [ ] Optional: Stripe Tax/receipts settings, Apple/Google Pay domain verification (works automatically on Checkout)
- [ ] Optional: accessibility audit with a screen-reader user; Lighthouse run on the live domain

## 7. What was tested (in the build environment)

- 67 automated tests (`npm test`): availability engine (seasons, year-wrapping grayling season, price periods, closed weekdays, October rules, blocks, capacity overrides, boats, booking window, DST), booking service against real PostgreSQL (server-side pricing, rule acknowledgement, junior confirmation, **16 concurrent checkouts for a 4-permit beat → exactly 4 succeed**, DB-level overbooking rejection, hold expiry, boat allocation, customer-overwrite protection), Stripe checkout creation/failure, **duplicate & overlapping webhooks** (confirmation sent once), unpaid sessions, expiry/failure, late payment after cancellation, full/partial refunds + refund webhooks, cancellation, notification claims, membership webhook idempotency, **RLS** (anon can't read or write private tables; users see only their own bookings; users can't change their role), permit verification privacy, permit links require the secret token, PDF generation, rate limiter, Markdown XSS safety, email HTML escaping, validation.
- Browser end-to-end (Playwright, desktop and 390px mobile): every public and admin page renders without errors; booking wizard to payment step; manual booking; public vs bailiff permit verification; cancel + refund; blocking a date (and the public calendar honouring it); editing a price (and the public page updating); publishing news; membership application → offer → payment → active; catch return; contact form; admin access control.
- `npm run build`, `npm run typecheck`, `npm run lint` all clean.
