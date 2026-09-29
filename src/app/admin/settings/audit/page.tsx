import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const rows = await sql`select * from public.audit_logs order by created_at desc limit 300`;
  return (
    <>
      <AdminPageHeader back={{ href: "/admin/settings", label: "Settings" }} title="Audit log" description="Every important admin action: bookings, refunds, prices, availability, roles and content." />
      <div className="card overflow-x-auto">
        <table className="table-club">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td><td>{r.actor_email ?? "system"}</td><td className="font-medium">{r.action}</td><td className="text-stone">{r.entity_type}</td><td className="max-w-md truncate font-mono text-xs text-stone">{JSON.stringify(r.details)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
