"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRIMARY_NAV } from "./nav-links";

export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-current hover:bg-white/10"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h10" />}
        </svg>
      </button>
      {open && (
        <div id="mobile-menu" ref={panel} className="fixed inset-x-0 top-[var(--header-h,4.5rem)] bottom-0 z-40 overflow-y-auto bg-peat px-5 pb-10 pt-6 text-bone animate-fade">
          <nav aria-label="Mobile">
            <ul className="divide-y divide-white/10">
              {PRIMARY_NAV.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex items-center justify-between py-4 font-display text-2xl" aria-current={pathname.startsWith(l.href) ? "page" : undefined}>
                    {l.label}
                    <span aria-hidden="true" className="text-bracken">→</span>
                  </Link>
                </li>
              ))}
              {[
                { href: "/rules", label: "Rules" },
                { href: "/maps", label: "Maps" },
                { href: "/catch-returns", label: "Catch returns" },
                { href: "/contact", label: "Contact" },
                { href: signedIn ? "/account" : "/login", label: signedIn ? "Your account" : "Sign in" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block py-3 text-lg text-bone/80">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link href="/book" className="mt-8 flex h-14 items-center justify-center rounded-full bg-bracken text-base font-semibold text-bone">
            Book a permit
          </Link>
        </div>
      )}
    </div>
  );
}
