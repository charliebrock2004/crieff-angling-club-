import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { CatchReturnForm } from "@/components/site/catch-return-form";
import { getBeats, getSpecies, getWaters } from "@/lib/content/queries";
import { getViewer } from "@/lib/auth";
import { clubToday } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({ title: "Catch Returns", description: "Submit your catch return for the River Earn or Drummond Loch — including blank days.", path: "/catch-returns" });

export default async function CatchReturnsPage({ searchParams }: PageProps<"/catch-returns">) {
  const { ref } = await searchParams;
  const [waters, beats, species, viewer] = await Promise.all([getWaters(), getBeats(), getSpecies(), getViewer().catch(() => null)]);
  return (
    <div className="container-club py-12 sm:py-16">
      <Breadcrumbs items={[{ href: "/catch-returns", label: "Catch returns" }]} />
      <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_1.8fr]">
        <div>
          <h1 className="display-lg">Catch returns</h1>
          <p className="lede mt-4">Every angler — member or visitor — is asked to make a return after each day, including blank days. It takes a minute and it&rsquo;s the best record the club has of how the river is fishing.</p>
          <ul className="mt-6 space-y-2 text-stone">
            <li>• Record every fish, including those released.</li>
            <li>• Salmon and grilse must currently be returned alive.</li>
            <li>• Loch anglers can still use the box at the boat house if you prefer.</li>
          </ul>
          {!viewer && <p className="mt-6 text-sm text-stone"><Link href="/login?next=/catch-returns" className="link-underline">Sign in</Link> to keep a history of your returns in your account.</p>}
        </div>
        <div className="card p-6 sm:p-10">
          <CatchReturnForm
            today={clubToday()}
            waters={waters.map((w) => ({ id: w.id, name: w.name, beats: beats.filter((b) => b.waterId === w.id).map((b) => ({ id: b.id, name: b.name })) }))}
            species={species.map((s) => ({ id: s.id as string, name: s.name as string }))}
            defaults={{ name: viewer?.fullName ?? undefined, email: viewer?.email, reference: typeof ref === "string" ? ref : undefined }}
          />
        </div>
      </div>
    </div>
  );
}
