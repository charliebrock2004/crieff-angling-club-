import "server-only";
import sharp from "sharp";
import { randomCode } from "../ids";
import { createSupabaseAdminClient } from "../supabase/admin";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"]);

export interface UploadedImage {
  url: string;
  path: string;
  width: number;
  height: number;
}

/**
 * Resizes to at most 2400px on the long edge, strips metadata (including GPS),
 * re-encodes as WebP and stores it in the public `media` bucket. next/image
 * then serves right-sized AVIF/WebP variants to each device.
 */
export async function uploadImage(file: File, folder: string): Promise<UploadedImage> {
  if (!ACCEPTED.has(file.type)) throw new Error("Please upload a JPEG, PNG, WebP or AVIF image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Images must be smaller than 15 MB.");
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Image storage is not configured (SUPABASE_SERVICE_ROLE_KEY). You can paste an image URL instead.");

  const input = Buffer.from(await file.arrayBuffer());
  const { data, info } = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const safeFolder = folder.replace(/[^a-z0-9-]/g, "") || "misc";
  const path = `${safeFolder}/${new Date().toISOString().slice(0, 10)}-${randomCode(10).toLowerCase()}.webp`;
  const { error } = await supabase.storage.from("media").upload(path, data, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
  return { url: pub.publicUrl, path, width: info.width, height: info.height };
}

export async function deleteStoredImage(path: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  await supabase.storage.from("media").remove([path]);
}
