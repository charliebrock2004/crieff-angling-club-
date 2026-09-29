import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";
import { JsonLd } from "@/components/site/json-ld";
import { Markdown, stripMarkdown } from "@/lib/markdown";
import { getNews, getNewsPost } from "@/lib/content/queries";
import { absoluteUrl, pageMetadata, siteUrl } from "@/lib/seo";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await getNews(20)).map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const p = await getNewsPost((await params).slug);
  if (!p) return {};
  return pageMetadata({ title: p.seoTitle ?? p.title, description: p.seoDescription ?? p.excerpt ?? stripMarkdown(p.body).slice(0, 160), path: `/news/${p.slug}`, image: p.coverImageUrl, type: "article", publishedTime: p.publishedAt });
}

export default async function NewsPostPage({ params }: PageProps<"/news/[slug]">) {
  const post = await getNewsPost((await params).slug);
  if (!post) notFound();
  const date = new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <>
      <PageHero eyebrow={date} title={post.title} intro={post.excerpt} image={post.coverImageUrl} imageAlt={post.coverImageAlt} variant="dusk" seed={post.title.length} crumbs={[{ href: "/news", label: "News" }, { href: `/news/${post.slug}`, label: post.title }]} />
      <article className="container-club py-14 sm:py-20">
        <Markdown source={post.body} className="prose-club mx-auto" />
        <p className="mx-auto mt-12 max-w-[68ch] border-t border-line pt-6"><Link href="/news" className="link-underline font-semibold">← All news</Link></p>
      </article>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "NewsArticle", headline: post.title, datePublished: post.publishedAt, dateModified: post.updatedAt, description: post.excerpt ?? undefined, image: post.coverImageUrl ? [post.coverImageUrl] : undefined, mainEntityOfPage: absoluteUrl(`/news/${post.slug}`), publisher: { "@id": `${siteUrl()}/#organization` }, author: { "@type": "Organization", name: "Crieff Angling Club" } }} />
    </>
  );
}
