import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { sql } from "@/lib/db";
import { safeEqual } from "@/lib/ids";
import { getStripe } from "@/lib/stripe";
import { fulfilCheckoutSession } from "@/lib/booking/webhook";
import { emailNotifier } from "@/lib/email/notifier";
import { applicationAmount } from "@/lib/membership/service";
import { payForMembership } from "@/lib/actions/membership";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Membership payment", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PayMembershipPage({ params, searchParams }: PageProps<"/membership/pay/[reference]">) {
  const { reference } = await params;
  const { t, error, session_id } = await searchParams;
  const [row] = await sql`select id, access_token from public.membership_applications where reference = ${reference}`;
  if (!row || typeof t !== "string" || !safeEqual(row.access_token, t)) notFound();

  if (typeof session_id === "string" && /^cs_[A-Za-z0-9_]+$/.test(session_id)) {
    const stripe = getStripe();
    const s = stripe ? await stripe.checkout.sessions.retrieve(session_id).catch(() => null) : null;
    if (s && s.metadata?.application_id === row.id) await fulfilCheckoutSession(sql, s, emailNotifier).catch((e) => console.error(e));
  }
  const amt = (await applicationAmount(sql, row.id))!;
  const a = amt.application;
  const [membership] = await sql`select membership_number, expires_on from public.memberships where application_id = ${row.id}`;

  return (
    <div className="container-club max-w-2xl py-16 sm:py-24">
      <p className="eyebrow">Application {a.reference}</p>
      <h1 className="display-lg mt-3">{a.type_name}</h1>
      {typeof error === "string" && <Alert tone="bad" className="mt-6">{error}</Alert>}
      {a.status === "paid" && membership ? (
        <>
          <Alert tone="good" className="mt-6" title="Welcome to the club">Your membership {membership.membership_number} is active until {formatDate(membership.expires_on, "full")}. A confirmation has been emailed to you.</Alert>
          <ButtonLink href="/account" className="mt-6">Go to your account</ButtonLink>
        </>
      ) : a.status === "offered" ? (
        <>
          <p className="lede mt-4">Hello {a.first_name} — a place is available. Pay below to take it up.</p>
          <dl className="card mt-8 space-y-3 p-6">
            <div className="flex justify-between"><dt>{a.type_name}</dt><dd>{formatMoney(amt.pricePence)}</dd></div>
            {amt.joiningFeePence > 0 && <div className="flex justify-between"><dt>Joining fee</dt><dd>{formatMoney(amt.joiningFeePence)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-3 font-display text-2xl"><dt>Total</dt><dd>{formatMoney(amt.totalPence)}</dd></div>
          </dl>
          <form action={payForMembership} className="mt-6">
            <input type="hidden" name="reference" value={a.reference} />
            <input type="hidden" name="t" value={t} />
            <Button type="submit" variant="accent" size="lg">Pay {formatMoney(amt.totalPence)} securely</Button>
          </form>
        </>
      ) : (
        <Alert tone="info" className="mt-6" title={a.status === "rejected" || a.status === "withdrawn" ? "This application is closed" : "Your application is on the list"}>
          {a.status === "rejected" || a.status === "withdrawn" ? "Please contact the club secretary if you have any questions." : "We'll email you when a place is available. There's nothing to pay yet."}
        </Alert>
      )}
    </div>
  );
}
