import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { markMessageHandled } from "@/lib/admin/misc-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const rows = await sql`select * from public.contact_messages order by handled_at nulls first, created_at desc limit 200`;
  return (
    <>
      <AdminPageHeader back={{ href: "/admin/settings", label: "Settings" }} title="Contact messages" description="Messages sent through the website contact form." />
      <ul className="space-y-3">
        {rows.map((m) => (
          <li key={m.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{m.subject} {m.handled_at ? <Badge tone="good">Handled</Badge> : <Badge tone="warn">New</Badge>}</p>
                <p className="text-sm text-stone">{m.name} · <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="link-underline">{m.email}</a>{m.phone ? ` · ${m.phone}` : ""} · {formatDateTime(m.created_at)}</p>
              </div>
              {!m.handled_at && <ConfirmAction action={markMessageHandled.bind(null, m.id)} variant="primary" size="sm" label="Mark handled" title="Mark as handled?" confirmLabel="Done" />}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
          </li>
        ))}
        {!rows.length && <li className="card p-6 text-stone">No messages yet.</li>}
      </ul>
    </>
  );
}
