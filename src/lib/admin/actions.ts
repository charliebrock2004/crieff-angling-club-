"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "../db";
import { assertAdmin, AuthError } from "../auth";
import { audit } from "../audit";
import { getResource } from "./resources";
import { friendlyDbError, parseForm, saveRow } from "./crud";

export type AdminFormState = { ok: boolean; message?: string; errors?: Record<string, string> } | null;

function revalidateSite() {
  revalidatePath("/", "layout");
}

export async function saveResourceAction(key: string, id: string | null, _prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  let actor;
  try {
    actor = await assertAdmin();
  } catch (e) {
    return { ok: false, message: e instanceof AuthError ? e.message : "Not allowed" };
  }
  const r = getResource(key);
  if (!r) return { ok: false, message: "Unknown section" };
  if (!id && r.canCreate === false) return { ok: false, message: "New items can't be added here." };
  const parsed = await parseForm(r, fd);
  if (Object.keys(parsed.errors).length) {
    return { ok: false, message: Object.values(parsed.errors).join(" · "), errors: parsed.errors };
  }
  let rowId: string;
  try {
    rowId = await saveRow(r, id, parsed, actor.id);
  } catch (err) {
    console.error(`save ${key} failed`, err);
    return { ok: false, message: friendlyDbError(err) };
  }
  await audit(actor, id ? "update" : "create", r.table, rowId, { fields: Object.keys(parsed.values) });
  revalidateSite();
  const back = String(fd.get("__back") ?? "");
  if (!id) redirect(back.startsWith("/admin/") ? `${back}${back.includes("?") ? "&" : "?"}saved=1` : `/admin/${key}/${rowId}?saved=1`);
  return { ok: true, message: "Saved. Changes are live on the website." };
}

export async function deleteResourceAction(key: string, id: string, back: string): Promise<AdminFormState> {
  let actor;
  try {
    actor = await assertAdmin();
  } catch {
    return { ok: false, message: "Not allowed" };
  }
  const r = getResource(key);
  if (!r || r.canDelete === false) return { ok: false, message: "This item can't be deleted." };
  try {
    const rows = await sql`delete from ${sql("public." + r.table)} where id = ${id} returning id`;
    if (!rows.length) return { ok: false, message: "Already deleted." };
  } catch (err) {
    return { ok: false, message: friendlyDbError(err) };
  }
  await audit(actor, "delete", r.table, id);
  revalidateSite();
  redirect(back.startsWith("/admin") ? `${back}${back.includes("?") ? "&" : "?"}deleted=1` : `/admin/${key}?deleted=1`);
}
