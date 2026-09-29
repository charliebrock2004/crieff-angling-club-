import Link from "next/link";
import { notFound } from "next/navigation";
import { getResource, type RelationSource } from "@/lib/admin/resources";
import { getRow, listRows, relationOptions } from "@/lib/admin/crud";
import { deleteResourceAction } from "@/lib/admin/actions";
import { AdminPageHeader, Flash } from "@/components/admin/page-header";
import { ResourceForm } from "@/components/admin/resource-form";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { ButtonLink } from "@/components/ui/button";
import { NeedsConfirmation } from "@/components/ui/badge";
import { formatCell } from "../page";

export default async function ResourceEdit({ params, searchParams }: PageProps<"/admin/[resource]/[id]">) {
  const { resource: key, id } = await params;
  const sp = await searchParams;
  const r = getResource(key);
  if (!r) notFound();
  const isNew = id === "new";
  if (isNew && r.canCreate === false) notFound();
  const row = isNew ? null : await getRow(r, id);
  if (!isNew && !row) notFound();

  const sources = r.fields.flatMap((f) => (f.type === "relation" || f.type === "multi" ? [f.source as RelationSource] : []));
  const options = await relationOptions(sources);

  // New child rows (e.g. a price period) can be pre-linked to their parent.
  const defaults: Record<string, unknown> = {};
  for (const f of r.fields) if (f.type === "relation" && typeof sp[f.name] === "string") defaults[f.name] = sp[f.name];
  const parentBack = typeof sp.back === "string" && sp.back.startsWith("/admin/") ? sp.back : undefined;
  const back = parentBack ?? (r.nested ? undefined : `/admin/${key}`);

  const children = row && r.children ? await Promise.all(r.children.map(async (c) => ({ c, res: getResource(c.resource)!, rows: await listRows(getResource(c.resource)!, { column: c.fk, value: row.id as string }) }))) : [];
  const publicPath = row && r.publicPath ? r.publicPath(row) : null;
  const title = isNew ? `New ${r.singular.toLowerCase()}` : String(row![r.titleField] ?? r.singular);
  const del = row && r.canDelete !== false ? deleteResourceAction.bind(null, key, row.id as string, back ?? `/admin/${key}`) : null;

  return (
    <>
      <AdminPageHeader
        back={back ? { href: back, label: parentBack ? "Back" : r.plural } : undefined}
        title={<>{title} {row?.needs_confirmation ? <NeedsConfirmation /> : null}</>}
        description={r.description}
        actions={
          <>
            {publicPath && <ButtonLink href={publicPath} target="_blank" variant="secondary">View on website ↗</ButtonLink>}
            {del && <ConfirmAction action={del} label="Delete" title={`Delete this ${r.singular.toLowerCase()}?`} body="This can't be undone. If it's in use, it can't be deleted — deactivate or unpublish it instead." confirmLabel="Delete" />}
          </>
        }
      />
      <Flash sp={sp} />
      <ResourceForm resource={r} row={row} options={options} back={back} defaults={defaults} />

      {children.map(({ c, res, rows }) => (
        <section key={c.resource} className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{c.title}</h2>
            <ButtonLink href={`/admin/${c.resource}/new?${c.fk}=${row!.id}&back=/admin/${key}/${row!.id}`} size="sm">Add</ButtonLink>
          </div>
          <div className="card mt-4 overflow-x-auto">
            {rows.length ? (
              <table className="table-club">
                <thead><tr>{res.list.map((l) => <th key={l.field}>{l.label}</th>)}<th /></tr></thead>
                <tbody>
                  {rows.map((cr) => (
                    <tr key={cr.id as string}>
                      {res.list.map((l, i) => <td key={l.field}>{formatCell(cr, l.field, l.format)}{i === 0 && cr.needs_confirmation ? <span className="ml-2"><NeedsConfirmation /></span> : null}</td>)}
                      <td className="text-right"><Link href={`/admin/${c.resource}/${cr.id}?back=/admin/${key}/${row!.id}`} className="text-sm font-semibold text-bracken">Edit</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-5 text-sm text-stone">None yet — this permit can&rsquo;t be sold until it has at least one price period.</p>
            )}
          </div>
        </section>
      ))}
    </>
  );
}
