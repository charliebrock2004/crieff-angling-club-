import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { NewsCard } from "@/components/site/news-card";
import { EmptyState } from "@/components/ui/section";
import { getNews } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({ title: "News", description: "News from Crieff Angling Club: river reports, club notices and the AGM.", path: "/news" });

export default async function NewsPage() {
  const posts = await getNews(60);
  const featured = posts.find((p) => p.isFeatured) ?? posts[0];
  const rest = posts.filter((p) => p.id !== featured?.id);
  return (
    <>
      <PageHero eyebrow="From the club" title="News" crumbs={[{ href: "/news", label: "News" }]} variant="dusk" seed={12} />
      <section className="py-14 sm:py-20">
        <div className="container-club">
          {featured ? (
            <>
              <NewsCard post={featured} featured />
              {rest.length > 0 && <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{rest.map((p) => <NewsCard key={p.id} post={p} />)}</div>}
            </>
          ) : (
            <EmptyState title="No news yet">Check back soon for river reports and club notices.</EmptyState>
          )}
        </div>
      </section>
    </>
  );
}
