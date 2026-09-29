import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { BookingStatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { PrintButton } from "@/components/booking/print-button";
import { Logo } from "@/components/site/logo";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { clubToday } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { loadBookingForCustomer } from "@/lib/permits/data";
import { conditionsForBooking } from "@/lib/permits/conditions";
import { qrSvg, verificationUrl } from "@/lib/permits/pdf";

export const metadata: Metadata = { title: "Your fishing permit", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PermitPage({ params, searchParams }: PageProps<"/permit/[reference]">) {
  const { reference } = await params;
  const { t } = await searchParams;
  const b = await loadBookingForCustomer(sql, reference, typeof t === "string" ? t : null);
  if (!b) notFound();
  const conditions = await conditionsForBooking(sql, b);
  const qrs = await Promise.all(b.permits.map((p) => qrSvg(verificationUrl(env.siteUrl, p.verificationCode))));
  const today = clubToday();
  const pdfHref = `/permit/${b.reference}/pdf?t=${encodeURIComponent(b.accessToken)}`;

  return (
    <div className="container-club max-w-4xl py-10 sm:py-14 print:max-w-none print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <p className="eyebrow">Booking {b.reference}</p>
          <h1 className="display-md mt-2">Your fishing permit{b.quantity > 1 ? "s" : ""}</h1>
        </div>
        <div className="flex gap-2">
          <a href={pdfHref} className={buttonClasses("primary", "md")}>Download PDF</a>
          <PrintButton className={buttonClasses("secondary", "md")} />
        </div>
      </div>

      {b.status === "pending" && <Alert tone="warn" className="mt-6 print:hidden" title="Awaiting payment">This booking hasn&rsquo;t been paid yet, so the permit is not valid. If you&rsquo;ve just paid, refresh in a minute.</Alert>}
      {b.status === "cancelled" && <Alert tone="bad" className="mt-6" title="This booking has been cancelled">The permit is no longer valid.</Alert>}
      {b.status === "refunded" && <Alert tone="info" className="mt-6" title="This booking has been refunded">The permit is no longer valid.</Alert>}
      {b.status === "failed" && <Alert tone="bad" className="mt-6" title="Payment failed">No permit was issued. <Link href="/book" className="underline">Book again</Link>.</Alert>}
      {b.status === "paid" && b.fishingDate < today && <Alert tone="info" className="mt-6 print:hidden" title="This permit has expired">It was valid on {formatDate(b.fishingDate, "full")}. Don&rsquo;t forget your <Link href="/catch-returns" className="underline">catch return</Link>.</Alert>}

      <div className="mt-8 space-y-6">
        {b.permits.map((p, i) => (
          <article key={p.id} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] print:break-after-page print:shadow-none">
            <header className="flex items-center justify-between gap-4 bg-peat px-6 py-5 text-bone">
              <div className="flex items-center gap-3">
                <Logo className="h-10 w-10" />
                <div>
                  <p className="font-display text-xl tracking-wide">CRIEFF ANGLING CLUB</p>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-bracken">Digital fishing permit</p>
                </div>
              </div>
              <BookingStatusBadge status={b.status} />
            </header>
            <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                {[
                  ["Angler", `${p.anglerFirstName} ${p.anglerLastName}`],
                  ["Permit no.", p.permitNumber],
                  ["Date", formatDate(b.fishingDate, "full")],
                  ["Booking ref.", b.reference],
                  ["Water", b.water.name],
                  ["Beat", b.beat.name],
                  ["Permit", b.permitType.name],
                  ["Price", formatMoney(b.unitPricePence)],
                  ...(b.boat ? [["Boat", b.boat.name]] : []),
                ].map(([k, v]) => (
                  <div key={k} className={k === "Angler" || k === "Date" ? "col-span-2 sm:col-span-1" : ""}>
                    <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-stone">{k}</dt>
                    <dd className="mt-0.5 text-lg">{v}</dd>
                  </div>
                ))}
              </dl>
              <figure className="flex flex-col items-center justify-self-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrs[i])}`} alt={`QR code to verify permit ${p.permitNumber}`} width={176} height={176} className="h-44 w-44" />
                <figcaption className="mt-2 text-center text-xs text-stone">
                  Scan to verify
                  <span className="block font-mono text-peat">{p.verificationCode}</span>
                </figcaption>
              </figure>
            </div>
            {conditions.length > 0 && (
              <div className="border-t border-line bg-bone px-6 py-5">
                <p className="eyebrow">Important conditions</p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-peat/85 marker:text-bracken">
                  {conditions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm text-stone print:hidden">
        Keep this page or the PDF on your phone. Need to change something? <Link href="/contact" className="link-underline">Contact the club</Link> quoting {b.reference}. After your day, please <Link href={`/catch-returns?ref=${b.reference}`} className="link-underline">submit a catch return</Link>.
      </p>
    </div>
  );
}
