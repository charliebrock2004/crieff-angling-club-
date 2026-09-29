import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { PriceTable } from "@/components/site/fishery";
import { getMembershipTypes, getPermitTypes } from "@/lib/content/queries";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({
  title: "Fishing Permits & Prices — River Earn & Drummond Loch",
  description: "Day permit prices for salmon & sea trout, brown trout and grayling on the River Earn at Crieff, and boat permits for Drummond Loch. Book online.",
  path: "/permits",
});

export default async function PermitsPage() {
  const [permits, memberships, settings] = await Promise.all([getPermitTypes(), getMembershipTypes(), getSettings()]);
  const byWater = Object.groupBy(permits, (p) => p.waterName);
  return (
    <>
      <PageHero eyebrow="Visitors welcome" title="Permits & prices" intro="Day permits are sold separately for each species and water. Numbers are limited on every beat, so book ahead in the busy months." crumbs={[{ href: "/permits", label: "Permits & prices" }]} seed={13} actions={<ButtonLink href="/book" variant="accent" size="lg">Check availability <ArrowRight /></ButtonLink>} />
      <section className="py-16 sm:py-20">
        <div className="container-club grid gap-14 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-14">
            {Object.entries(byWater).map(([water, list]) => (
              <div key={water}>
                <h2 className="display-md">{water}</h2>
                <div className="mt-6"><PriceTable permits={list ?? []} /></div>
              </div>
            ))}
          </div>
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="card p-6">
              <p className="eyebrow">How it works</p>
              <ol className="mt-4 space-y-3 text-sm">
                {["Choose a date, water and beat.", "See exactly how many permits are left.", "Pay securely by card.", "Your digital permit arrives by email with a QR code.", "Carry it on your phone and show it on request."].map((s, i) => (
                  <li key={s} className="flex gap-3"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-peat text-xs font-semibold text-bone">{i + 1}</span>{s}</li>
                ))}
              </ol>
              <ButtonLink href="/book" className="mt-6 w-full">Book a permit</ButtonLink>
            </div>
            {memberships.length > 0 && (
              <div className="card p-6">
                <p className="eyebrow">Fishing often?</p>
                <p className="mt-2 font-display text-2xl">Become a member</p>
                <p className="mt-2 text-sm text-stone">Season-long fishing from {formatMoney(Math.min(...memberships.map((m) => m.pricePence)))}.</p>
                <Link href="/membership" className="link-underline mt-3 inline-block text-sm font-semibold">Membership details</Link>
              </div>
            )}
            {settings.permitOutlets.length > 0 && (
              <div className="card p-6">
                <p className="eyebrow">Buying in person</p>
                <ul className="mt-3 space-y-3 text-sm">
                  {settings.permitOutlets.map((o) => (
                    <li key={o.name}><p className="font-semibold">{o.name}</p>{o.phone && <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="text-stone">{o.phone}</a>}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
