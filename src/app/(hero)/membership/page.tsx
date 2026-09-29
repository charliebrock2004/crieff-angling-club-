import type { Metadata } from "next";
import { ArrowRight, ButtonLink } from "@/components/ui/button";
import { PageHero } from "@/components/site/page-hero";
import { getMembershipTypes } from "@/lib/content/queries";
import { formatMoney, formatMonthDay } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({ title: "Membership", description: "Join Crieff Angling Club: local and country membership for season-long fishing on the River Earn. Apply online.", path: "/membership" });

export default async function MembershipPage() {
  const types = await getMembershipTypes();
  return (
    <>
      <PageHero eyebrow="Join the club" title="Membership" intro="Members fish the club's River Earn water throughout the season, including the last fortnight of October when no day permits are sold." crumbs={[{ href: "/membership", label: "Membership" }]} seed={19} actions={<ButtonLink href="/membership/apply" variant="accent" size="lg">Apply for membership <ArrowRight /></ButtonLink>} />
      <section className="py-16 sm:py-20">
        <div className="container-club">
          <div className="grid gap-6 md:grid-cols-2">
            {types.map((t) => (
              <article key={t.id} className="card flex flex-col p-8">
                <h2 className="font-display text-3xl">{t.name}</h2>
                {t.eligibility && <p className="mt-2 text-stone">{t.eligibility}</p>}
                <p className="mt-6 font-display text-5xl">{formatMoney(t.pricePence)}<span className="font-sans text-base text-stone"> / year</span></p>
                {t.joiningFeePence > 0 && <p className="mt-1 text-sm text-stone">plus a {formatMoney(t.joiningFeePence)} joining fee in your first year</p>}
                {t.description && <p className="mt-5">{t.description}</p>}
                {t.benefits.length > 0 && (
                  <ul className="mt-5 space-y-2">
                    {t.benefits.map((b) => <li key={b} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-bracken" />{b}</li>)}
                  </ul>
                )}
                <p className="mt-6 text-sm text-stone">Membership runs to {formatMonthDay(t.expiryMonth, t.expiryDay)}.</p>
                {t.onlineApplicationEnabled && <ButtonLink href={`/membership/apply?type=${t.slug}`} variant="primary" className="mt-8 self-start">Apply for {t.name.toLowerCase()}</ButtonLink>}
              </article>
            ))}
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              ["1. Apply online", "Tell us which membership you'd like. There's no charge to apply."],
              ["2. Waiting list", "Applications are held by the Secretary until there is room on the membership list."],
              ["3. Pay and fish", "When a place is available we'll email a secure link to pay. Your membership starts as soon as you've paid."],
            ].map(([t, d]) => (
              <div key={t}>
                <p className="font-display text-2xl">{t}</p>
                <p className="mt-2 text-stone">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
