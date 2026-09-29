import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { getRules } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({
  title: "Club Rules & Permit Conditions",
  description: "Rules for fishing Crieff Angling Club waters on the River Earn and Drummond Loch, including salmon, trout, grayling and boat rules.",
  path: "/rules",
});

const CATEGORIES: [string, string][] = [
  ["general", "General rules"],
  ["river_earn", "River Earn"],
  ["beat", "Beat-specific rules"],
  ["salmon", "Salmon & sea trout"],
  ["trout", "Trout"],
  ["grayling", "Grayling"],
  ["drummond_loch", "Drummond Loch"],
  ["boat", "Boats"],
  ["permit_conditions", "Permit conditions"],
];

export default async function RulesPage() {
  const rules = await getRules();
  const groups = CATEGORIES.map(([k, label]) => ({ k, label, rules: rules.filter((r) => r.category === k) })).filter((g) => g.rules.length);
  return (
    <>
      <PageHero eyebrow="Before you fish" title="Club rules" intro="Everyone who fishes club water — members and visitors — agrees to these rules. They protect the fish, the river and each other's sport." crumbs={[{ href: "/rules", label: "Rules" }]} seed={17} />
      <section className="py-14 sm:py-20">
        <div className="container-club grid gap-12 lg:grid-cols-[14rem_1fr]">
          <nav aria-label="Rule sections" className="lg:sticky lg:top-24 lg:self-start">
            <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
              {groups.map((g) => (
                <li key={g.k}><a href={`#${g.k}`} className="block whitespace-nowrap rounded-full border border-line px-4 py-2 text-sm hover:border-peat lg:rounded-lg lg:border-0 lg:px-3 lg:hover:bg-mist">{g.label}</a></li>
              ))}
            </ul>
          </nav>
          <div className="space-y-14">
            {groups.map((g) => (
              <section key={g.k} id={g.k} className="scroll-mt-24" aria-labelledby={`${g.k}-h`}>
                <h2 id={`${g.k}-h`} className="display-md">{g.label}</h2>
                <ol className="mt-6 space-y-3">
                  {g.rules.map((r, i) => (
                    <li key={r.id} className="flex gap-4 rounded-2xl border border-line bg-white p-5">
                      <span className="font-display text-2xl leading-none text-bracken">{i + 1}</span>
                      <div>
                        <h3 className="font-sans text-base font-semibold">{r.title}{r.beatName ? <span className="font-normal text-stone"> · {r.beatName}</span> : null}</h3>
                        <p className="mt-1 text-peat/80">{r.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
