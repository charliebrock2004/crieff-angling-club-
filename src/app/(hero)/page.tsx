import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ButtonLink } from "@/components/ui/button";
import { HeroMedia } from "@/components/site/hero-media";
import { Landscape } from "@/components/site/landscape";
import { NewsCard } from "@/components/site/news-card";
import { SeasonChart } from "@/components/site/season-chart";
import { MapEmbed } from "@/components/site/map-embed";
import { getBeats, getGallery, getMembershipTypes, getNews, getPermitTypes, getRules, getSeasons, getSpecies, getWaters } from "@/lib/content/queries";
import { clubToday, inRecurringRange, weekday } from "@/lib/dates";
import { formatMoney, formatMonthDay } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Crieff Angling Club — Fishing on the River Earn & Drummond Loch",
    description:
      "Fish the River Earn at Crieff, Perthshire: salmon, sea trout, brown trout and grayling on three club beats, plus fly-only boat fishing on Drummond Loch. Check live availability and book day permits online.",
    path: "/",
  }),
  title: { absolute: "Crieff Angling Club — Fishing on the River Earn & Drummond Loch" },
};

export default async function HomePage() {
  const [waters, beats, species, seasons, permits, news, gallery, memberships, rules] = await Promise.all([
    getWaters(),
    getBeats(),
    getSpecies(),
    getSeasons(),
    getPermitTypes(),
    getNews(3),
    getGallery({ limit: 6 }),
    getMembershipTypes(),
    getRules(),
  ]);
  const river = waters.find((w) => w.kind === "river");
  const loch = waters.find((w) => w.kind === "loch");
  const riverBeats = beats.filter((b) => b.waterSlug === river?.slug);
  const today = clubToday();
  const openToday = seasons.filter((s) => inRecurringRange(today, s) && !s.closedWeekdays.includes(weekday(today)));
  const fromPrice = (slugs: string[]) => {
    const prices = permits.filter((p) => slugs.includes(p.waterSlug) && !p.isJunior).flatMap((p) => p.prices.map((x) => x.pricePence));
    return prices.length ? Math.min(...prices) : null;
  };
  const keyRules = rules.filter((r) => ["general", "river_earn", "drummond_loch", "salmon"].includes(r.category)).slice(0, 5);

  return (
    <>
      {/* HERO */}
      <section className="grain relative flex min-h-[100svh] items-end overflow-hidden bg-peat text-bone">
        <HeroMedia src={river?.heroImageUrl} alt={river?.heroImageAlt} variant="river" seed={7} priority />
        <div className="absolute inset-0 bg-gradient-to-t from-peat via-peat/35 to-peat/20" aria-hidden="true" />
        <div className="container-club relative pb-14 pt-36 sm:pb-20">
          <p className="eyebrow animate-fade text-bracken">Crieff · Perthshire · Scotland</p>
          <h1 className="display-xl mt-5 max-w-5xl animate-rise">
            Fish the <em className="font-normal italic text-[#f0dcb5]">River Earn</em>
          </h1>
          <p className="mt-6 max-w-xl animate-rise text-lg leading-relaxed text-bone/85 [animation-delay:120ms] sm:text-xl">
            Three club beats on the upper Earn and a fly-only brown trout loch in the grounds of Drummond Castle. Salmon, sea trout, trout and grayling, on the doorstep of Crieff.
          </p>
          <div className="mt-9 flex animate-rise flex-wrap gap-3 [animation-delay:220ms]">
            <ButtonLink href="/book" variant="accent" size="lg">
              Book a permit <ArrowRight />
            </ButtonLink>
            <ButtonLink href="#waters" variant="glass" size="lg">
              Explore the waters
            </ButtonLink>
          </div>
          <dl className="mt-14 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/10 text-sm backdrop-blur-md sm:grid-cols-4">
            {[
              { k: "What", v: species.map((s) => s.name.replace("Atlantic salmon", "Salmon")).join(", ") },
              { k: "Where", v: `${riverBeats.length} River Earn beats + Drummond Loch` },
              { k: "When", v: openToday.length ? `Open today: ${openToday.map((s) => s.name.replace(/ \(.*\)/, "")).filter((v, i, a) => a.indexOf(v) === i).join(", ")}` : "See the season calendar" },
              { k: "How", v: "Day permits online — instant digital permit" },
            ].map((x) => (
              <div key={x.k} className="bg-peat/40 p-4">
                <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-bracken">{x.k}</dt>
                <dd className="mt-1.5 leading-snug text-bone/90">{x.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* THE WATERS */}
      <section id="waters" className="scroll-mt-20 py-20 sm:py-28">
        <div className="container-club">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
            <div>
              <p className="eyebrow">The waters</p>
              <h2 className="display-lg mt-4">Three beats on the upper Earn, and a loch of our own.</h2>
            </div>
            <p className="lede">{river?.summary}</p>
          </div>

          <ol className="mt-14 grid gap-5 md:grid-cols-3">
            {riverBeats.map((b, i) => (
              <li key={b.id}>
                <Link href={`/river-earn/${b.slug}`} className="group relative flex h-full min-h-[26rem] flex-col justify-end overflow-hidden rounded-[var(--radius-card)] bg-peat p-6 text-bone shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-lift)]">
                  <div className="absolute inset-0 transition duration-700 group-hover:scale-[1.04]">
                    <HeroMedia src={b.heroImageUrl} alt={b.heroImageAlt} seed={11 + i * 5} variant={i === 2 ? "dusk" : "river"} sizes="(min-width:768px) 33vw, 100vw" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-peat via-peat/50 to-transparent" aria-hidden="true" />
                  <div className="relative">
                    <span className="font-display text-5xl text-bone/35">0{i + 1}</span>
                    <h3 className="mt-2 font-display text-3xl">{b.name}</h3>
                    <p className="mt-2 text-bone/80">{b.tagline}</p>
                    <p className="mt-5 flex flex-wrap gap-2">
                      {b.species.map((s) => (
                        <span key={s.slug} className="rounded-full border border-white/25 px-2.5 py-0.5 text-xs">{s.name.replace("Atlantic salmon", "Salmon")}</span>
                      ))}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-bracken">
                      Explore the beat <ArrowRight className="transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>

          {loch && (
            <Link href={`/${loch.slug}`} className="group mt-5 grid overflow-hidden rounded-[var(--radius-card)] bg-loch text-bone shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-lift)] md:grid-cols-2">
              <div className="relative min-h-72 overflow-hidden">
                <div className="absolute inset-0 transition duration-700 group-hover:scale-[1.04]">
                  <HeroMedia src={loch.heroImageUrl} alt={loch.heroImageAlt} variant="loch" seed={5} sizes="(min-width:768px) 50vw, 100vw" />
                </div>
              </div>
              <div className="flex flex-col justify-center p-8 sm:p-12">
                <p className="eyebrow text-[#e7c89b]">Drummond Loch</p>
                <h3 className="mt-3 font-display text-4xl leading-tight">{loch.tagline}</h3>
                <p className="mt-4 text-bone/80">{loch.summary}</p>
                <span className="mt-8 inline-flex items-center gap-2 font-semibold text-[#e7c89b]">
                  Boats, permits &amp; the loch <ArrowRight className="transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* SPECIES */}
      <section className="border-y border-line bg-bone py-20 sm:py-24">
        <div className="container-club">
          <p className="eyebrow">What you can fish</p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {species.map((s) => {
              const ss = seasons.filter((x) => x.speciesSlug === s.slug);
              return (
                <div key={s.id} className="bg-bone p-7">
                  <h3 className="font-display text-3xl">{s.name}</h3>
                  {s.scientific_name && <p className="mt-1 text-sm italic text-stone">{s.scientific_name}</p>}
                  <p className="mt-4 text-[0.95rem] leading-relaxed text-peat/80">{s.description}</p>
                  <ul className="mt-5 space-y-1 text-sm">
                    {ss.map((x) => (
                      <li key={x.id} className="flex justify-between gap-3 border-t border-line pt-2">
                        <span className="text-stone">{x.waterName}{x.beatName ? ` · ${x.beatName}` : ""}</span>
                        <span className="font-medium">{formatMonthDay(x.startMonth, x.startDay)} – {formatMonthDay(x.endMonth, x.endDay)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SEASONS */}
      <section className="py-20 sm:py-28">
        <div className="container-club grid gap-12 lg:grid-cols-[0.8fr_1.4fr] lg:items-center">
          <div>
            <p className="eyebrow">When to fish</p>
            <h2 className="display-lg mt-4">Something to fish almost all year.</h2>
            <p className="lede mt-5">Salmon and sea trout from February, trout through the summer, and grayling on the Drummond Castle water when everything else has closed.</p>
            <Link href="/seasons" className="link-underline mt-6 inline-block font-semibold">Full season dates &amp; restrictions</Link>
          </div>
          <SeasonChart seasons={seasons} />
        </div>
      </section>

      {/* PERMITS + MEMBERSHIP */}
      <section className="grain bg-peat py-20 text-bone sm:py-28">
        <div className="container-club">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="eyebrow">Permits</p>
              <h2 className="display-lg mt-4">Book in two minutes. Fish the same day.</h2>
            </div>
            <p className="text-lg leading-relaxed text-bone/75">
              Pick a date and a beat, see exactly how many permits are left, pay securely and your digital permit arrives by email with a QR code for the bailiff.
            </p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              { title: "River Earn", body: "Separate day permits for salmon & sea trout, brown trout and grayling.", price: fromPrice(riverBeats.length ? [river!.slug] : []), href: "/book?water=river-earn" },
              { title: "Drummond Loch", body: "Fly only, from the boat. Up to three anglers share a boat.", price: loch ? fromPrice([loch.slug]) : null, href: "/book?water=drummond-loch" },
              { title: "Juniors", body: "Reduced-price junior permits for brown trout and grayling.", price: (() => { const p = permits.filter((x) => x.isJunior).flatMap((x) => x.prices.map((y) => y.pricePence)); return p.length ? Math.min(...p) : null; })(), href: "/permits" },
            ].map((c) => (
              <Link key={c.title} href={c.href} className="group flex flex-col rounded-[var(--radius-card)] border border-white/12 bg-white/[0.04] p-7 transition hover:border-bracken/60 hover:bg-white/[0.07]">
                <h3 className="font-display text-2xl">{c.title}</h3>
                <p className="mt-3 flex-1 text-bone/70">{c.body}</p>
                {c.price !== null && (
                  <p className="mt-6 font-display text-4xl">
                    <span className="text-base text-bone/60">from </span>
                    {formatMoney(c.price)}
                    <span className="text-base text-bone/60"> / day</span>
                  </p>
                )}
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-bracken">Check availability <ArrowRight /></span>
              </Link>
            ))}
          </div>
          {memberships.length > 0 && (
            <div className="mt-5 flex flex-col gap-6 rounded-[var(--radius-card)] bg-bone p-8 text-peat md:flex-row md:items-center md:justify-between">
              <div>
                <p className="eyebrow">Membership</p>
                <p className="mt-2 font-display text-3xl">Fish the Earn all season as a member.</p>
                <p className="mt-2 text-stone">
                  {memberships.map((m) => `${m.name} ${formatMoney(m.pricePence)}`).join(" · ")}
                  {memberships[0]?.joiningFeePence ? ` · ${formatMoney(memberships[0].joiningFeePence)} joining fee` : ""}
                </p>
              </div>
              <ButtonLink href="/membership" variant="primary" size="lg">Membership &amp; applications</ButtonLink>
            </div>
          )}
        </div>
      </section>

      {/* MAP + RULES */}
      <section className="py-20 sm:py-28">
        <div className="container-club grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Finding us</p>
            <h2 className="display-md mt-4">On the edge of Crieff, either side of the bridge.</h2>
            <p className="mt-4 text-stone">Upper Strowan lies upstream towards Comrie, Braidhaugh sits just above Crieff Bridge, and the Drummond Castle water runs downstream from it.</p>
            <MapEmbed lat={river?.latitude ?? null} lng={river?.longitude ?? null} title="River Earn at Crieff" zoom={12} approximate className="mt-8" />
            <Link href="/maps" className="link-underline mt-4 inline-block font-semibold">Maps, access &amp; parking for every beat</Link>
          </div>
          <div>
            <p className="eyebrow">Before you go</p>
            <h2 className="display-md mt-4">The rules that matter most.</h2>
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {keyRules.map((r) => (
                <li key={r.id} className="py-5">
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-1 text-stone">{r.body}</p>
                </li>
              ))}
            </ul>
            <Link href="/rules" className="link-underline mt-6 inline-block font-semibold">Read all club rules</Link>
          </div>
        </div>
      </section>

      {/* NEWS */}
      {news.length > 0 && (
        <section className="border-t border-line bg-bone py-20 sm:py-24">
          <div className="container-club">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">From the club</p>
                <h2 className="display-md mt-3">Latest news</h2>
              </div>
              <Link href="/news" className="link-underline font-semibold">All news</Link>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {news.map((p) => (
                <NewsCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section className="py-20 sm:py-24">
          <div className="container-club">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="display-md">On the water</h2>
              <Link href="/gallery" className="link-underline font-semibold">View the gallery</Link>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
              {gallery.map((g, i) => (
                <li key={g.id} className={`relative overflow-hidden rounded-2xl bg-mist ${i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"}`}>
                  <Image src={g.url} alt={g.alt} fill sizes="(min-width:768px) 33vw, 50vw" className="object-cover" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="grain relative overflow-hidden bg-peat text-bone">
        <Landscape variant="dusk" seed={21} className="absolute inset-0 h-full w-full opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-peat/90 via-peat/60 to-transparent" aria-hidden="true" />
        <div className="container-club relative py-24 sm:py-32">
          <h2 className="display-lg max-w-2xl">Choose a day. We&rsquo;ll keep a place on the river.</h2>
          <p className="mt-5 max-w-lg text-lg text-bone/80">Live availability for every beat, instant confirmation and a digital permit on your phone.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/book" variant="accent" size="lg">
              Book a permit <ArrowRight />
            </ButtonLink>
            <ButtonLink href="/permits" variant="glass" size="lg">
              Permits &amp; prices
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
