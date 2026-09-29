import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { loadBooking } from "@/lib/permits/data";
import { adminCancelBooking, adminClearAttention, adminRefundBooking, adminResendConfirmation, adminUpdateBooking } from "@/lib/admin/booking-actions";
import { AdminPageHeader, Flash } from "@/components/admin/page-header";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Alert } from "@/components/ui/alert";
import { Badge, BookingStatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingDetail({ params, searchParams }: PageProps<"/admin/bookings/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const b = await loadBooking(sql, { id });
  if (!b) notFound();
  const sp = await searchParams;
  const [beats, emails, verifications, audits] = await Promise.all([
    sql`select id, name from public.beats where water_id = ${b.water.id} order by sort_order`,
    sql`select template, status, error, created_at, to_email from public.email_logs where booking_id = ${id} order by created_at desc limit 20`,
    sql`select v.result, v.created_at, pm.permit_number from public.permit_verifications v join public.permits pm on pm.id = v.permit_id where pm.booking_id = ${id} order by v.created_at desc limit 20`,
    sql`select action, actor_email, created_at, details from public.audit_logs where entity_type = 'booking' and entity_id = ${id} order by created_at desc limit 20`,
  ]);
  const permitUrl = `/permit/${b.reference}?t=${encodeURIComponent(b.accessToken)}`;
  const refundable = b.payment && (b.payment.status === "succeeded" || b.payment.status === "partially_refunded");
  const balance = b.totalPence - b.amountRefundedPence;
  const cancel = adminCancelBooking.bind(null, id);
  const refund = adminRefundBooking.bind(null, id);
  const resend = adminResendConfirmation.bind(null, id);
  const update = adminUpdateBooking.bind(null, id);

  return (
    <>
      <AdminPageHeader
        back={{ href: "/admin/bookings", label: "Bookings" }}
        title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono">{b.reference}</span><BookingStatusBadge status={b.status} /></span>}
        description={`${b.quantity} × ${b.permitType.name} · ${b.beat.name === b.water.name ? b.water.name : `${b.beat.name}, ${b.water.name}`} · ${formatDate(b.fishingDate, "full")}`}
        actions={
          <>
            <a href={permitUrl} target="_blank" className={buttonClasses("secondary")}>View permit ↗</a>
            {b.status === "paid" && <ConfirmAction action={resend} label="Resend permit" title="Resend confirmation & permit?" body={`Emails the permit PDF and receipt to ${b.contact.email}.`} confirmLabel="Send" variant="primary" />}
            {(b.status === "paid" || b.status === "pending") && (
              <ConfirmAction
                action={cancel}
                label="Cancel booking"
                title="Cancel this booking?"
                body="The permit becomes invalid immediately and the place is released."
                confirmLabel="Cancel booking"
                fields={
                  <>
                    <div><label htmlFor="reason" className="field-label">Reason (shown to customer)</label><input id="reason" name="reason" className="input" placeholder="e.g. River closed due to flooding" /></div>
                    {refundable && <label className="flex gap-2 text-sm"><input type="checkbox" name="refund" defaultChecked className="accent-peat" /> Also refund the remaining {formatMoney(balance)}</label>}
                    <label className="flex gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="accent-peat" /> Email the customer</label>
                  </>
                }
              />
            )}
            {refundable && balance > 0 && (
              <ConfirmAction
                action={refund}
                label="Refund"
                variant="secondary"
                title="Issue a refund"
                body={`Up to ${formatMoney(balance)}. ${b.payment?.method === "stripe" ? "The refund goes back to the customer's card via Stripe." : "This was not a card payment: the refund is recorded here only — pay it back by the original method."}`}
                confirmLabel="Refund"
                fields={
                  <>
                    <div><label htmlFor="amount" className="field-label">Amount (£) — leave blank for the full {formatMoney(balance)}</label><input id="amount" name="amount" inputMode="decimal" className="input" /></div>
                    <div><label htmlFor="rreason" className="field-label">Note</label><input id="rreason" name="reason" className="input" /></div>
                    <label className="flex gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked className="accent-peat" /> Email the customer</label>
                    <p className="text-xs text-stone">A full refund also invalidates the permit.</p>
                  </>
                }
              />
            )}
          </>
        }
      />
      <Flash sp={sp} />
      {b.needsAttention && (
        <Alert tone="bad" title="Needs attention" className="mb-6">
          {b.needsAttention}
          <div className="mt-3"><ConfirmAction action={adminClearAttention.bind(null, id)} label="Mark resolved" title="Mark as resolved?" confirmLabel="Resolved" variant="primary" size="sm" /></div>
        </Alert>
      )}
      {b.status === "pending" && <Alert tone="warn" className="mb-6" title="Awaiting payment">Held until {b.holdExpiresAt ? formatDateTime(b.holdExpiresAt) : "—"}. If the customer doesn&rsquo;t pay, the place is released automatically.</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <h2 className="font-display text-xl">Booking</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ["Fishing date", formatDate(b.fishingDate, "full")],
              ["Water / beat", `${b.water.name} — ${b.beat.name}`],
              ["Permit", `${b.quantity} × ${b.permitType.name}${b.priceLabel ? ` (${b.priceLabel})` : ""}`],
              ["Boat", b.boat?.name ?? "—"],
              ["Unit price", formatMoney(b.unitPricePence)],
              ["Boat hire", b.boatFeePence ? formatMoney(b.boatFeePence) : "—"],
              ["Total", formatMoney(b.totalPence)],
              ["Refunded", b.amountRefundedPence ? formatMoney(b.amountRefundedPence) : "—"],
              ["Source", b.source.replace("_", " ")],
              ["Created", formatDateTime(b.createdAt)],
              ["Paid", b.paidAt ? formatDateTime(b.paidAt) : "—"],
              ["Cancelled", b.cancelledAt ? `${formatDateTime(b.cancelledAt)}${b.cancellationReason ? ` — ${b.cancellationReason.replace(/_/g, " ")}` : ""}` : "—"],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-stone">{k}</dt><dd className="mt-0.5">{v}</dd></div>
            ))}
          </dl>
          {b.capacityOverride && <p className="mt-4"><Badge tone="warn">Capacity override</Badge></p>}
        </section>
        <section className="card p-6">
          <h2 className="font-display text-xl">Customer</h2>
          <p className="mt-3 font-semibold">{b.contact.firstName} {b.contact.lastName}</p>
          <p><a href={`mailto:${b.contact.email}`} className="link-underline">{b.contact.email}</a></p>
          <p><a href={`tel:${b.contact.phone}`}>{b.contact.phone}</a></p>
          <p className="mt-2 text-sm text-stone">{[b.contact.addressLine1, b.contact.addressLine2, b.contact.town, b.contact.postcode].filter(Boolean).join(", ")}</p>
          <Link href={`/admin/customers/${b.customerId}`} className="link-underline mt-3 inline-block text-sm font-semibold">Customer record</Link>
          <h3 className="mt-6 font-semibold">Payment</h3>
          {b.payment ? (
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-stone">Method</dt><dd>{b.payment.method === "stripe" ? "Card (Stripe)" : b.payment.method.replace(/_/g, " ")}</dd></div>
              <div className="flex justify-between"><dt className="text-stone">Status</dt><dd>{b.payment.status}</dd></div>
              {b.payment.stripePaymentIntentId && <div className="flex justify-between gap-2"><dt className="text-stone">Stripe</dt><dd className="truncate font-mono text-xs">{b.payment.stripePaymentIntentId}</dd></div>}
              {b.payment.failureMessage && <div className="text-bad">{b.payment.failureMessage}</div>}
            </dl>
          ) : <p className="text-sm text-stone">No payment record.</p>}
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-2xl">Edit booking</h2>
        <AdminForm action={update}>
          <div className="card grid gap-5 p-6 sm:grid-cols-2">
            <div><label htmlFor="date" className="field-label">Fishing date</label><input id="date" name="date" type="date" defaultValue={b.fishingDate} className="input" required /></div>
            <div><label htmlFor="beatId" className="field-label">Beat</label><select id="beatId" name="beatId" defaultValue={b.beat.id} className="input">{beats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            {b.permits.map((p) => (
              <fieldset key={p.id} className="grid gap-3 rounded-xl border border-line p-3 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto]">
                <legend className="px-1 text-sm font-semibold">Permit {p.permitNumber}</legend>
                <input name={`angler.${p.id}.first`} defaultValue={p.anglerFirstName} className="input input-sm" aria-label="Angler first name" />
                <input name={`angler.${p.id}.last`} defaultValue={p.anglerLastName} className="input input-sm" aria-label="Angler surname" />
                <Link href={`/permit/verify/${p.verificationCode}`} target="_blank" className="self-center text-sm text-bracken">Verify ↗</Link>
              </fieldset>
            ))}
            <div><label htmlFor="phone" className="field-label">Customer phone</label><input id="phone" name="phone" defaultValue={b.contact.phone} className="input" /></div>
            <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" name="capacityOverride" className="accent-peat" /> Override capacity if the new date/beat is full</label>
            <div className="sm:col-span-2"><label htmlFor="adminNotes" className="field-label">Internal notes</label><textarea id="adminNotes" name="adminNotes" defaultValue={b.adminNotes ?? ""} className="input min-h-24" /></div>
          </div>
        </AdminForm>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="font-display text-lg">Emails</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {emails.map((e, i) => <li key={i} className="flex justify-between gap-2"><span>{e.template.replace(/_/g, " ")}</span><Badge tone={e.status === "sent" ? "good" : e.status === "failed" ? "bad" : "neutral"}>{e.status}</Badge></li>)}
            {!emails.length && <li className="text-stone">None sent.</li>}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="font-display text-lg">Permit checks</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {verifications.map((v, i) => <li key={i} className="flex justify-between gap-2"><span>{v.permit_number} · {formatDateTime(v.created_at)}</span><span>{v.result.replace(/_/g, " ")}</span></li>)}
            {!verifications.length && <li className="text-stone">Not checked yet.</li>}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="font-display text-lg">History</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {audits.map((a, i) => <li key={i}><span className="font-medium">{a.action.replace("booking.", "").replace(/_/g, " ")}</span> <span className="text-stone">by {a.actor_email} · {formatDateTime(a.created_at)}</span></li>)}
            {!audits.length && <li className="text-stone">No admin changes.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
