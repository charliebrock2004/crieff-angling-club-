import type { Metadata } from "next";

export const SITE_NAME = "Crieff Angling Club";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMetadata(opts: { title: string; description: string; path: string; image?: string | null; type?: "website" | "article"; publishedTime?: string; noIndex?: boolean }): Metadata {
  const url = absoluteUrl(opts.path);
  const images = opts.image ? [{ url: opts.image }] : undefined;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      locale: "en_GB",
      type: opts.type ?? "website",
      ...(images ? { images } : {}),
      ...(opts.publishedTime ? { publishedTime: opts.publishedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, ...(images ? { images } : {}) },
    ...(opts.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

export function organizationJsonLd(opts: { phone?: string | null; email?: string | null; sameAs?: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "@id": `${siteUrl()}/#organization`,
    name: SITE_NAME,
    sport: "Angling",
    url: siteUrl(),
    logo: absoluteUrl("/icon.svg"),
    description: "Angling club controlling three beats on the upper River Earn at Crieff and the fishing on Drummond Loch, Perthshire, Scotland.",
    address: { "@type": "PostalAddress", addressLocality: "Crieff", addressRegion: "Perthshire", addressCountry: "GB" },
    areaServed: "Crieff, Perthshire",
    ...(opts.phone ? { telephone: opts.phone } : {}),
    ...(opts.email ? { email: opts.email } : {}),
    ...(opts.sameAs?.length ? { sameAs: opts.sameAs } : {}),
  };
}

export function placeJsonLd(opts: { name: string; description: string; path: string; lat: number | null; lng: number | null; image?: string | null }) {
  return {
    "@context": "https://schema.org",
    "@type": ["Place", "TouristAttraction"],
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.path),
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.lat !== null && opts.lng !== null ? { geo: { "@type": "GeoCoordinates", latitude: opts.lat, longitude: opts.lng } } : {}),
    containedInPlace: { "@type": "Place", name: "Crieff, Perthshire, Scotland" },
    isAccessibleForFree: false,
    publicAccess: true,
    provider: { "@id": `${siteUrl()}/#organization` },
  };
}
