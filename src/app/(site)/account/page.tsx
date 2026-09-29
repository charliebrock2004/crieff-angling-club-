import type { Metadata } from "next";
import Link from "next/link";
import { BookingStatusBadge, Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/section";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { sql } from "@/lib/db";
import { clubToday } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const v = await requireUser("/account");
  // Bookings are shown for customer records linked to this login. Records are
  // linked automatically only once the email address has been confirmed.
  const [bookings, memberships, applications, returns] = await Promise.all([
    sql`select b.id, b.reference, b.access_token, b.fishing_date, b.quantity, b.total_pence, b.status, w.name as water, bt.name as beat, p.name as permit
        from public.bookings b join public.customers c on c.id = b.customer_id
        join public.waters w on w.id = b.water_id join public.beats bt on bt.id = b.beat_id join public.permit_types p on p.id = b.permit_type_id
        where c.user_id = ${v.id} and b.status <> 'failed' and not (b.status = 'cancelled' and b.paid_at is null)
        order by b.fishing_date desc limit 100`,
    sql`select m.membership_number, m.starts_on, m.expires_on, m.status, t.name from public.memberships m
        join public.customers c on c.id = m.customer_id join public.membership_types t on t.id = m.membership_type_id
        where c.user_id = ${v.id} order by m.expires_on desc`,
    sql`select a.reference, a.access_token, a.status, a.created_at, t.name from public.membership_applications a
        join public.membership_types t on t.id = a.membership_type_id
        where (a.user_id = ${v.id} or (${v.emailConfirmed} and a.email = ${v.email})) and a.status not in ('paid') order by a.created_at desc`,
    sql`select r.fishing_date, r.is_blank, w.name as water, bt.name as beat,
          coalesce((select sum(quantity) from public.catch_return_items i where i.catch_return_id = r.id), 0)::int as fish
        from public.catch_returns r join public.waters w on w.id = r.water_id left join public.beats bt on bt.id = r.beat_id
        where r.user_id = ${v.id} order by r.fishing_date desc limit 50`,
  ]);
  const today = clubToday();
  const upcoming = bookings.filter((b) => b.fishing_date >= today && b.status === "paid");
  const past = bookings.filter((b) => !(b.fishing_date >= today && b.status === "paid"));

  return (
    <div className="container-club py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="display-lg mt-2">{v.fullName ? `Hello, ${v.fullName.split(" ")[0]}` : "Hello"}</h1>
          <p className="mt-2 text-stone">{v.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {v.role === "admin" && <ButtonLink href="/admin" variant="primary">Admin dashboard</ButtonLink>}
          {(v.role === "bailiff" || v.role === "admin") && <ButtonLink href="/bailiff" variant="secondary">Today&rsquo;s permits</ButtonLink>}
          <form action={signOut}><button className="h-11 rounded-full px-5 text-sm font-semibold hover:bg-mist">Sign out</button></form>
        </div>
      </div>
      {!v.emailConfirmed && <p className="mt-6 rounded-xl bg-warn-bg p-4 text-sm text-warn">Confirm your email address to see bookings made with it.</p>}

      <section className="mt-12">
        <div className="flex items-center justify-between"><h2 className="display-md">Upcoming permits</h2><ButtonLink href="/book" variant="accent" size="sm">Book a permit</ButtonLink></div>
        <div className="mt-6">
          {upcoming.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {upcoming.map((b) => (
                <li key={b.id} className="card p-5">
                  <p className="font-display text-2xl">{formatDate(b.fishing_date, "full")}</p>
                  <p className="text-stone">{b.quantity} × {b.permit} · {b.beat === b.water ? b.water : `${b.beat}, ${b.water}`}</p>
                  <Link href={`/permit/${b.reference}?t=${encodeURIComponent(b.access_token)}`} className="link-underline mt-3 inline-block font-semibold">View permit {b.reference}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No upcoming permits" action={<ButtonLink href="/book">Book a permit</ButtonLink>} />
          )}
        </div>
      </section>

      <section className="mt-14 grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="display-md">Membership</h2>
          <ul className="mt-6 space-y-3">
            {memberships.map((m) => (
              <li key={m.membership_number} className="card flex items-center justify-between p-5">
                <div><p className="font-semibold">{m.name}</p><p className="text-sm text-stone">{m.membership_number} · until {formatDate(m.expires_on, "short")}</p></div>
                <Badge tone={m.status === "active" && m.expires_on >= today ? "good" : "neutral"}>{m.status === "active" && m.expires_on < today ? "expired" : m.status}</Badge>
              </li>
            ))}
            {applications.map((a) => (
              <li key={a.reference} className="card flex items-center justify-between p-5">
                <div><p className="font-semibold">{a.name} application</p><p className="text-sm text-stone">{a.reference}</p></div>
                {a.status === "offered" ? <Link href={`/membership/pay/${a.reference}?t=${encodeURIComponent(a.access_token)}`} className="font-semibold text-bracken">Pay now →</Link> : <Badge tone="info">{String(a.status).replace("_", " ")}</Badge>}
              </li>
            ))}
            {!memberships.length && !applications.length && <li className="text-stone">You&rsquo;re not a member yet. <Link href="/membership" className="link-underline">About membership</Link></li>}
          </ul>
        </div>
        <div>
          <div className="flex items-center justify-between"><h2 className="display-md">Catch returns</h2><Link href="/catch-returns" className="link-underline text-sm font-semibold">Submit a return</Link></div>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {returns.map((r, i) => (
              <li key={i} className="flex justify-between py-3 text-sm"><span>{formatDate(r.fishing_date, "short")} · {r.beat ?? r.water}</span><span className="font-medium">{r.is_blank ? "Blank" : `${r.fish} fish`}</span></li>
            ))}
            {!returns.length && <li className="py-3 text-sm text-stone">No returns yet.</li>}
          </ul>
        </div>
      </section>

      {past.length > 0 && (
        <section className="mt-14">
          <h2 className="display-md">Booking history</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="table-club">
              <thead><tr><th>Date</th><th>Reference</th><th>Permit</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {past.map((b) => (
                  <tr key={b.id}><td>{formatDate(b.fishing_date, "short")}</td><td className="font-mono">{b.reference}</td><td>{b.permit} · {b.beat}</td><td>{formatMoney(b.total_pence)}</td><td><BookingStatusBadge status={b.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
