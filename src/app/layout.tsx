import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { siteUrl } from "@/lib/seo";

const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader.woff2", style: "normal", weight: "200 800" },
    { path: "./fonts/newsreader-italic.woff2", style: "italic", weight: "200 800" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});

const hanken = localFont({
  src: [{ path: "./fonts/hanken-grotesk.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Crieff Angling Club — Fishing on the River Earn & Drummond Loch",
    template: "%s | Crieff Angling Club",
  },
  description:
    "Salmon, sea trout, brown trout and grayling fishing on three River Earn beats at Crieff, and fly-only boat fishing on Drummond Loch. Book day permits online.",
  applicationName: "Crieff Angling Club",
  keywords: ["Crieff fishing", "River Earn fishing", "Perthshire fishing", "Drummond Loch", "fishing permits Crieff", "salmon fishing Scotland"],
  formatDetection: { telephone: true, email: false, address: false },
  openGraph: { siteName: "Crieff Angling Club", locale: "en_GB", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#14221d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${newsreader.variable} ${hanken.variable}`}>
      <body className="min-h-svh">
        <a href="#main" className="sr-only z-50 rounded-full bg-peat px-5 py-3 text-bone focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
