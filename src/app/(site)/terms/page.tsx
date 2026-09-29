import type { Metadata } from "next";
import { CmsPage } from "@/components/site/cms-page";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({ title: "Terms & Conditions", description: "Terms for buying fishing permits and memberships from Crieff Angling Club.", path: "/terms" });

export default function Page() {
  return <CmsPage slug="terms" path="/terms" />;
}
