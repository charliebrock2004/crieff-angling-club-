import type { Field, Resource } from "@/lib/admin/resources";
import { MONTH_OPTIONS } from "@/lib/admin/resources";
import type { Row } from "@/lib/admin/crud";
import { saveResourceAction } from "@/lib/admin/actions";
import { AdminForm } from "./admin-form";
import { WEEKDAYS } from "@/lib/format";

type Options = Record<string, { value: string; label: string }[]>;

function Label({ f, htmlFor }: { f: Field; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor ?? f.name} className="field-label">
      {f.label}
      {f.required && <span className="text-bracken" aria-hidden="true"> *</span>}
    </label>
  );
}

function Help({ f }: { f: Field }) {
  return f.help ? <p className="field-hint">{f.help}</p> : null;
}

function toLocalInput(v: unknown): string {
  if (!v) return "";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FieldInput({ f, row, options }: { f: Field; row: Row | null; options: Options }) {
  const v = row?.[f.name];
  switch (f.type) {
    case "text":
    case "email":
    case "url":
    case "slug":
      return (
        <div>
          <Label f={f} />
          <input id={f.name} name={f.name} type={f.type === "slug" ? "text" : f.type} className="input" defaultValue={(v as string) ?? ""} required={f.required && f.type !== "slug"} maxLength={"max" in f ? f.max : undefined} placeholder={"placeholder" in f ? f.placeholder : undefined} pattern={f.type === "slug" ? "[a-z0-9-]*" : undefined} />
          <Help f={f} />
        </div>
      );
    case "textarea":
    case "markdown":
      return (
        <div>
          <Label f={f} />
          <textarea id={f.name} name={f.name} className={`input ${f.type === "markdown" ? "min-h-64 font-mono text-sm" : "min-h-28"}`} defaultValue={(v as string) ?? ""} required={f.required} maxLength={"max" in f ? f.max : undefined} />
          {f.type === "markdown" ? <p className="field-hint">Formatting: <code>## Heading</code>, <code>**bold**</code>, <code>*italic*</code>, <code>- list item</code>, <code>[link text](https://…)</code>. Leave a blank line between paragraphs.</p> : <Help f={f} />}
        </div>
      );
    case "number":
      return (
        <div>
          <Label f={f} />
          <input id={f.name} name={f.name} type="number" inputMode="decimal" className="input" defaultValue={v === null || v === undefined ? "" : String(v)} min={f.min} max={f.max} step={f.step ?? 1} required={f.required} />
          <Help f={f} />
        </div>
      );
    case "money":
      return (
        <div>
          <Label f={f} />
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-stone">£</span>
            <input id={f.name} name={f.name} inputMode="decimal" className="input pl-8" defaultValue={v === null || v === undefined ? "" : (Number(v) / 100).toFixed(2)} required={f.required} pattern="[0-9]+(\.[0-9]{1,2})?" />
          </div>
          <Help f={f} />
        </div>
      );
    case "boolean":
      return (
        <div className="flex gap-3 rounded-xl border border-line bg-white p-3.5">
          <input id={f.name} name={f.name} type="checkbox" defaultChecked={row && f.name in row ? !!v : true} className="mt-0.5 h-5 w-5 flex-none accent-peat" />
          <div>
            <label htmlFor={f.name} className="text-sm font-medium">{f.label}</label>
            {f.help && <p className="text-sm text-stone">{f.help}</p>}
          </div>
        </div>
      );
    case "date":
      return (
        <div>
          <Label f={f} />
          <input id={f.name} name={f.name} type="date" className="input" defaultValue={(v as string) ?? ""} required={f.required} />
          <Help f={f} />
        </div>
      );
    case "datetime":
      return (
        <div>
          <Label f={f} />
          <input id={f.name} name={f.name} type="datetime-local" className="input" defaultValue={toLocalInput(v)} />
          <Help f={f} />
        </div>
      );
    case "select":
    case "relation": {
      const opts = f.type === "select" ? f.options : options[f.source] ?? [];
      return (
        <div>
          <Label f={f} />
          <select id={f.name} name={f.name} className="input" defaultValue={(v as string) ?? ""} required={f.required}>
            {(!f.required || !v) && <option value="">{f.required ? "Choose…" : "— None —"}</option>}
            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Help f={f} />
        </div>
      );
    }
    case "monthday":
      return (
        <fieldset>
          <legend className="field-label">{f.label}{f.required && <span className="text-bracken"> *</span>}</legend>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor={`${f.name}__day`}>Day</label>
            <input id={`${f.name}__day`} name={`${f.name}__day`} type="number" min={1} max={31} className="input w-24" defaultValue={row ? String(row[f.dayCol]) : "1"} required />
            <label className="sr-only" htmlFor={`${f.name}__month`}>Month</label>
            <select id={`${f.name}__month`} name={`${f.name}__month`} className="input" defaultValue={row ? String(row[f.monthCol]) : "1"}>
              {MONTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Help f={f} />
        </fieldset>
      );
    case "weekdays": {
      const sel = new Set(((v as number[]) ?? []).map(Number));
      return (
        <fieldset>
          <legend className="field-label">{f.label}</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm has-[:checked]:border-peat has-[:checked]:bg-peat has-[:checked]:text-bone">
                <input type="checkbox" name={f.name} value={i} defaultChecked={sel.has(i)} className="sr-only" />
                {d.slice(0, 3)}
              </label>
            ))}
          </div>
          <Help f={f} />
        </fieldset>
      );
    }
    case "lines":
      return (
        <div>
          <Label f={f} />
          <textarea id={f.name} name={f.name} className="input min-h-28" defaultValue={((v as string[]) ?? []).join("\n")} />
          <Help f={f} />
        </div>
      );
    case "points":
      return (
        <div>
          <Label f={f} />
          <textarea id={f.name} name={f.name} className="input min-h-24" defaultValue={((v as { name: string; description?: string }[]) ?? []).map((p) => (p.description ? `${p.name} | ${p.description}` : p.name)).join("\n")} />
          <Help f={f} />
        </div>
      );
    case "image": {
      const url = (v as string) ?? "";
      return (
        <div className="space-y-3">
          <Label f={f} htmlFor={`${f.name}__file`} />
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="max-h-48 rounded-xl border border-line object-cover" />
          )}
          <input id={`${f.name}__file`} name={`${f.name}__file`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-peat file:px-4 file:py-2 file:text-bone" />
          <p className="field-hint">Upload a photo (resized and optimised automatically), or paste an image URL:</p>
          <input name={f.name} type="url" className="input input-sm" defaultValue={url} placeholder="https://…" aria-label={`${f.label} URL`} />
          {f.altField && (
            <div>
              <label htmlFor={f.altField} className="field-label">Image description (alt text)</label>
              <input id={f.altField} name={f.altField} className="input input-sm" defaultValue={(row?.[f.altField] as string) ?? ""} placeholder="Describe the photo for screen readers" />
            </div>
          )}
          {url && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`${f.name}__remove`} className="accent-bad" /> Remove image</label>}
        </div>
      );
    }
    case "multi": {
      const sel = new Set(((v as string[]) ?? []).map(String));
      return (
        <fieldset>
          <legend className="field-label">{f.label}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(options[f.source] ?? []).map((o) => (
              <label key={o.value} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2 text-sm has-[:checked]:border-peat">
                <input type="checkbox" name={f.name} value={o.value} defaultChecked={sel.has(o.value)} className="h-4 w-4 accent-peat" />
                {o.label}
              </label>
            ))}
          </div>
          <Help f={f} />
        </fieldset>
      );
    }
  }
}

export function ResourceForm({ resource, row, options, back, defaults }: { resource: Resource; row: Row | null; options: Options; back?: string; defaults?: Row }) {
  const sections = Array.from(new Set(resource.fields.map((f) => f.section ?? "Details")));
  const action = saveResourceAction.bind(null, resource.key, (row?.id as string) ?? null);
  const data = row ?? (defaults ? { ...defaults } : null);
  return (
    <AdminForm action={action} submitLabel={row ? "Save changes" : `Create ${resource.singular.toLowerCase()}`}>
      {back && <input type="hidden" name="__back" value={back} />}
      <div className="space-y-6">
        {sections.map((s) => (
          <section key={s} className="card p-5 sm:p-7">
            <h2 className="font-display text-xl">{s}</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {resource.fields
                .filter((f) => (f.section ?? "Details") === s)
                .map((f) => (
                  <div key={f.name} className={["textarea", "markdown", "image", "multi", "lines", "points", "weekdays"].includes(f.type) || f.wide ? "md:col-span-2" : ""}>
                    {/* For new rows with defaults, pass the defaults as a pseudo-row so selects are preselected. */}
                    <FieldInput f={f} row={data} options={options} />
                  </div>
                ))}
            </div>
          </section>
        ))}
        {resource.hasNeedsConfirmation && (
          <label className="flex gap-3 rounded-2xl border border-warn/30 bg-warn-bg p-4 text-sm">
            <input type="checkbox" name="needs_confirmation" defaultChecked={!!row?.needs_confirmation} className="mt-0.5 h-5 w-5 accent-peat" />
            <span><strong>Needs confirmation.</strong> Tick if any detail here still needs checking by the committee. Untick once confirmed.</span>
          </label>
        )}
      </div>
    </AdminForm>
  );
}
