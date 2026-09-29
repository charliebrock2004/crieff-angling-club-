import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { relationOptions } from "@/lib/admin/crud";
import { uploadGalleryImages } from "@/lib/admin/misc-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminForm } from "@/components/admin/admin-form";
import { GalleryItem } from "@/components/admin/gallery-admin";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/section";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryAdmin() {
  const [images, opts] = await Promise.all([
    sql`select * from public.gallery_images order by sort_order, created_at`,
    relationOptions(["gallery_categories", "waters", "beats"]),
  ]);
  return (
    <>
      <AdminPageHeader title="Gallery" description="Photos are resized, stripped of location data and converted to WebP automatically. Tag a photo with a water or beat to show it on that page." actions={<ButtonLink href="/admin/gallery-categories/new" variant="secondary">Add category</ButtonLink>} />
      <AdminForm action={uploadGalleryImages} submitLabel="Upload photos" resetOnSuccess>
        <div className="card grid gap-4 p-5 sm:grid-cols-4">
          <div className="sm:col-span-4"><label htmlFor="files" className="field-label">Photos (up to 20, max 15 MB each)</label>
            <input id="files" name="files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" required className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-peat file:px-4 file:py-2 file:text-bone" /></div>
          <select name="categoryId" className="input input-sm" aria-label="Category"><option value="">No category</option>{opts.gallery_categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <select name="waterId" className="input input-sm" aria-label="Water"><option value="">Any water</option>{opts.waters.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <select name="beatId" className="input input-sm" aria-label="Beat"><option value="">Any beat</option>{opts.beats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <input name="credit" placeholder="Photographer (optional)" className="input input-sm" />
        </div>
      </AdminForm>
      <div className="mt-8">
        {images.length ? (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((img, i) => (
              <GalleryItem key={img.id} img={img as never} cats={opts.gallery_categories} waters={opts.waters} beats={opts.beats} first={i === 0} last={i === images.length - 1} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No photos yet">Upload the club&rsquo;s best photographs of the beats and the loch. Until then, the website uses illustrated landscapes.</EmptyState>
        )}
      </div>
    </>
  );
}
