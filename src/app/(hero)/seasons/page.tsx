import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { SeasonChart } from "@/components/site/season-chart";
import { SeasonList } from "@/components/site/fishery";
import { getSeasons } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({
  title: "Fishing Seasons — Salmon, Sea Trout, Trout & Grayling",
  description: "Season dates on the River Earn at Crieff and Drummond Loch: salmon and sea trout from 1 February, brown trout from 15 March, and winter grayling.",
  path: "/seasons",
});

export default async function SeasonsPage() {
  const seasons = await getSeasons();
  const byWater = Object.groupBy(seasons, (s) => s.waterName ?? "All waters");
  return (
    <>
      <PageHero eyebrow="When to fish" title="Fishing seasons" intro="Statutory seasons and the club's own restrictions, for every species on every water." crumbs={[{ href: "/seasons", label: "Seasons" }]} variant="winter" seed={4} />
      <section className="py-16 sm:py-20">
        <div className="container-club">
          <SeasonChart seasons={seasons} />
          <div className="mt-14 grid gap-12 lg:grid-cols-2">
            {Object.entries(byWater).map(([w, list]) => (
              <div key={w}>
                <h2 className="display-md">{w}</h2>
                <div className="mt-6"><SeasonList seasons={list ?? []} /></div>
              </div>
            ))}
          </div>
          <p className="mt-12 max-w-3xl text-sm text-stone">Season dates can change by regulation. Salmon conservation grades for the Earn are set each year by the Scottish Government; the club rules page always reflects the current position.</p>
        </div>
      </section>
    </>
  );
}
