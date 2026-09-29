import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { adminCalendar } from "@/lib/admin/calendar";
import { AdminPageHeader, StatCard } from "@/components/admin/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge, BookingStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { addDays, clubToday } from "@/lib/dates";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const today = clubToday();
  const week = addDays(today, 6);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [todayCal, [stats], recent, upcoming, [members], attention, confirmCount, pendingApps] = await Promise.all([
    adminCalendar(today, today),
    sql`select
          count(*) filter (where status = 'paid' and fishing_date = ${today})::int as today_bookings,
          coalesce(sum(quantity) filter (where status = 'paid' and fishing_date = ${today}), 0)::int as today_anglers,
          count(*) filter (where status = 'paid' and fishing_date between ${today} and ${week})::int as week_bookings,
          coalesce(sum(total_pence - amount_refunded_pence) filter (where status in ('paid','refunded') and paid_at >= ${monthStart}::date), 0)::int as month_revenue,
          coalesce(sum(total_pence - amount_refunded_pence) filter (where status in ('paid','refunded') and paid_at >= date_trunc('year', now())), 0)::int as year_revenue,
          count(*) filter (where status = 'paid' and paid_at >= ${monthStart}::date)::int as month_bookings
        from public.bookings`,
    sql`select b.id, b.reference, b.fishing_date, b.quantity, b.status, b.total_pence, b.created_at, b.contact, bt.name as beat
        from public.bookings b join public.beats bt on bt.id = b.beat_id where b.status in ('paid','refunded','cancelled') and (b.paid_at is not null or b.source <> 'online')
        order by b.created_at desc limit 8`,
    sql`select b.fishing_date, bt.name as beat, sum(b.quantity)::int as anglers from public.bookings b join public.beats bt on bt.id = b.beat_id
        where b.status = 'paid' and b.fishing_date between ${addDays(today, 1)} and ${addDays(today, 14)} group by 1, 2, bt.sort_order order by 1, bt.sort_order`,
    sql`select count(*) filter (where status = 'active' and expires_on >= current_date)::int as active,
               count(*) filter (where status = 'active' and expires_on between current_date and current_date + 45)::int as expiring
        from public.memberships`,
    sql`select id, reference, needs_attention from public.bookings where needs_attention is not null order by updated_at desc limit 5`,
    sql`select (select count(*) from public.permit_prices where needs_confirmation) + (select count(*) from public.rules where needs_confirmation)
             + (select count(*) from public.settings where needs_confirmation) + (select count(*) from public.beats where needs_confirmation)
             + (select count(*) from public.waters where needs_confirmation) + (select count(*) from public.membership_types where needs_confirmation)
             + (select count(*) from public.fishing_seasons where needs_confirmation) + (select count(*) from public.permit_types where needs_confirmation)
             + (select count(*) from public.boats where needs_confirmation) + (select count(*) from public.pages where needs_confirmation) as n`,
    sql`select count(*)::int as n from public.membership_applications where status in ('submitted')`,
  ]);
  const integrations = [
    { name: "Stripe payments", ok: !!env.stripeSecretKey && !!env.stripeWebhookSecret },
    { name: "Email (Resend)", ok: !!env.resendApiKey },
    { name: "Image storage", ok: !!env.supabaseServiceRoleKey },
  ];
  const beatsToday = todayCal.days[0].beats;
  const fullToday = beatsToday.filter((b) => b.state === "full");
  const byDate = Object.groupBy(upcoming, (u) => u.fishing_date as string);

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={formatDate(today, "full")}
        actions={
          <>
            <ButtonLink href="/admin/bookings/new" size="sm">New booking</ButtonLink>
            <ButtonLink href={`/admin/calendar/${today}`} variant="secondary" size="sm">Block a date</ButtonLink>
            <ButtonLink href="/admin/news/new" variant="secondary" size="sm">Add news</ButtonLink>
            <ButtonLink href="/admin/permit-types" variant="secondary" size="sm">Edit prices</ButtonLink>
          </>
        }
      />
      {integrations.some((i) => !i.ok) && (
        <Alert tone="warn" className="mb-6" title="Setup incomplete">
          Not yet configured: {integrations.filter((i) => !i.ok).map((i) => i.name).join(", ")}. Online booking and emails need these — see the deployment guide.
        </Alert>
      )}
      {attention.map((a) => (
        <Alert key={a.id} tone="bad" className="mb-3" title={`Booking ${a.reference} needs attention`}>{a.needs_attention} <Link href={`/admin/bookings/${a.id}`} className="underline">Open</Link></Alert>
      ))}
      {Number(confirmCount[0].n) > 0 && (
        <Alert tone="info" className="mb-6" title={`${confirmCount[0].n} items are marked “needs confirmation”`}>
          Prices, rules and other details carried over from the old website that the committee should check. Look for the yellow badge in Permit types, Rules, Seasons, Beats, Membership and Settings.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value={stats.today_bookings} sub={`${stats.today_anglers} angler${stats.today_anglers === 1 ? "" : "s"} fishing`} href={`/admin/calendar/${today}`} />
        <StatCard label="Next 7 days" value={stats.week_bookings} sub="paid bookings" href={`/admin/bookings?from=${today}&to=${week}&status=paid&sort=date&dir=asc`} />
        <StatCard label="Revenue this month" value={formatMoney(stats.month_revenue)} sub={`${stats.month_bookings} bookings · ${formatMoney(stats.year_revenue)} this year`} />
        <StatCard label="Members" value={members.active} sub={`${members.expiring} expiring soon · ${pendingApps[0].n} new applications`} href="/admin/membership" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-display text-xl">Today&rsquo;s permits</h2><Link href={`/admin/calendar/${today}`} className="text-sm font-semibold text-bracken">Day view</Link></div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {beatsToday.map((b) => (
              <li key={b.beatId} className="rounded-xl border border-line p-3">
                <p className="text-sm font-semibold">{b.beatName}</p>
                <p className="font-display text-2xl">{b.booked}<span className="text-base text-stone"> / {b.capacity}</span></p>
                <Badge tone={b.state === "full" ? "bad" : b.state === "blocked" ? "dark" : b.state === "closed" ? "neutral" : "good"}>
                  {b.state === "closed" ? "Out of season" : b.state === "blocked" ? "Blocked" : b.state === "full" ? "Full" : `${b.capacity - b.booked} available`}
                </Badge>
              </li>
            ))}
          </ul>
          {fullToday.length > 0 && <p className="mt-3 text-sm text-bad">Full today: {fullToday.map((b) => b.beatName).join(", ")}</p>}
        </section>
        <section className="card p-5">
          <h2 className="font-display text-xl">Coming up (14 days)</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {Object.entries(byDate).map(([d, list]) => (
              <li key={d} className="py-2">
                <Link href={`/admin/calendar/${d}`} className="font-semibold hover:underline">{formatDate(d, "long")}</Link>
                <span className="block text-stone">{list!.map((x) => `${x.beat} ${x.anglers}`).join(" · ")}</span>
              </li>
            ))}
            {!upcoming.length && <li className="py-2 text-stone">No bookings in the next fortnight.</li>}
          </ul>
        </section>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <div className="flex items-center justify-between px-5 pt-5"><h2 className="font-display text-xl">Recent bookings</h2><Link href="/admin/bookings" className="text-sm font-semibold text-bracken">All bookings</Link></div>
        <table className="table-club mt-3">
          <thead><tr><th>Ref</th><th>Booked</th><th>Customer</th><th>Fishing</th><th className="text-right">Total</th><th>Status</th></tr></thead>
          <tbody>
            {recent.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold hover:underline">{b.reference}</Link></td>
                <td className="whitespace-nowrap text-stone">{formatDateTime(b.created_at)}</td>
                <td>{b.contact.firstName} {b.contact.lastName}</td>
                <td>{formatDate(b.fishing_date, "short")} · {b.beat} ({b.quantity})</td>
                <td className="text-right">{formatMoney(b.total_pence)}</td>
                <td><BookingStatusBadge status={b.status} /></td>
              </tr>
            ))}
            {!recent.length && <tr><td colSpan={6} className="text-stone">No bookings yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
