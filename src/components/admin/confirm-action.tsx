"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import type { AdminFormState } from "@/lib/admin/actions";
import { Button } from "../ui/button";

/**
 * A button that asks for confirmation in a modal before running a server
 * action. Optional form fields (e.g. a reason) are rendered inside the modal.
 */
export function ConfirmAction({
  action,
  label,
  title,
  body,
  confirmLabel = "Confirm",
  variant = "danger",
  size = "md",
  fields,
}: {
  action: (fd: FormData) => Promise<AdminFormState | void>;
  label: ReactNode;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  variant?: "danger" | "primary" | "secondary" | "accent";
  size?: "sm" | "md";
  fields?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminFormState | null>(null);
  return (
    <>
      <Button type="button" variant={variant === "danger" ? "secondary" : variant} size={size} onClick={() => { setResult(null); dialog.current?.showModal(); }} className={variant === "danger" ? "border-bad/40 text-bad hover:border-bad hover:bg-bad hover:text-white" : undefined}>
        {label}
      </Button>
      <dialog ref={dialog} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-line bg-bone p-0 shadow-[var(--shadow-lift)] backdrop:bg-peat/60">
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await action(fd);
              if (r && !r.ok) setResult(r);
              else if (r?.ok) {
                setResult(r);
                setTimeout(() => dialog.current?.close(), 900);
              } else dialog.current?.close();
            });
          }}
        >
          <h2 className="font-display text-2xl">{title}</h2>
          {body && <div className="mt-2 text-sm text-stone">{body}</div>}
          {fields && <div className="mt-5 space-y-4">{fields}</div>}
          {result && <p role="alert" className={`mt-4 rounded-xl p-3 text-sm ${result.ok ? "bg-good-bg text-good" : "bg-bad-bg text-bad"}`}>{result.message}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()} disabled={pending}>Cancel</Button>
            <Button type="submit" variant={variant === "secondary" ? "primary" : variant} disabled={pending}>{pending ? "Working…" : confirmLabel}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
