import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { cancelMembership, offerMembership, recordManualMembershipPayment, setApplicationStatus } from "@/lib/admin/misc-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Membership" };

const TONE: Record<string, "info" | "warn" | "good" | "neutral" | "bad"> = { submitted: "warn", waiting_list: "info", offered: "accent" as never, paid: "good", rejected: "bad", withdrawn: "neutral" };

export default async function MembershipAdmin({ searchParams }: PageProps<"/admin/membership">) {
  const { tab = "applications" } = await searchParams;
  const [apps, members, types, [counts]] = await Promise.all([
    sql`select a.*, t.name as type_name, t.price_pence, t.joining_fee_pence from public.membership_applications a join public.membership_types t on t.id = a.membership_type_id
        where a.status in ('submitted', 'waiting_list', 'offered') order by a.created_at`,
    sql`select m.*, t.name as type_name, c.first_name, c.last_name, c.email from public.memberships m join public.membership_types t on t.id = m.membership_type_id join public.customers c on c.id = m.customer_id
        order by (m.status = 'active' and m.expires_on >= current_date) desc, c.last_name limit 500`,
    sql`select id, name, price_pence, joining_fee_pence, is_active, needs_confirmation from public.membership_types order by sort_order`,
    sql`select count(*) filter (where status = 'active' and expires_on >= current_date)::int as active from public.memberships`,
  ]);
  return (
    <>
      <AdminPageHeader title="Membership" description={`${counts.active} active members. Applications join the waiting list; offer a place to email a secure payment link.`} actions={<ButtonLink href="/admin/membership-types" variant="secondary">Membership types & prices</ButtonLink>} />
      <nav className="mb-6 flex gap-2" aria-label="Membership sections">
        {[["applications", `Applications (${apps.length})`], ["members", "Members"], ["types", "Types"]].map(([k, l]) => (
          <Link key={k} href={`/admin/membership?tab=${k}`} className={buttonClasses(tab === k ? "primary" : "secondary", "sm")}>{l}</Link>
        ))}
      </nav>
      {tab === "applications" && (
        <div className="space-y-3">
          {apps.map((a) => {
            const total = a.price_pence + (a.include_joining_fee ? a.joining_fee_pence : 0);
            return (
              <article key={a.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-xl">{a.first_name} {a.last_name} <Badge tone={TONE[a.status] ?? "neutral"}>{String(a.status).replace("_", " ")}</Badge> {a.is_renewal && <Badge>Renewal</Badge>}</p>
                    <p className="text-sm text-stone">{a.type_name} · {a.reference} · applied {formatDate(String(new Date(a.created_at).toISOString().slice(0, 10)), "short")}</p>
                    <p className="mt-2 text-sm">{a.email} · {a.phone} · {a.address_line1}, {a.town} {a.postcode}</p>
                    {a.statement && <p className="mt-2 max-w-2xl text-sm text-stone">“{a.statement}”</p>}
                    {a.admin_notes && <p className="mt-2 text-sm"><strong>Notes:</strong> {a.admin_notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ConfirmAction action={offerMembership.bind(null, a.id)} variant="accent" size="sm" label={a.status === "offered" ? "Re-send offer" : "Offer place"} title="Offer a place?" body={`Emails ${a.email} a secure link to pay online.`} confirmLabel="Send offer"
                      fields={<label className="flex gap-2 text-sm"><input type="checkbox" name="joiningFee" defaultChecked={a.include_joining_fee} className="accent-peat" /> Include {formatMoney(a.joining_fee_pence)} joining fee (total {formatMoney(total)})</label>} />
                    {a.status === "submitted" && <ConfirmAction action={setApplicationStatus.bind(null, a.id, "waiting_list")} variant="secondary" size="sm" label="Waiting list" title="Move to waiting list?" confirmLabel="Move" fields={<input name="note" className="input" placeholder="Note (optional)" />} />}
                    <ConfirmAction action={recordManualMembershipPayment.bind(null, a.id)} variant="secondary" size="sm" label="Paid offline" title="Record an offline payment?" body={`Activates the membership for ${formatMoney(total)}.`} confirmLabel="Record payment"
                      fields={<select name="method" className="input"><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="bank_transfer">Bank transfer</option></select>} />
                    <ConfirmAction action={setApplicationStatus.bind(null, a.id, "rejected")} size="sm" label="Decline" title="Decline this application?" confirmLabel="Decline" fields={<input name="note" className="input" placeholder="Internal note" />} />
                  </div>
                </div>
              </article>
            );
          })}
          {!apps.length && <p className="card p-6 text-stone">No open applications.</p>}
        </div>
      )}
      {tab === "members" && (
        <div className="card overflow-x-auto">
          <table className="table-club">
            <thead><tr><th>No.</th><th>Name</th><th>Type</th><th>Email</th><th>Expires</th><th>Status</th><th /></tr></thead>
            <tbody>
              {members.map((m) => {
                const expired = m.expires_on < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={m.id}>
                    <td className="font-mono">{m.membership_number}</td>
                    <td><Link href={`/admin/customers/${m.customer_id}`} className="font-semibold hover:underline">{m.first_name} {m.last_name}</Link></td>
                    <td>{m.type_name}</td><td>{m.email}</td><td>{formatDate(m.expires_on, "short")}</td>
                    <td><Badge tone={m.status === "active" && !expired ? "good" : "neutral"}>{m.status === "active" && expired ? "expired" : m.status}</Badge></td>
                    <td className="text-right">{m.status === "active" && <ConfirmAction action={cancelMembership.bind(null, m.id)} size="sm" label="Cancel" title="Cancel this membership?" confirmLabel="Cancel membership" />}</td>
                  </tr>
                );
              })}
              {!members.length && <tr><td colSpan={7} className="text-stone">No members recorded yet. Existing members can be added by recording an offline payment on their application.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab === "types" && (
        <div className="card divide-y divide-line">
          {types.map((t) => (
            <Link key={t.id} href={`/admin/membership-types/${t.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-mist/40">
              <span className="font-semibold">{t.name} {t.needs_confirmation && <Badge tone="warn">Needs confirmation</Badge>}</span>
              <span>{formatMoney(t.price_pence)} + {formatMoney(t.joining_fee_pence)} joining</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
