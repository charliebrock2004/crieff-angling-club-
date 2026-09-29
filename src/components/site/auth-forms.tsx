"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { register, requestPasswordReset, signIn, updatePassword } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/public";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { TextField } from "../ui/field";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null);
  const [mode, setMode] = useState<"password" | "magic">("password");
  const e = state?.errors ?? {};
  if (state?.ok) return <Alert tone="good" title="Check your email">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message && <Alert tone="bad">{state.message}</Alert>}
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value={mode} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required error={e.email} />
      {mode === "password" && <TextField label="Password" name="password" type="password" autoComplete="current-password" required error={e.password} />}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Please wait…" : mode === "password" ? "Sign in" : "Email me a sign-in link"}</Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" className="link-underline" onClick={() => setMode(mode === "password" ? "magic" : "password")}>
          {mode === "password" ? "Sign in with an email link instead" : "Use a password instead"}
        </button>
        <Link href="/forgot-password" className="link-underline">Forgotten password?</Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(register, null);
  const e = state?.errors ?? {};
  if (state?.ok) return <Alert tone="good" title="Nearly there">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message && <Alert tone="bad">{state.message}</Alert>}
      <TextField label="Full name" name="fullName" autoComplete="name" required error={e.fullName} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required error={e.email} hint="Use the email you book with, so your permits appear in your account." />
      <TextField label="Password" name="password" type="password" autoComplete="new-password" required minLength={10} error={e.password} hint="At least 10 characters" />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, null);
  if (state?.ok) return <Alert tone="good">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message && <Alert tone="bad">{state.message}</Alert>}
      <TextField label="Email" name="email" type="email" autoComplete="email" required error={state?.errors?.email} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>Send reset link</Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, null);
  if (state?.ok) return <Alert tone="good" title="Password updated">{state.message} <Link href="/account" className="underline">Go to your account</Link>.</Alert>;
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message && <Alert tone="bad">{state.message}</Alert>}
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={10} error={state?.errors?.password} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>Update password</Button>
    </form>
  );
}
