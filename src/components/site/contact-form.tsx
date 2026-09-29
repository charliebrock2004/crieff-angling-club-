"use client";
import { useActionState } from "react";
import { submitContact, type FormState } from "@/lib/actions/public";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { TextArea, TextField } from "../ui/field";

export function ContactForm({ defaultSubject }: { defaultSubject?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitContact, null);
  if (state?.ok) return <Alert tone="good" title="Message sent">{state.message}</Alert>;
  const e = state?.errors ?? {};
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2" noValidate>
      {state?.message && <Alert tone="bad" className="sm:col-span-2">{state.message}</Alert>}
      <TextField label="Your name" name="name" required autoComplete="name" error={e.name} />
      <TextField label="Email" name="email" type="email" required autoComplete="email" error={e.email} />
      <TextField label="Phone (optional)" name="phone" type="tel" autoComplete="tel" error={e.phone} />
      <TextField label="Subject" name="subject" required defaultValue={defaultSubject} error={e.subject} />
      <TextArea label="Message" name="message" required rows={6} className="sm:col-span-2" error={e.message} />
      <div aria-hidden="true" className="absolute -left-[9999px]"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="sm:col-span-2"><Button type="submit" size="lg" disabled={pending}>{pending ? "Sending…" : "Send message"}</Button></div>
    </form>
  );
}
