"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";
import { ADMIN_NAV } from "./nav";

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="space-y-0.5">
        {ADMIN_NAV.map((n) => {
          const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.93rem] transition", active ? "bg-white/12 font-semibold text-bone" : "text-bone/70 hover:bg-white/6 hover:text-bone")}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 flex-none" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
