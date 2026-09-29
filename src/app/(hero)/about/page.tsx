import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";
import { Markdown, stripMarkdown } from "@/lib/markdown";
import { getPage } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const p = await getPage("about");
  return pageMetadata({ title: p?.seoTitle ?? "About the Club", description: p?.seoDescription ?? stripMarkdown(p?.intro).slice(0, 160), path: "/about" });
}

export default async function AboutPage() {
  const page = await getPage("about");
  if (!page) notFound();
  return (
    <>
      <PageHero eyebrow="Crieff Angling Club" title={page.title} intro={page.intro} crumbs={[{ href: "/about", label: "About" }]} seed={31} />
      <section className="container-club py-14 sm:py-20">
        <Markdown source={page.body} />
      </section>
    </>
  );
}
