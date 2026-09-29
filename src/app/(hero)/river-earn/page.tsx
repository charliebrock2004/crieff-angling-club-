import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { HeroMedia } from "@/components/site/hero-media";
import { Markdown, stripMarkdown } from "@/lib/markdown";
import { MapEmbed } from "@/components/site/map-embed";
import { JsonLd } from "@/components/site/json-ld";
import { PriceTable, RuleList, SeasonList } from "@/components/site/fishery";
import { getBeats, getPermitTypes, getRules, getSeasons, getWater } from "@/lib/content/queries";
import { pageMetadata, placeJsonLd } from "@/lib/seo";

export const revalidate = 300;
const SLUG = "river-earn";

export async function generateMetadata(): Promise<Metadata> {
  const w = await getWater(SLUG);
  return pageMetadata({
    title: w?.seoTitle ?? "River Earn Fishing at Crieff",
    description: w?.seoDescription ?? stripMarkdown(w?.summary).slice(0, 160),
    path: "/river-earn",
    image: w?.heroImageUrl,
  });
}

export default async function RiverEarnPage() {
  const [water, beats, permits, seasons, rules] = await Promise.all([getWater(SLUG), getBeats(SLUG), getPermitTypes(), getSeasons(), getRules()]);
  if (!water) notFound();
  const riverPermits = permits.filter((p) => p.waterSlug === SLUG);
  const riverSeasons = seasons.filter((s) => s.waterSlug === SLUG);
  const riverRules = rules.filter((r) => r.waterSlug === SLUG && !r.beatSlug);

  return (
    <>
      <PageHero
        eyebrow="Crieff · Perthshire"
        title="The River Earn"
        intro={water.tagline}
        image={water.heroImageUrl}
        imageAlt={water.heroImageAlt}
        crumbs={[{ href: "/river-earn", label: "River Earn" }]}
        size="lg"
        seed={9}
        actions={
          <>
            <ButtonLink href="/book?water=river-earn" variant="accent" size="lg">Book a River Earn permit <ArrowRight /></ButtonLink>
            <ButtonLink href="#beats" variant="glass" size="lg">The three beats</ButtonLink>
          </>
        }
      />

      <section className="py-16 sm:py-24">
        <div className="container-club grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <Markdown source={water.description} />
          <aside className="space-y-6">
            <div className="card p-6">
              <p className="eyebrow">At a glance</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3 border-b border-line pb-3"><dt className="text-stone">Beats</dt><dd className="font-medium">{beats.map((b) => b.name).join(", ")}</dd></div>
                <div className="flex justify-between gap-3 border-b border-line pb-3"><dt className="text-stone">Species</dt><dd className="text-right font-medium">Salmon, sea trout, brown trout, grayling</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-stone">Visitor permits</dt><dd className="text-right font-medium">Limited daily numbers per beat</dd></div>
              </dl>
            </div>
            <MapEmbed lat={water.latitude} lng={water.longitude} title="River Earn at Crieff" zoom={12} approximate />
          </aside>
        </div>
      </section>

      <section id="beats" className="scroll-mt-20 border-y border-line bg-bone py-16 sm:py-24">
        <div className="container-club">
          <p className="eyebrow">The beats</p>
          <h2 className="display-lg mt-3">Upstream to downstream</h2>
          <ol className="mt-12 space-y-6">
            {beats.map((b, i) => (
              <li key={b.id}>
                <Link href={`/river-earn/${b.slug}`} className="group grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-lift)] md:grid-cols-[2fr_3fr]">
                  <div className="relative min-h-60 overflow-hidden bg-peat">
                    <div className="absolute inset-0 transition duration-700 group-hover:scale-[1.04]">
                      <HeroMedia src={b.heroImageUrl} alt={b.heroImageAlt} seed={11 + i * 5} variant={i === 2 ? "dusk" : "river"} sizes="(min-width:768px) 40vw, 100vw" />
                    </div>
                  </div>
                  <div className="flex flex-col justify-center p-7 sm:p-10">
                    <span className="font-display text-lg text-bracken">0{i + 1}</span>
                    <h3 className="mt-1 font-display text-3xl">{b.name}</h3>
                    <p className="mt-3 text-stone">{b.summary}</p>
                    <p className="mt-4 flex flex-wrap gap-2">
                      {b.species.map((s) => <span key={s.slug} className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-medium">{s.name}</span>)}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-2 font-semibold">Explore {b.name} <ArrowRight className="transition group-hover:translate-x-1" /></span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="container-club grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="display-md">Seasons</h2>
            <div className="mt-6"><SeasonList seasons={riverSeasons} /></div>
            <h2 className="display-md mt-14">River rules</h2>
            <div className="mt-6"><RuleList rules={riverRules} /></div>
            <Link href="/rules" className="link-underline mt-4 inline-block font-semibold">All club rules</Link>
          </div>
          <div>
            <h2 className="display-md">Day permits</h2>
            <div className="mt-6"><PriceTable permits={riverPermits} /></div>
          </div>
        </div>
      </section>
      <JsonLd data={placeJsonLd({ name: "River Earn — Crieff Angling Club", description: stripMarkdown(water.summary), path: "/river-earn", lat: water.latitude, lng: water.longitude, image: water.heroImageUrl })} />
    </>
  );
}
