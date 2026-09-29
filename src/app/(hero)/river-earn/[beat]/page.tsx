import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { Markdown, stripMarkdown } from "@/lib/markdown";
import { MapEmbed } from "@/components/site/map-embed";
import { JsonLd } from "@/components/site/json-ld";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { AvailabilityStrip, PriceTable, RuleList, SeasonList } from "@/components/site/fishery";
import { getBeat, getBeats, getGallery, getPermitTypes, getRules, getSeasons } from "@/lib/content/queries";
import { pageMetadata, placeJsonLd } from "@/lib/seo";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await getBeats("river-earn")).map((b) => ({ beat: b.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps<"/river-earn/[beat]">): Promise<Metadata> {
  const b = await getBeat((await params).beat);
  if (!b || b.waterSlug !== "river-earn") return {};
  return pageMetadata({
    title: b.seoTitle ?? `${b.name} Beat — River Earn`,
    description: b.seoDescription ?? stripMarkdown(b.summary).slice(0, 160),
    path: `/river-earn/${b.slug}`,
    image: b.heroImageUrl,
  });
}

export default async function BeatPage({ params }: PageProps<"/river-earn/[beat]">) {
  const { beat: slug } = await params;
  const beat = await getBeat(slug);
  if (!beat || beat.waterSlug !== "river-earn") notFound();
  const [permits, seasons, rules, gallery, siblings] = await Promise.all([getPermitTypes(), getSeasons(), getRules(), getGallery({ beatSlug: slug }), getBeats("river-earn")]);
  const beatPermits = permits.filter((p) => p.waterSlug === "river-earn" && (p.beats.length === 0 || p.beats.includes(beat.name)));
  const speciesSlugs = beat.species.map((s) => s.slug);
  const beatSeasons = seasons.filter((s) => s.waterSlug === "river-earn" && (!s.beatName || s.beatName === beat.name) && (!s.speciesSlug || speciesSlugs.includes(s.speciesSlug)));
  const beatRules = rules.filter((r) => r.beatSlug === slug || (r.waterSlug === "river-earn" && !r.beatSlug && (!r.speciesSlug || speciesSlugs.includes(r.speciesSlug))));
  const idx = siblings.findIndex((b) => b.slug === slug);

  return (
    <>
      <PageHero
        eyebrow={`River Earn · Beat 0${idx + 1}`}
        title={beat.name}
        intro={beat.tagline}
        image={beat.heroImageUrl}
        imageAlt={beat.heroImageAlt}
        seed={11 + idx * 5}
        variant={idx === 2 ? "dusk" : "river"}
        size="lg"
        crumbs={[{ href: "/river-earn", label: "River Earn" }, { href: `/river-earn/${slug}`, label: beat.name }]}
        actions={
          <>
            <ButtonLink href={`/book?beat=${slug}`} variant="accent" size="lg">Book this beat <ArrowRight /></ButtonLink>
            <ButtonLink href="#map" variant="glass" size="lg">Map &amp; access</ButtonLink>
          </>
        }
      />

      <section className="py-16 sm:py-20">
        <div className="container-club grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Markdown source={beat.description} />
            {beat.fishingInfo && (
              <div className="mt-10">
                <h2 className="display-md">Fishing the beat</h2>
                <ul className="mt-5 space-y-2">
                  {beat.fishingInfo.split(/\n+/).filter(Boolean).map((l) => (
                    <li key={l} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-bracken" />{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <aside className="space-y-6">
            <div className="card p-6">
              <p className="eyebrow">At a glance</p>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Species", beat.species.map((s) => s.name).join(", ")],
                  ["Banks", beat.banks],
                  ["Length", beat.lengthDescription],
                  ["Visitor permits", `${beat.dailyCapacity} per day`],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"><dt className="text-stone">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                ))}
              </dl>
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Next 14 days</p>
                <Link href={`/book?beat=${slug}`} className="text-sm font-semibold text-bracken">Full calendar</Link>
              </div>
              <div className="mt-4">
                {beat.bookingEnabled ? <AvailabilityStrip beatSlug={slug} /> : <p className="text-sm text-stone">Online booking for this beat is currently closed.</p>}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-line bg-bone py-16 sm:py-20">
        <div className="container-club grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="display-md">Permits for {beat.name}</h2>
            <div className="mt-6"><PriceTable permits={beatPermits} /></div>
          </div>
          <div>
            <h2 className="display-md">Seasons</h2>
            <div className="mt-6"><SeasonList seasons={beatSeasons} /></div>
            <h2 className="display-md mt-12">Rules</h2>
            <div className="mt-6"><RuleList rules={beatRules} /></div>
          </div>
        </div>
      </section>

      <section id="map" className="scroll-mt-20 py-16 sm:py-20">
        <div className="container-club grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <MapEmbed lat={beat.latitude} lng={beat.longitude} title={beat.name} approximate={beat.locationIsApproximate} />
          <div>
            <h2 className="display-md">Access &amp; parking</h2>
            <dl className="mt-6 space-y-5">
              {[
                ["Access", beat.accessInfo],
                ["Parking", beat.parkingInfo],
                ["Boundaries", beat.boundaries],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-semibold">{k}</dt>
                  <dd className="mt-1 whitespace-pre-line text-stone">{v ?? "Details to follow — please contact the club before your first visit."}</dd>
                </div>
              ))}
            </dl>
            {beat.pointsOfInterest.length > 0 && (
              <ul className="mt-6 space-y-2 text-sm">
                {beat.pointsOfInterest.map((p) => <li key={p.name}><strong>{p.name}</strong>{p.description ? ` — ${p.description}` : ""}</li>)}
              </ul>
            )}
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

      <section className="bg-peat py-14 text-bone">
        <div className="container-club flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-3xl">Fish {beat.name}</p>
            <p className="mt-1 text-bone/70">{beat.dailyCapacity} visitor permits a day. Book online in a couple of minutes.</p>
          </div>
          <ButtonLink href={`/book?beat=${slug}`} variant="accent" size="lg">Book this beat <ArrowRight /></ButtonLink>
        </div>
        <nav aria-label="Other beats" className="container-club mt-10 flex flex-wrap gap-3 border-t border-white/10 pt-8 text-sm">
          {siblings.filter((b) => b.slug !== slug).map((b) => (
            <Link key={b.slug} href={`/river-earn/${b.slug}`} className="rounded-full border border-white/20 px-4 py-2 hover:border-bracken">{b.name} →</Link>
          ))}
          <Link href="/drummond-loch" className="rounded-full border border-white/20 px-4 py-2 hover:border-bracken">Drummond Loch →</Link>
        </nav>
      </section>
      <JsonLd data={placeJsonLd({ name: `${beat.name} beat, River Earn`, description: stripMarkdown(beat.summary), path: `/river-earn/${slug}`, lat: beat.latitude, lng: beat.longitude, image: beat.heroImageUrl })} />
    </>
  );
}
