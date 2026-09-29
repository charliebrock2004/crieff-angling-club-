"use client";
import { useActionState, useState } from "react";
import { submitCatchReturn, type FormState } from "@/lib/actions/public";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import { Checkbox, SelectField, TextArea, TextField } from "../ui/field";

interface Opt { id: string; name: string }
interface Props {
  waters: (Opt & { beats: Opt[] })[];
  species: Opt[];
  defaults: { name?: string; email?: string; reference?: string; waterId?: string; beatId?: string; date?: string };
  today: string;
}

export function CatchReturnForm({ waters, species, defaults, today }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitCatchReturn, null);
  const [waterId, setWaterId] = useState(defaults.waterId ?? waters[0]?.id ?? "");
  const [blank, setBlank] = useState(false);
  const [items, setItems] = useState([0]);
  const [next, setNext] = useState(1);
  const e = state?.errors ?? {};
  const beats = waters.find((w) => w.id === waterId)?.beats ?? [];

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <Alert tone="good" title="Return received">{state.message}</Alert>
        <Button variant="secondary" onClick={() => window.location.reload()}>Submit another return</Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-8" noValidate>
      {state?.message && <Alert tone="bad">{state.message}</Alert>}
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 font-display text-2xl">Your day</legend>
        <TextField label="Name" name="anglerName" required defaultValue={defaults.name} autoComplete="name" error={e.anglerName} />
        <TextField label="Email" name="email" type="email" required defaultValue={defaults.email} autoComplete="email" error={e.email} />
        <TextField label="Date fished" name="fishingDate" type="date" required max={today} defaultValue={defaults.date ?? today} error={e.fishingDate} />
        <TextField label="Permit / booking reference" name="permitReference" defaultValue={defaults.reference} placeholder="CAC-XXXXXX" hint="Optional — links this return to your permit" error={e.permitReference} />
        <SelectField label="Water" name="waterId" required value={waterId} onChange={(ev) => setWaterId(ev.target.value)} options={waters.map((w) => ({ value: w.id, label: w.name }))} error={e.waterId} />
        {beats.length > 1 ? (
          <SelectField label="Beat" name="beatId" defaultValue={defaults.beatId} placeholder="Select a beat" options={beats.map((b) => ({ value: b.id, label: b.name }))} error={e.beatId} />
        ) : (
          <input type="hidden" name="beatId" value={beats[0]?.id ?? ""} />
        )}
        <TextField label="Hours fished" name="hoursFished" type="number" inputMode="decimal" min={0} max={24} step={0.5} error={e.hoursFished} />
      </fieldset>

      <fieldset>
        <legend className="mb-4 font-display text-2xl">Your catch</legend>
        <Checkbox name="isBlank" label="Blank day — I didn't catch anything" hint="Blank returns matter just as much for managing the fishery." checked={blank} onChange={(ev) => setBlank(ev.target.checked)} />
        {!blank && (
          <div className="mt-5 space-y-4">
            <input type="hidden" name="itemCount" value={next} />
            {e.items && <p className="field-error">{e.items}</p>}
            {items.map((i, n) => (
              <div key={i} className="grid gap-4 rounded-2xl border border-line bg-white p-4 sm:grid-cols-6">
                <SelectField className="sm:col-span-2" label={`Fish ${n + 1} — species`} name={`items.${i}.speciesId`} placeholder="Select" options={species.map((s) => ({ value: s.id, label: s.name }))} error={e[`items.${n}.speciesId`]} />
                <TextField label="Number" name={`items.${i}.quantity`} type="number" min={1} max={200} defaultValue={1} inputMode="numeric" />
                <TextField label="Weight (lb)" name={`items.${i}.weightLb`} type="number" min={0} step={0.1} inputMode="decimal" />
                <TextField label="Length (in)" name={`items.${i}.lengthIn`} type="number" min={0} step={0.5} inputMode="decimal" />
                <TextField label="Method" name={`items.${i}.method`} placeholder="Fly, spinner…" />
                <div className="flex items-center justify-between gap-4 sm:col-span-6">
                  <Checkbox name={`items.${i}.released`} id={`items.${i}.released`} label="Released alive" defaultChecked />
                  {items.length > 1 && <button type="button" className="text-sm text-bad underline" onClick={() => setItems((l) => l.filter((x) => x !== i))}>Remove</button>}
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => { setItems((l) => [...l, next]); setNext((x) => x + 1); }}>+ Add another fish</Button>
          </div>
        )}
      </fieldset>

      <TextArea label="Notes (optional)" name="notes" rows={3} placeholder="River height, flies that worked, anything the committee should know" error={e.notes} />
      <div aria-hidden="true" className="absolute -left-[9999px]"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Submitting…" : "Submit catch return"}</Button>
    </form>
  );
}
