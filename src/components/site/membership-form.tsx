"use client";
import { useActionState } from "react";
import { applyForMembership } from "@/lib/actions/membership";
import type { FormState } from "@/lib/actions/public";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { Checkbox, SelectField, TextArea, TextField } from "../ui/field";

export function MembershipForm({ types, defaultType, defaults }: { types: { id: string; slug: string; name: string }[]; defaultType?: string; defaults: { email?: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(applyForMembership, null);
  if (state?.ok) return <Alert tone="good" title="Application received">{state.message}</Alert>;
  const e = state?.errors ?? {};
  return (
    <form action={action} noValidate className="grid gap-5 sm:grid-cols-2">
      {state?.message && <Alert tone="bad" className="sm:col-span-2">{state.message}</Alert>}
      <SelectField className="sm:col-span-2" label="Membership type" name="membershipTypeId" required defaultValue={types.find((t) => t.slug === defaultType)?.id} options={types.map((t) => ({ value: t.id, label: t.name }))} error={e.membershipTypeId} />
      <TextField label="First name" name="firstName" required autoComplete="given-name" error={e.firstName} />
      <TextField label="Surname" name="lastName" required autoComplete="family-name" error={e.lastName} />
      <TextField label="Email" name="email" type="email" required autoComplete="email" defaultValue={defaults.email} error={e.email} />
      <TextField label="Phone" name="phone" type="tel" required autoComplete="tel" error={e.phone} />
      <TextField className="sm:col-span-2" label="Address" name="addressLine1" required autoComplete="address-line1" error={e.addressLine1} />
      <TextField className="sm:col-span-2" label="Address line 2" name="addressLine2" autoComplete="address-line2" />
      <TextField label="Town" name="town" required autoComplete="address-level2" error={e.town} />
      <TextField label="Postcode" name="postcode" required autoComplete="postal-code" error={e.postcode} hint="Used to confirm local eligibility" />
      <TextField label="Date of birth (juniors only)" name="dateOfBirth" type="date" error={e.dateOfBirth} />
      <div className="flex items-end pb-3"><Checkbox name="isRenewal" label="I'm renewing an existing membership" /></div>
      <TextArea className="sm:col-span-2" label="Anything you'd like the committee to know? (optional)" name="statement" rows={4} error={e.statement} />
      <div aria-hidden="true" className="absolute -left-[9999px]"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="sm:col-span-2"><Button type="submit" size="lg" disabled={pending}>{pending ? "Submitting…" : "Submit application"}</Button></div>
    </form>
  );
}
