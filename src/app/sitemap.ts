import type { MetadataRoute } from "next";
import { getBeats, getNews } from "@/lib/content/queries";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics = ["/", "/river-earn", "/drummond-loch", "/book", "/permits", "/seasons", "/rules", "/maps", "/membership", "/news", "/gallery", "/about", "/contact", "/catch-returns", "/privacy", "/terms", "/cancellation-policy"];
  const [beats, news] = await Promise.all([getBeats("river-earn").catch(() => []), getNews(500).catch(() => [])]);
  return [
    ...statics.map((p) => ({ url: absoluteUrl(p), changeFrequency: (p === "/" || p === "/book" ? "daily" : "weekly") as "daily" | "weekly", priority: p === "/" ? 1 : p === "/book" || p.startsWith("/river") || p === "/drummond-loch" ? 0.9 : 0.6 })),
    ...beats.map((b) => ({ url: absoluteUrl(`/river-earn/${b.slug}`), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...news.map((n) => ({ url: absoluteUrl(`/news/${n.slug}`), lastModified: n.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
