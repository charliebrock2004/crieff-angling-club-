import Link from "next/link";
import { FOOTER_NAV } from "./nav-links";
import { Logo } from "./logo";
import type { SiteSettings } from "@/lib/settings";

export function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="grain bg-peat text-bone">
      <div className="container-club grid gap-12 py-16 md:grid-cols-[1.3fr_2fr] lg:py-20">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-11 w-11" />
            <span className="font-display text-2xl">Crieff Angling Club</span>
          </Link>
          <p className="mt-5 max-w-sm text-bone/70">
            Salmon, sea trout, brown trout and grayling on the upper River Earn, and fly-only boat fishing on Drummond Loch.
          </p>
          <dl className="mt-6 space-y-2 text-sm text-bone/80">
            {settings.contactPhone && (
              <div className="flex gap-2">
                <dt className="text-bone/50">Secretary</dt>
                <dd>
                  <a href={`tel:${settings.contactPhone.replace(/\s/g, "")}`} className="hover:text-bracken">{settings.contactPhone}</a>
                </dd>
              </div>
            )}
            {settings.contactEmail && (
              <div className="flex gap-2">
                <dt className="text-bone/50">Email</dt>
                <dd>
                  <a href={`mailto:${settings.contactEmail}`} className="hover:text-bracken">{settings.contactEmail}</a>
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-6 flex gap-3">
            {settings.facebookUrl && (
              <a href={settings.facebookUrl} rel="noopener noreferrer" target="_blank" className="inline-flex h-10 items-center rounded-full border border-white/20 px-4 text-sm hover:border-bracken hover:text-bracken">
                Facebook
              </a>
            )}
            {settings.waterLevelUrl && (
              <a href={settings.waterLevelUrl} rel="noopener noreferrer" target="_blank" className="inline-flex h-10 items-center rounded-full border border-white/20 px-4 text-sm hover:border-bracken hover:text-bracken">
                River levels
              </a>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {FOOTER_NAV.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="eyebrow text-bracken">{col.title}</p>
              <ul className="mt-4 space-y-2.5 text-[0.95rem] text-bone/75">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-bone">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-club flex flex-col gap-3 py-6 text-xs text-bone/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Crieff Angling Club. Payments processed securely by Stripe.</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li><Link href="/privacy" className="hover:text-bone">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-bone">Terms</Link></li>
            <li><Link href="/cancellation-policy" className="hover:text-bone">Cancellations</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
