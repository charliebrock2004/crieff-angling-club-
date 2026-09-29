import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { sql } from "./db";
import { createSupabaseServerClient } from "./supabase/server";

export type Role = "angler" | "bailiff" | "admin";

export interface Viewer {
  id: string;
  email: string;
  emailConfirmed: boolean;
  role: Role;
  fullName: string | null;
}

/**
 * The signed-in user, verified against Supabase Auth (getUser() validates the
 * JWT with the auth server rather than trusting the cookie), with their role
 * from our own profiles table.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return devTestViewer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !data.user.email) return null;
  const u = data.user;
  const [profile] = await sql`select role, full_name from public.profiles where id = ${u.id}`;
  return {
    id: u.id,
    email: u.email!.toLowerCase(),
    emailConfirmed: !!u.email_confirmed_at,
    role: (profile?.role as Role) ?? "angler",
    fullName: profile?.full_name ?? (u.user_metadata?.full_name as string | undefined) ?? null,
  };
});

export async function requireUser(next = "/account"): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(next)}`);
  return v;
}

/** For admin pages: redirects to login, or 404s for signed-in non-admins. */
export async function requireAdmin(next = "/admin"): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (v.role !== "admin") notFound();
  return v;
}

export async function requireStaff(next = "/bailiff"): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (v.role !== "admin" && v.role !== "bailiff") notFound();
  return v;
}

export class AuthError extends Error {
  constructor(message = "You are not allowed to do that.") {
    super(message);
    this.name = "AuthError";
  }
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertAdmin(): Promise<Viewer> {
  const v = await getViewer();
  if (!v || v.role !== "admin") throw new AuthError();
  return v;
}

/**
 * LOCAL AUTOMATED TESTING ONLY. Lets the end-to-end scripts act as a user when
 * Supabase Auth isn't available. It is impossible to enable in a deployed
 * site: it requires NODE_ENV !== "production" (Vercel production AND preview
 * builds always run with NODE_ENV=production), E2E_AUTH_BYPASS=1, and no
 * Supabase configuration at all.
 */
async function devTestViewer(): Promise<Viewer | null> {
  if (process.env.NODE_ENV === "production" || process.env.E2E_AUTH_BYPASS !== "1" || process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const email = (await cookies()).get("e2e_user")?.value;
  if (!email) return null;
  const [p] = await sql`select id, email, role, full_name from public.profiles where email = ${email}`;
  return p ? { id: p.id, email: p.email, emailConfirmed: true, role: p.role, fullName: p.full_name } : null;
}
