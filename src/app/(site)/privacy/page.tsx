import type { Metadata } from "next";
import { CmsPage } from "@/components/site/cms-page";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({ title: "Privacy Policy", description: "How Crieff Angling Club uses your personal information.", path: "/privacy" });

export default function Page() {
  return <CmsPage slug="privacy" path="/privacy" />;
}
