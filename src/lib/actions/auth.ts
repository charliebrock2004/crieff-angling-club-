"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "../env";
import { rateLimit } from "../request";
import { createSupabaseServerClient } from "../supabase/server";
import type { FormState } from "./public";

const NOT_CONFIGURED: FormState = { ok: false, message: "Sign-in is not available yet — the site's authentication service has not been configured." };

/** Only allow same-site relative redirects. */
function safeNext(v: FormDataEntryValue | null, fallback = "/account"): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordSchema = z.string().min(10, "Use at least 10 characters").max(128);

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("login", 10, 600))) return { ok: false, message: "Too many sign-in attempts. Please wait a few minutes." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const email = emailSchema.safeParse(fd.get("email"));
  if (!email.success) return { ok: false, errors: { email: email.error.issues[0].message } };
  const next = safeNext(fd.get("next"));
  const password = String(fd.get("password") ?? "");

  if (fd.get("mode") === "magic" || !password) {
    const { error } = await supabase.auth.signInWithOtp({ email: email.data, options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: false } });
    // Same message whether or not the account exists (no account enumeration).
    if (error && !/signups not allowed|not found/i.test(error.message)) console.error("magic link", error.message);
    return { ok: true, message: "If an account exists for that address, we've emailed you a sign-in link." };
  }
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) return { ok: false, message: /confirm/i.test(error.message) ? "Please confirm your email address first — check your inbox." : "Email or password is incorrect." };
  redirect(next);
}

export async function register(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("register", 5, 3600))) return { ok: false, message: "Too many attempts. Please try again later." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const parsed = z
    .object({ fullName: z.string().trim().min(2, "Enter your name").max(120), email: emailSchema, password: passwordSchema })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, errors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) };
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: `${env.siteUrl}/auth/callback?next=/account` },
  });
  if (error && !/already registered/i.test(error.message)) return { ok: false, message: error.message };
  return { ok: true, message: "Check your email to confirm your address, then sign in. Any bookings made with this email will appear in your account." };
}

export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("reset", 5, 3600))) return { ok: false, message: "Too many attempts. Please try again later." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const email = emailSchema.safeParse(fd.get("email"));
  if (!email.success) return { ok: false, errors: { email: email.error.issues[0].message } };
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password` });
  return { ok: true, message: "If an account exists for that address, we've sent a link to reset your password." };
}

export async function updatePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const pw = passwordSchema.safeParse(fd.get("password"));
  if (!pw.success) return { ok: false, errors: { password: pw.error.issues[0].message } };
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { ok: false, message: "Your reset link has expired. Please request a new one." };
  return { ok: true, message: "Your password has been updated." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/");
}
