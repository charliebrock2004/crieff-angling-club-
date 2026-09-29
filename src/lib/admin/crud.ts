import "server-only";
import { sql, pgErrorCode } from "../db";
import type { Field, Resource, RelationSource } from "./resources";
import { uploadImage } from "./images";

export type Row = Record<string, unknown>;

const hasField = (r: Resource, name: string) => r.fields.some((f) => f.name === name);

export async function listRows(r: Resource, filter?: { column: string; value: string }): Promise<Row[]> {
  const joinWater = hasField(r, "water_id");
  const where = filter ? sql`where t.${sql(filter.column)} = ${filter.value}` : sql``;
  const water = joinWater ? sql`, w.name as water_name, w.slug as water_slug` : sql``;
  const join = joinWater ? sql`left join public.waters w on w.id = t.water_id` : sql``;
  return sql`select t.* ${water} from ${sql("public." + r.table)} t ${join} ${where} order by ${sql.unsafe(r.orderBy.replace(/\b(sort_order|name|title|category|water_id|start_month|start_day|label|published_at|created_at)\b/g, "t.$1"))} limit 500`;
}

export async function getRow(r: Resource, id: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await sql`select t.* from ${sql("public." + r.table)} t where t.id = ${id}`;
  if (!row) return null;
  if (hasField(r, "water_id") || r.table === "beats") {
    const [w] = row.water_id ? await sql`select slug from public.waters where id = ${row.water_id as string}` : [];
    row.water_slug = w?.slug;
  }
  for (const f of r.fields) {
    if (f.type === "multi") {
      const sel = await sql`select ${sql(f.otherFk)} as v from ${sql("public." + f.joinTable)} where ${sql(f.fk)} = ${id}`;
      row[f.name] = sel.map((s) => s.v);
    }
  }
  return row;
}

export async function relationOptions(sources: RelationSource[]): Promise<Record<string, { value: string; label: string }[]>> {
  const out: Record<string, { value: string; label: string }[]> = {};
  for (const s of Array.from(new Set(sources))) {
    let rows: Row[] = [];
    if (s === "waters") rows = await sql`select id, name as label from public.waters order by sort_order, name`;
    if (s === "beats") rows = await sql`select b.id, case when w.name = b.name then b.name else w.name || ' — ' || b.name end as label from public.beats b join public.waters w on w.id = b.water_id order by w.sort_order, b.sort_order`;
    if (s === "species") rows = await sql`select id, name as label from public.species order by sort_order`;
    if (s === "permit_types") rows = await sql`select id, name as label from public.permit_types order by sort_order`;
    if (s === "seasons") rows = await sql`select id, name as label from public.fishing_seasons order by sort_order`;
    if (s === "gallery_categories") rows = await sql`select id, name as label from public.gallery_categories order by sort_order`;
    if (s === "membership_types") rows = await sql`select id, name as label from public.membership_types order by sort_order`;
    out[s] = rows.map((x) => ({ value: x.id as string, label: x.label as string }));
  }
  return out;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Parsed {
  values: Row;
  multi: { field: Extract<Field, { type: "multi" }>; ids: string[] }[];
  errors: Record<string, string>;
}

export async function parseForm(r: Resource, fd: FormData): Promise<Parsed> {
  const values: Row = {};
  const multi: Parsed["multi"] = [];
  const errors: Record<string, string> = {};
  const str = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v.trim() : "";
  };

  for (const f of r.fields) {
    const raw = str(f.name);
    switch (f.type) {
      case "text":
      case "textarea":
      case "markdown":
      case "email":
      case "url": {
        if (!raw && f.required) errors[f.name] = `${f.label} is required`;
        else if ("max" in f && f.max && raw.length > f.max) errors[f.name] = `${f.label} must be at most ${f.max} characters`;
        else if (f.type === "url" && raw && !/^https?:\/\//.test(raw)) errors[f.name] = `${f.label} must start with https://`;
        values[f.name] = raw || (f.type === "markdown" && r.table === "news_posts" ? "" : null);
        if (f.type === "markdown" && r.table === "pages" && !raw) values[f.name] = "";
        break;
      }
      case "slug": {
        const title = str(r.titleField);
        const v = slugify(raw || title);
        if (!v) errors[f.name] = `${f.label} is required`;
        values[f.name] = v;
        break;
      }
      case "number": {
        if (raw === "") {
          if (f.required || !f.nullable) {
            if (f.required) errors[f.name] = `${f.label} is required`;
            else values[f.name] = 0;
          } else values[f.name] = null;
          break;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) errors[f.name] = `${f.label} must be a number`;
        else if (f.min !== undefined && n < f.min) errors[f.name] = `${f.label} must be at least ${f.min}`;
        else if (f.max !== undefined && n > f.max) errors[f.name] = `${f.label} must be at most ${f.max}`;
        values[f.name] = f.step && f.step < 1 ? n : Math.round(n);
        break;
      }
      case "money": {
        if (raw === "") {
          if (f.required) errors[f.name] = `${f.label} is required`;
          values[f.name] = f.nullable ? null : 0;
          break;
        }
        const m = raw.replace(/[£,\s]/g, "");
        if (!/^\d+(\.\d{1,2})?$/.test(m)) errors[f.name] = `${f.label} must be an amount like 25 or 12.50`;
        else values[f.name] = Math.round(Number(m) * 100);
        break;
      }
      case "boolean":
        values[f.name] = fd.get(f.name) === "on";
        break;
      case "date":
      case "datetime": {
        if (!raw) values[f.name] = null;
        else {
          const d = new Date(f.type === "date" ? `${raw}T00:00:00Z` : raw);
          if (Number.isNaN(d.getTime())) errors[f.name] = `${f.label} is not a valid date`;
          else values[f.name] = f.type === "date" ? raw : d;
        }
        break;
      }
      case "select": {
        if (!raw) {
          if (f.required) errors[f.name] = `${f.label} is required`;
          values[f.name] = null;
        } else if (!f.options.some((o) => o.value === raw)) errors[f.name] = `Choose a valid ${f.label.toLowerCase()}`;
        else values[f.name] = raw;
        break;
      }
      case "relation": {
        if (!raw) {
          if (f.required) errors[f.name] = `${f.label} is required`;
          values[f.name] = null;
        } else if (!UUID.test(raw)) errors[f.name] = `Choose a valid ${f.label.toLowerCase()}`;
        else values[f.name] = raw;
        break;
      }
      case "monthday": {
        const m = Number(str(`${f.name}__month`));
        const d = Number(str(`${f.name}__day`));
        const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (!(m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1])) errors[f.name] = `${f.label} is not a valid date`;
        values[f.monthCol] = m;
        values[f.dayCol] = d;
        break;
      }
      case "weekdays":
        values[f.name] = fd
          .getAll(f.name)
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
        break;
      case "lines":
        values[f.name] = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 50);
        break;
      case "points": {
        const pts = raw
          .split(/\n+/)
          .map((l) => l.split("|").map((x) => x.trim()))
          .filter((p) => p[0])
          .slice(0, 50)
          .map(([name, description]) => ({ name, ...(description ? { description } : {}) }));
        values[f.name] = sql.json(pts);
        break;
      }
      case "image": {
        const file = fd.get(`${f.name}__file`);
        if (fd.get(`${f.name}__remove`) === "on") values[f.name] = null;
        else if (file instanceof File && file.size > 0) {
          try {
            values[f.name] = (await uploadImage(file, f.folder)).url;
          } catch (err) {
            errors[f.name] = (err as Error).message;
          }
        } else if (raw) {
          if (!/^https:\/\//.test(raw)) errors[f.name] = "Image URL must start with https://";
          values[f.name] = raw;
        } else values[f.name] = null;
        if (f.altField) values[f.altField] = str(f.altField) || null;
        break;
      }
      case "multi": {
        const ids = fd.getAll(f.name).map(String).filter((v) => UUID.test(v));
        multi.push({ field: f, ids });
        break;
      }
    }
  }
  if (r.hasNeedsConfirmation) values.needs_confirmation = fd.get("needs_confirmation") === "on";
  return { values, multi, errors };
}

export async function saveRow(r: Resource, id: string | null, parsed: Parsed, actorId: string): Promise<string> {
  const values: Record<string, any> = { ...parsed.values };
  if (r.table === "news_posts") {
    if (values.status === "published" && !values.published_at) values.published_at = new Date();
    if (!id) values.author_id = actorId;
  }
  return sql.begin(async (tx) => {
    let rowId = id;
    const cols = Object.keys(values);
    if (rowId) {
      await tx`update ${tx("public." + r.table)} set ${tx(values, cols)} where id = ${rowId}`;
    } else {
      const [row] = await tx`insert into ${tx("public." + r.table)} ${tx(values, cols)} returning id`;
      rowId = row.id as string;
    }
    for (const m of parsed.multi) {
      await tx`delete from ${tx("public." + m.field.joinTable)} where ${tx(m.field.fk)} = ${rowId}`;
      for (const other of m.ids) {
        await tx`insert into ${tx("public." + m.field.joinTable)} ${tx({ [m.field.fk]: rowId, [m.field.otherFk]: other })}`;
      }
    }
    return rowId!;
  });
}

export function friendlyDbError(err: unknown): string {
  const code = pgErrorCode(err);
  const msg = String((err as Error)?.message ?? "");
  if (code === "23505") return msg.includes("slug") ? "That web address is already used by another item." : "That value is already in use.";
  if (code === "23503") return "This item is still in use (for example by bookings), so it can't be removed. Unpublish or deactivate it instead.";
  if (code === "23514") return "Some values aren't allowed together — please check the form (for example dates, prices or age limits).";
  if (code === "CA001" || code === "CA002") return "That change would overbook a beat.";
  return "Something went wrong saving your changes.";
}
