import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { EmptyState } from "@/components/ui/section";
import { getGallery, getGalleryCategories } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({ title: "Gallery", description: "Photographs from the River Earn at Crieff and Drummond Loch.", path: "/gallery" });

export default async function GalleryPage({ searchParams }: PageProps<"/gallery">) {
  const { c } = await searchParams;
  const [images, cats] = await Promise.all([getGallery(), getGalleryCategories()]);
  const shown = typeof c === "string" ? images.filter((i) => i.categorySlug === c) : images;
  return (
    <>
      <PageHero eyebrow="On the water" title="Gallery" crumbs={[{ href: "/gallery", label: "Gallery" }]} variant="dusk" seed={8} />
      <section className="py-14 sm:py-20">
        <div className="container-club">
          {cats.length > 0 && (
            <nav aria-label="Gallery categories" className="mb-8 flex flex-wrap gap-2">
              <Link href="/gallery" className={`rounded-full border px-4 py-2 text-sm ${!c ? "border-peat bg-peat text-bone" : "border-line"}`}>All</Link>
              {cats.map((x) => (
                <Link key={x.slug} href={`/gallery?c=${x.slug}`} className={`rounded-full border px-4 py-2 text-sm ${c === x.slug ? "border-peat bg-peat text-bone" : "border-line"}`}>{x.name}</Link>
              ))}
            </nav>
          )}
          {shown.length ? <GalleryGrid images={shown} /> : <EmptyState title="Photographs coming soon">The club is gathering photographs of the beats and the loch. Have one to share? <Link href="/contact" className="underline">Get in touch</Link>.</EmptyState>}
        </div>
      </section>
    </>
  );
}
