import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { MapEmbed } from "@/components/site/map-embed";
import { getBeats, getWaters } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({
  title: "Maps, Access & Parking",
  description: "Maps of Crieff Angling Club waters: the Upper Strowan, Braidhaugh and Drummond Castle beats on the River Earn, and Drummond Loch.",
  path: "/maps",
});

export default async function MapsPage() {
  const [waters, beats] = await Promise.all([getWaters(), getBeats()]);
  const items = beats.map((b) => {
    const w = waters.find((x) => x.id === b.waterId)!;
    const single = beats.filter((x) => x.waterId === w.id).length === 1;
    return { key: b.id, name: single ? w.name : b.name, sub: single ? w.locationName : `${w.name}`, href: single ? `/${w.slug}` : `/${w.slug}/${b.slug}`, lat: b.latitude, lng: b.longitude, approx: b.locationIsApproximate, access: b.accessInfo ?? w.accessInfo, parking: b.parkingInfo ?? w.parkingInfo, boundaries: b.boundaries };
  });
  return (
    <>
      <PageHero eyebrow="Finding the water" title="Maps & access" intro="Where each beat is, how to reach it and where to park." crumbs={[{ href: "/maps", label: "Maps" }]} seed={23} />
      <section className="py-16 sm:py-20">
        <div className="container-club space-y-16">
          {items.map((i) => (
            <article key={i.key} className="grid gap-8 lg:grid-cols-[1.4fr_1fr]" id={i.href.split("/").pop()}>
              <MapEmbed lat={i.lat} lng={i.lng} title={i.name} approximate={i.approx} />
              <div>
                <p className="eyebrow">{i.sub}</p>
                <h2 className="display-md mt-2">{i.name}</h2>
                <dl className="mt-6 space-y-4">
                  {[["Access", i.access], ["Parking", i.parking], ["Boundaries", i.boundaries]].map(([k, v]) => (
                    <div key={k}><dt className="font-semibold">{k}</dt><dd className="mt-1 whitespace-pre-line text-stone">{v ?? "Details to follow — please contact the club before your first visit."}</dd></div>
                  ))}
                </dl>
                <Link href={i.href} className="link-underline mt-6 inline-block font-semibold">About {i.name}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
