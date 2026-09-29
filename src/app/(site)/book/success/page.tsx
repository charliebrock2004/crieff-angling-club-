import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { sql } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { fulfilCheckoutSession } from "@/lib/booking/webhook";
import { emailNotifier } from "@/lib/email/notifier";
import { loadBooking } from "@/lib/permits/data";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SuccessPage({ searchParams }: PageProps<"/book/success">) {
  const { session_id } = await searchParams;
  const stripe = getStripe();
  if (typeof session_id !== "string" || !/^cs_[A-Za-z0-9_]+$/.test(session_id) || !stripe) {
    return <Shell><Alert tone="bad" title="We couldn't find that payment">If you&rsquo;ve paid, your permit will arrive by email shortly. Otherwise, please <Link href="/book" className="underline">start a new booking</Link>.</Alert></Shell>;
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id);
  } catch {
    return <Shell><Alert tone="bad" title="Session expired or not found">Your checkout session could not be found. If you were charged, your permit will still arrive by email — contact the club if it doesn&rsquo;t.</Alert></Shell>;
  }
  const bookingId = session.metadata?.kind === "booking" ? session.metadata.booking_id : null;
  if (!bookingId) return <Shell><Alert tone="bad" title="That isn't a permit booking" /></Shell>;

  // Confirm immediately (idempotent — the webhook does the same thing).
  if (session.payment_status === "paid") {
    try {
      await fulfilCheckoutSession(sql, session, emailNotifier);
    } catch (err) {
      console.error("success page fulfilment failed", err);
    }
  }
  const b = await loadBooking(sql, { id: bookingId });
  if (!b) return <Shell><Alert tone="bad" title="Booking not found" /></Shell>;
  const permitUrl = `/permit/${b.reference}?t=${encodeURIComponent(b.accessToken)}`;

  if (b.status !== "paid") {
    return (
      <Shell>
        <Alert tone="warn" title="Payment is still processing">
          We haven&rsquo;t received confirmation of your payment yet. This page will update — refresh in a minute. You&rsquo;ll also get an email as soon as it&rsquo;s confirmed. Reference: <strong>{b.reference}</strong>
        </Alert>
        {b.needsAttention && <Alert tone="bad" className="mt-4" title="There was a problem with this booking">The club has been notified and will contact you about a refund.</Alert>}
      </Shell>
    );
  }
  return (
    <Shell>
      <p className="eyebrow">Payment received</p>
      <h1 className="display-lg mt-3">You&rsquo;re booked. Tight lines.</h1>
      <p className="lede mt-4">
        {b.quantity} × {b.permitType.name} on {b.beat.name === b.water.name ? b.water.name : `${b.beat.name}, ${b.water.name}`}, {formatDate(b.fishingDate, "full")}.
      </p>
      <dl className="card mt-8 grid gap-4 p-6 sm:grid-cols-3">
        <div><dt className="text-sm text-stone">Reference</dt><dd className="font-display text-2xl">{b.reference}</dd></div>
        <div><dt className="text-sm text-stone">Paid</dt><dd className="font-display text-2xl">{formatMoney(b.totalPence)}</dd></div>
        <div><dt className="text-sm text-stone">Email</dt><dd className="truncate text-lg">{b.contact.email}</dd></div>
      </dl>
      <p className="mt-6 text-stone">Your digital permit{b.quantity > 1 ? "s have" : " has"} been emailed to you. Open {b.quantity > 1 ? "them" : "it"} now, save to your phone, or print a copy.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href={permitUrl} variant="accent" size="lg">View your permit</ButtonLink>
        <ButtonLink href="/book" variant="secondary" size="lg">Book another day</ButtonLink>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="container-club max-w-3xl py-16 sm:py-24">{children}</div>;
}
