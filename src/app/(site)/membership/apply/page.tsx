import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { MembershipForm } from "@/components/site/membership-form";
import { getMembershipTypes } from "@/lib/content/queries";
import { getViewer } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata({ title: "Apply for Membership", description: "Apply to join Crieff Angling Club.", path: "/membership/apply" });

export default async function ApplyPage({ searchParams }: PageProps<"/membership/apply">) {
  const { type } = await searchParams;
  const [types, viewer] = await Promise.all([getMembershipTypes(), getViewer().catch(() => null)]);
  return (
    <div className="container-club max-w-3xl py-12 sm:py-16">
      <Breadcrumbs items={[{ href: "/membership", label: "Membership" }, { href: "/membership/apply", label: "Apply" }]} />
      <h1 className="display-lg mt-6">Apply for membership</h1>
      <p className="lede mt-4">There&rsquo;s nothing to pay now. We&rsquo;ll add you to the list and email you a secure payment link when a place is available.</p>
      <div className="card mt-10 p-6 sm:p-10">
        <MembershipForm types={types.filter((t) => t.onlineApplicationEnabled)} defaultType={typeof type === "string" ? type : undefined} defaults={{ email: viewer?.email }} />
      </div>
    </div>
  );
}
