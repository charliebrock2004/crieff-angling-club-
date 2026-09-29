import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { Markdown, stripMarkdown } from "@/lib/markdown";
import { MapEmbed } from "@/components/site/map-embed";
import { JsonLd } from "@/components/site/json-ld";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { AvailabilityStrip, PriceTable, RuleList, SeasonList } from "@/components/site/fishery";
import { getBoats, getGallery, getPermitTypes, getRules, getSeasons, getWater } from "@/lib/content/queries";
import { formatMoney } from "@/lib/format";
import { pageMetadata, placeJsonLd } from "@/lib/seo";

export const revalidate = 300;
const SLUG = "drummond-loch";

export async function generateMetadata(): Promise<Metadata> {
  const w = await getWater(SLUG);
  return pageMetadata({
    title: w?.seoTitle ?? "Drummond Loch Fishing",
    description: w?.seoDescription ?? stripMarkdown(w?.summary).slice(0, 160),
    path: "/drummond-loch",
    image: w?.heroImageUrl,
  });
}

export default async function DrummondLochPage() {
  const [water, boats, permits, seasons, rules, gallery] = await Promise.all([getWater(SLUG), getBoats(SLUG), getPermitTypes(), getSeasons(), getRules(), getGallery({ waterSlug: SLUG })]);
  if (!water) notFound();
  const lochPermits = permits.filter((p) => p.waterSlug === SLUG);
  const lochSeasons = seasons.filter((s) => s.waterSlug === SLUG);
  const lochRules = rules.filter((r) => r.waterSlug === SLUG);

  return (
    <>
      <PageHero
        eyebrow="Drummond Castle Estate"
        title="Drummond Loch"
        intro={water.tagline}
        image={water.heroImageUrl}
        imageAlt={water.heroImageAlt}
        variant="loch"
        seed={5}
        size="lg"
        crumbs={[{ href: "/drummond-loch", label: "Drummond Loch" }]}
        actions={
          <>
            <ButtonLink href="/book?water=drummond-loch" variant="accent" size="lg">Book Drummond Loch <ArrowRight /></ButtonLink>
            <ButtonLink href="#boats" variant="glass" size="lg">The boats</ButtonLink>
          </>
        }
      />

      <section className="py-16 sm:py-20">
        <div className="container-club grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Markdown source={water.description} />
            <ul className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["Method", "Fly only"],
                ["Fishing", "From the boat — no bank fishing"],
                ["Species", "Brown trout"],
              ].map(([k, v]) => (
                <li key={k} className="rounded-2xl border border-line bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone">{k}</p>
                  <p className="mt-1 font-display text-xl">{v}</p>
                </li>
              ))}
            </ul>
          </div>
          <aside className="card self-start p-6">
            <p className="eyebrow">Boats free — next 14 days</p>
            <div className="mt-4">
              {water.bookingEnabled ? <AvailabilityStrip waterSlug={SLUG} /> : <p className="text-sm text-stone">Online booking is currently closed.</p>}
            </div>
          </aside>
        </div>
      </section>

      <section id="boats" className="scroll-mt-20 border-y border-line bg-bone py-16 sm:py-20">
        <div className="container-club">
          <h2 className="display-md">The boats</h2>
          <p className="mt-3 max-w-2xl text-stone">Book one permit per angler and we allocate a boat automatically. Each booking has a boat to itself, shared by up to {Math.max(0, ...boats.map((b) => b.capacity_anglers))} anglers.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {boats.map((b) => (
              <li key={b.name} className="card p-6">
                <svg aria-hidden="true" viewBox="0 0 120 40" className="h-8 w-24 text-loch"><path d="M4 16 Q60 34 116 16 L106 30 Q60 40 14 30 Z" fill="currentColor" /></svg>
                <p className="mt-3 font-display text-2xl">{b.name}</p>
                <p className="text-sm text-stone">{b.description}</p>
                <p className="mt-3 text-sm">Up to {b.capacity_anglers} anglers{b.hire_price_pence > 0 ? ` · boat hire ${formatMoney(b.hire_price_pence)}` : ""}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-club grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="display-md">Permits &amp; prices</h2>
            <div className="mt-6"><PriceTable permits={lochPermits} /></div>
            <h2 className="display-md mt-12">Season</h2>
            <div className="mt-6"><SeasonList seasons={lochSeasons} /></div>
          </div>
          <div>
            <h2 className="display-md">Loch rules</h2>
            <div className="mt-6"><RuleList rules={lochRules} /></div>
            <h2 className="display-md mt-12">Getting there</h2>
            <MapEmbed lat={water.latitude} lng={water.longitude} title="Drummond Loch" zoom={14} approximate className="mt-6" />
            {water.parkingInfo && <p className="mt-4"><strong>Parking:</strong> {water.parkingInfo}</p>}
            {water.accessInfo && <p className="mt-2"><strong>Access:</strong> {water.accessInfo}</p>}
          </div>
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="pb-16 sm:pb-20">
          <div className="container-club">
            <h2 className="display-md mb-8">Photographs</h2>
            <GalleryGrid images={gallery} />
          </div>
        </section>
      )}
      <JsonLd data={placeJsonLd({ name: "Drummond Loch", description: stripMarkdown(water.summary), path: "/drummond-loch", lat: water.latitude, lng: water.longitude, image: water.heroImageUrl })} />
    </>
  );
}
