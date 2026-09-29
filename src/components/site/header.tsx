import Link from "next/link";
import { cn } from "../ui/cn";
import { MobileNav } from "./mobile-nav";
import { PRIMARY_NAV } from "./nav-links";
import { Logo } from "./logo";

export function Header({ overlay = false, signedIn = false }: { overlay?: boolean; signedIn?: boolean }) {
  return (
    <header
      className={cn(
        "z-30 w-full [--header-h:4.5rem]",
        overlay ? "absolute inset-x-0 top-0 text-bone" : "sticky top-0 border-b border-line/80 bg-paper/90 text-peat backdrop-blur-md",
      )}
    >
      <div className="container-club flex h-[4.5rem] items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Crieff Angling Club — home">
          <Logo className="h-9 w-9 flex-none" />
          <span className="leading-none">
            <span className="block font-display text-[1.2rem] tracking-[0.02em]">Crieff Angling Club</span>
            <span className={cn("mt-1 block text-[0.62rem] font-semibold uppercase tracking-[0.24em]", overlay ? "text-bone/70" : "text-stone")}>River Earn · Drummond Loch</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={cn("rounded-full px-3 py-2 text-[0.92rem] font-medium transition", overlay ? "hover:bg-white/10" : "hover:bg-mist")}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href={signedIn ? "/account" : "/login"} className={cn("hidden rounded-full px-3 py-2 text-sm font-medium sm:inline-flex", overlay ? "hover:bg-white/10" : "hover:bg-mist")}>
            {signedIn ? "Account" : "Sign in"}
          </Link>
          <Link
            href="/book"
            className={cn(
              "hidden h-11 items-center rounded-full px-5 text-sm font-semibold transition sm:inline-flex",
              overlay ? "bg-bone text-peat hover:bg-white" : "bg-peat text-bone hover:bg-moss",
            )}
          >
            Book a permit
          </Link>
          <MobileNav signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
