import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/site/logo";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Crieff Angling Club" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  return (
    <div className="min-h-svh bg-paper lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden bg-peat text-bone lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <Link href="/admin" className="flex items-center gap-3 px-5 py-6">
          <Logo className="h-9 w-9" />
          <span className="font-display text-lg leading-tight">Crieff Angling Club<span className="block font-sans text-[0.65rem] uppercase tracking-[0.2em] text-bracken">Admin</span></span>
        </Link>
        <div className="flex-1 overflow-y-auto px-3 pb-6"><AdminNav /></div>
        <div className="border-t border-white/10 p-4 text-sm">
          <p className="truncate text-bone/60">{viewer.email}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/" className="text-bone/80 hover:text-bone">View site</Link>
            <form action={signOut}><button className="text-bone/80 hover:text-bone">Sign out</button></form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-peat px-4 py-3 text-bone lg:hidden">
          <Link href="/admin" className="flex items-center gap-2 font-display"><Logo className="h-7 w-7" /> Admin</Link>
          <details className="group relative">
            <summary className="flex h-10 cursor-pointer list-none items-center rounded-full border border-white/20 px-4 text-sm">Menu</summary>
            <div className="absolute right-0 mt-2 max-h-[80svh] w-64 overflow-y-auto rounded-2xl bg-peat p-2 shadow-[var(--shadow-lift)]">
              <AdminNav />
              <div className="mt-2 border-t border-white/10 px-3 pt-3 text-sm">
                <Link href="/" className="block py-1">View site</Link>
                <form action={signOut}><button className="py-1">Sign out</button></form>
              </div>
            </div>
          </details>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
