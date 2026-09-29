import Image from "next/image";
import Link from "next/link";
import type { NewsPost } from "@/lib/content/queries";
import { Landscape } from "./landscape";

export function NewsCard({ post, featured = false }: { post: NewsPost; featured?: boolean }) {
  const date = new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-bone shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-lift)] ${featured ? "lg:flex-row" : ""}`}>
      <div className={`relative overflow-hidden bg-peat ${featured ? "aspect-[16/10] lg:aspect-auto lg:w-3/5" : "aspect-[16/10]"}`}>
        {post.coverImageUrl ? (
          <Image src={post.coverImageUrl} alt={post.coverImageAlt ?? ""} fill sizes={featured ? "(min-width:1024px) 60vw, 100vw" : "(min-width:1024px) 33vw, 100vw"} className="object-cover transition duration-700 group-hover:scale-[1.03]" />
        ) : (
          <Landscape variant="dusk" seed={post.title.length} angler={false} className="absolute inset-0 h-full w-full" />
        )}
      </div>
      <div className={`flex flex-1 flex-col p-6 ${featured ? "lg:p-10" : ""}`}>
        <time dateTime={post.publishedAt} className="text-xs font-semibold uppercase tracking-widest text-stone">{date}</time>
        <h3 className={`mt-3 font-display leading-tight ${featured ? "text-3xl sm:text-4xl" : "text-2xl"}`}>
          <Link href={`/news/${post.slug}`} className="after:absolute after:inset-0">{post.title}</Link>
        </h3>
        {post.excerpt && <p className="mt-3 text-stone">{post.excerpt}</p>}
        <span className="mt-auto pt-6 text-sm font-semibold text-bracken">Read more →</span>
      </div>
    </article>
  );
}
