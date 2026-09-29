import type { ReactNode } from "react";
import Link from "next/link";
import { Alert } from "../ui/alert";

export function AdminPageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-8">
      {back && <Link href={back.href} className="text-sm text-stone hover:text-peat">← {back.label}</Link>}
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-stone">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  if (sp.saved) return <Alert tone="good" className="mb-6">Saved. Changes are live on the website.</Alert>;
  if (sp.deleted) return <Alert tone="good" className="mb-6">Deleted.</Alert>;
  if (typeof sp.error === "string") return <Alert tone="bad" className="mb-6">{sp.error}</Alert>;
  return null;
}

export function StatCard({ label, value, sub, href, tone }: { label: string; value: ReactNode; sub?: ReactNode; href?: string; tone?: "warn" | "bad" }) {
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-stone">{label}</p>
      <p className={`mt-2 font-display text-4xl ${tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-sm text-stone">{sub}</p>}
    </>
  );
  return href ? <Link href={href} className="card block p-5 transition hover:shadow-[var(--shadow-lift)]">{inner}</Link> : <div className="card p-5">{inner}</div>;
}
