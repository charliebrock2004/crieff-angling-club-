import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Email log" };

export default async function EmailsPage() {
  const rows = await sql`select * from public.email_logs order by created_at desc limit 300`;
  return (
    <>
      <AdminPageHeader back={{ href: "/admin/settings", label: "Settings" }} title="Email log" description="Every email the website has tried to send. “Skipped” means email isn't configured yet (RESEND_API_KEY)." />
      <div className="card overflow-x-auto">
        <table className="table-club">
          <thead><tr><th>When</th><th>To</th><th>Email</th><th>Status</th><th>Booking</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td><td>{r.to_email}</td><td>{r.subject}</td>
                <td><Badge tone={r.status === "sent" ? "good" : r.status === "failed" ? "bad" : "neutral"}>{r.status}</Badge>{r.error && <span className="block text-xs text-bad">{r.error}</span>}</td>
                <td>{r.booking_id ? <Link href={`/admin/bookings/${r.booking_id}`} className="text-bracken">Open</Link> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
