import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { sql } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { loadBookingForCustomer } from "@/lib/permits/data";
import { releaseBooking } from "@/lib/booking/service";

export const metadata: Metadata = { title: "Payment cancelled", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CancelledPage({ searchParams }: PageProps<"/book/cancelled">) {
  const { ref, t } = await searchParams;
  const b = typeof ref === "string" && typeof t === "string" ? await loadBookingForCustomer(sql, ref, t) : null;
  if (b && b.status === "pending") {
    // Release the held permits straight away and close the Stripe session so it can't be paid later.
    const sessionId = b.payment?.stripeCheckoutSessionId;
    const stripe = getStripe();
    let released = true;
    if (sessionId && stripe) {
      try {
        await stripe.checkout.sessions.expire(sessionId);
      } catch {
        // Already completed or expired: let the webhook decide the outcome.
        const s = await stripe.checkout.sessions.retrieve(sessionId).catch(() => null);
        if (s?.payment_status === "paid") released = false;
      }
    }
    if (released) await releaseBooking(sql, b.id, "checkout_cancelled");
  }
  const retry = b ? `/book?date=${b.fishingDate}&beat=${b.beat.slug}` : "/book";
  return (
    <div className="container-club max-w-3xl py-16 sm:py-24">
      <h1 className="display-lg">Payment cancelled</h1>
      <Alert tone="info" className="mt-6" title="You have not been charged">
        {b ? "We've released the permits we were holding for you." : "No payment was taken."} You can start again whenever you&rsquo;re ready — availability may have changed.
      </Alert>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href={retry} variant="primary" size="lg">Try again</ButtonLink>
        <ButtonLink href="/contact" variant="secondary" size="lg">Contact the club</ButtonLink>
      </div>
    </div>
  );
}
