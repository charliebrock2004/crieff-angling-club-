import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { saveSettings } from "@/lib/admin/misc-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminForm } from "@/components/admin/admin-form";
import { NeedsConfirmation } from "@/components/ui/badge";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Club & contact", keys: ["club_name", "contact_email", "contact_phone", "contact_address", "permit_outlets"] },
  { title: "Links", keys: ["facebook_url", "water_level_url", "fishpal_url"] },
  { title: "Booking", keys: ["booking_hold_minutes", "booking_max_days_ahead", "booking_same_day_cutoff_hour", "admin_notification_email"] },
  { title: "Website", keys: ["announcement"] },
];

export default async function SettingsPage() {
  const rows = await sql`select * from public.settings`;
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  const integrations = [
    ["Database", true],
    ["Supabase Auth (sign-in)", !!env.supabaseUrl && !!env.supabaseAnonKey],
    ["Image storage (service role)", !!env.supabaseServiceRoleKey],
    ["Stripe secret key", !!env.stripeSecretKey],
    ["Stripe webhook secret", !!env.stripeWebhookSecret],
    ["Resend email", !!env.resendApiKey],
    ["Site URL", env.siteUrl],
  ] as const;
  return (
    <>
      <AdminPageHeader title="Settings" description="Club details, booking rules and site-wide options." />
      <nav className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["/admin/settings/users", "Users & roles"], ["/admin/pages", "Pages"], ["/admin/species", "Species"],
          ["/admin/settings/messages", "Messages"], ["/admin/settings/emails", "Email log"], ["/admin/settings/audit", "Audit log"],
        ].map(([h, l]) => <Link key={h} href={h} className="card px-4 py-3 text-sm font-semibold hover:shadow-[var(--shadow-lift)]">{l} →</Link>)}
      </nav>
      <AdminForm action={saveSettings} submitLabel="Save settings">
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <section key={g.title} className="card p-6">
              <h2 className="font-display text-xl">{g.title}</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {g.keys.filter((k) => by[k]).map((k) => {
                  const s = by[k];
                  const value = k === "permit_outlets"
                    ? ((s.value as { name: string; phone: string | null; notes: string | null }[]) ?? []).map((o) => [o.name, o.phone, o.notes].filter((x) => x !== null).join(" | ")).join("\n")
                    : s.value === null ? "" : String(s.value);
                  return (
                    <div key={k} className={k === "permit_outlets" || k === "announcement" || k === "contact_address" ? "md:col-span-2" : ""}>
                      <label htmlFor={k} className="field-label flex items-center gap-2">{s.label ?? k} {s.needs_confirmation && <NeedsConfirmation />}</label>
                      {k === "permit_outlets" || k === "contact_address" ? (
                        <textarea id={k} name={k} defaultValue={value} className="input min-h-24" />
                      ) : (
                        <input id={k} name={k} defaultValue={value} className="input" type={k.includes("email") ? "email" : k.includes("url") ? "url" : k.startsWith("booking_") ? "number" : "text"} />
                      )}
                      {s.description && <p className="field-hint">{s.description}{k === "permit_outlets" ? " One per line: Name | phone | notes" : ""}</p>}
                      {s.needs_confirmation && <label className="mt-1.5 flex items-center gap-2 text-xs text-stone"><input type="checkbox" name={`${k}__confirmed`} className="accent-peat" /> Mark as confirmed</label>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </AdminForm>
      <section className="card mt-8 p-6">
        <h2 className="font-display text-xl">Integrations</h2>
        <p className="mt-1 text-sm text-stone">Set as environment variables in Vercel. Secrets are never shown here.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {integrations.map(([n, v]) => <li key={n} className="flex justify-between rounded-xl border border-line px-4 py-2 text-sm"><span>{n}</span><span className={v ? "text-good" : "text-bad"}>{typeof v === "string" ? v : v ? "Configured" : "Missing"}</span></li>)}
        </ul>
      </section>
    </>
  );
}
