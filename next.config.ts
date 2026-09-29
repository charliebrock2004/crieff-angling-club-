import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js injects inline bootstrap scripts; no third-party script origins are allowed.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
      "font-src 'self'",
      `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}`,
      "frame-src https://www.openstreetmap.org",
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["postgres", "sharp"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
  },
  // Old crieffanglingclub.org.uk URLs (found indexed by search engines) → new pages.
  async redirects() {
    const map: [string, string][] = [
      ["/index.htm", "/"],
      ["/index.html", "/"],
      ["/prices.htm", "/permits"],
      ["/season.htm", "/seasons"],
      ["/rules.htm", "/rules"],
      ["/river_beats.htm", "/river-earn"],
      ["/d_loch.htm", "/drummond-loch"],
      ["/membership.htm", "/membership"],
      ["/news.htm", "/news"],
      ["/contact.htm", "/contact"],
      ["/formv3.html", "/catch-returns"],
      ["/application_form.pdf", "/membership/apply"],
      ["/River_Earn_Rules_&_Guidance_for_Anglers.pdf", "/rules"],
    ];
    return map.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
