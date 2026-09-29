"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { AdminFormState } from "@/lib/admin/actions";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";

/** Wraps an admin form: pending state, success and error messages. */
export function AdminForm({
  action,
  children,
  submitLabel = "Save changes",
  className,
  resetOnSuccess = false,
}: {
  action: (prev: AdminFormState, fd: FormData) => Promise<AdminFormState>;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state) top.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      <div ref={top} aria-live="polite">
        {state && <Alert tone={state.ok ? "good" : "bad"} className="mb-6" title={state.ok ? "Done" : "Not saved"}>{state.message}</Alert>}
      </div>
      {children}
      <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        {pending && <span className="text-sm text-stone">Please wait…</span>}
      </div>
    </form>
  );
}
