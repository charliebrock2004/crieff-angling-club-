import type { Metadata } from "next";
import { CmsPage } from "@/components/site/cms-page";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({ title: "Cancellation Policy", description: "Cancellations and refunds for Crieff Angling Club fishing permits.", path: "/cancellation-policy" });

export default function Page() {
  return <CmsPage slug="cancellation-policy" path="/cancellation-policy" />;
}
