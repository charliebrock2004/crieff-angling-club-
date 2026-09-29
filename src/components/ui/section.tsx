import type { ReactNode } from "react";
import { cn } from "./cn";

export function SectionHeading({ eyebrow, title, intro, align = "left", className, as: As = "h2" }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; align?: "left" | "center"; className?: string; as?: "h1" | "h2" }) {
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <As className={cn("display-lg", eyebrow && "mt-4")}>{title}</As>
      {intro && <div className="lede mt-5">{intro}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-bone/60 px-6 py-12 text-center">
      <svg aria-hidden="true" viewBox="0 0 48 48" className="mx-auto h-10 w-10 text-lichen" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 30c6-6 10-6 16 0s10 6 16 0 8-4 8-4M4 38c6-6 10-6 16 0s10 6 16 0 8-4 8-4M24 6c-5 5-5 11 0 16 5-5 5-11 0-16Z" strokeLinecap="round" />
      </svg>
      <p className="mt-3 font-display text-xl">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-stone">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
