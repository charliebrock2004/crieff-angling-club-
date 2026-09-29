import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/api/", "/permit/", "/book/success", "/book/cancelled", "/membership/pay", "/bailiff", "/auth/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
