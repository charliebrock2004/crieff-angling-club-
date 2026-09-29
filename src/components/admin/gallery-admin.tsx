"use client";
import { useActionState, useTransition } from "react";
import { deleteGalleryImage, moveGalleryImage, updateGalleryImage } from "@/lib/admin/misc-actions";
import type { AdminFormState } from "@/lib/admin/actions";
import { Button } from "../ui/button";

interface Img { id: string; url: string; alt: string; caption: string | null; credit: string | null; category_id: string | null; water_id: string | null; beat_id: string | null; is_published: boolean }
type Opt = { value: string; label: string };

export function GalleryItem({ img, cats, waters, beats, first, last }: { img: Img; cats: Opt[]; waters: Opt[]; beats: Opt[]; first: boolean; last: boolean }) {
  const [state, action, saving] = useActionState<AdminFormState, FormData>(updateGalleryImage.bind(null, img.id), null);
  const [pending, start] = useTransition();
  return (
    <li className="card overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={img.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
      <form action={action} className="space-y-2 p-4 text-sm">
        <label className="block"><span className="field-label">Description (alt text) *</span><input name="alt" defaultValue={img.alt} required className="input input-sm" /></label>
        <label className="block"><span className="field-label">Caption</span><input name="caption" defaultValue={img.caption ?? ""} className="input input-sm" /></label>
        <label className="block"><span className="field-label">Photographer</span><input name="credit" defaultValue={img.credit ?? ""} className="input input-sm" /></label>
        <div className="grid grid-cols-3 gap-2">
          <select name="categoryId" defaultValue={img.category_id ?? ""} className="input input-sm" aria-label="Category"><option value="">No category</option>{cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <select name="waterId" defaultValue={img.water_id ?? ""} className="input input-sm" aria-label="Water"><option value="">Any water</option>{waters.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <select name="beatId" defaultValue={img.beat_id ?? ""} className="input input-sm" aria-label="Beat"><option value="">Any beat</option>{beats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_published" defaultChecked={img.is_published} className="accent-peat" /> Published</label>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          <Button type="button" size="sm" variant="ghost" disabled={first || pending} onClick={() => start(async () => { await moveGalleryImage(img.id, "up"); })} aria-label="Move earlier">↑</Button>
          <Button type="button" size="sm" variant="ghost" disabled={last || pending} onClick={() => start(async () => { await moveGalleryImage(img.id, "down"); })} aria-label="Move later">↓</Button>
          <Button type="button" size="sm" variant="ghost" className="ml-auto text-bad" disabled={pending} onClick={() => { if (confirm("Delete this photo permanently?")) start(async () => { await deleteGalleryImage(img.id); }); }}>Delete</Button>
          {state && <span className={state.ok ? "text-good" : "text-bad"}>{state.message}</span>}
        </div>
      </form>
    </li>
  );
}
