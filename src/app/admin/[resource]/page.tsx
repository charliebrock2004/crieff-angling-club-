import Link from "next/link";
import { notFound } from "next/navigation";
import { getResource } from "@/lib/admin/resources";
import { listRows, type Row } from "@/lib/admin/crud";
import { AdminPageHeader, Flash } from "@/components/admin/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge, NeedsConfirmation } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/section";
import { formatMoney, formatMonthDay } from "@/lib/format";

export function formatCell(row: Row, field: string, format?: string) {
  if (format === "monthday") return formatMonthDay(Number(row[`${field}_month`]), Number(row[`${field}_day`]));
  const v = row[field];
  if (format === "money") return formatMoney(Number(v ?? 0));
  if (format === "bool") return v ? <Badge tone="good">Yes</Badge> : <Badge>No</Badge>;
  if (format === "date") return v ? new Date(v as string).toLocaleDateString("en-GB") : "—";
  if (format === "status") return <Badge tone={v === "published" ? "good" : "neutral"}>{String(v)}</Badge>;
  return v === null || v === undefined || v === "" ? "—" : String(v).replace(/_/g, " ");
}

export default async function ResourceList({ params, searchParams }: PageProps<"/admin/[resource]">) {
  const { resource: key } = await params;
  const r = getResource(key);
  if (!r || r.nested) notFound();
  const rows = await listRows(r);
  const sp = await searchParams;
  return (
    <>
      <AdminPageHeader title={r.plural} description={r.description} actions={r.canCreate !== false && <ButtonLink href={`/admin/${key}/new`}>Add {r.singular.toLowerCase()}</ButtonLink>} />
      <Flash sp={sp} />
      {rows.length === 0 ? (
        <EmptyState title={`No ${r.plural.toLowerCase()} yet`} action={r.canCreate !== false && <ButtonLink href={`/admin/${key}/new`}>Add the first one</ButtonLink>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-club">
            <thead><tr>{r.list.map((c) => <th key={c.field}>{c.label}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id as string}>
                  {r.list.map((c, i) => (
                    <td key={c.field}>
                      {i === 0 ? (
                        <Link href={`/admin/${key}/${row.id}`} className="font-semibold hover:underline">{formatCell(row, c.field, c.format)}</Link>
                      ) : (
                        formatCell(row, c.field, c.format)
                      )}
                      {i === 0 && r.hasNeedsConfirmation && row.needs_confirmation ? <span className="ml-2 align-middle"><NeedsConfirmation /></span> : null}
                    </td>
                  ))}
                  <td className="text-right"><Link href={`/admin/${key}/${row.id}`} className="text-sm font-semibold text-bracken">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
