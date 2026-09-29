import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

interface FieldProps {
  label: ReactNode;
  name: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}

function Wrapper({ label, name, error, hint, required, className, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="field-label">
        {label}
        {required && <span className="text-bracken" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${name}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${name}-error`} className="field-error">{error}</p>}
    </div>
  );
}

const describedBy = (name: string, error?: string, hint?: ReactNode) => (error ? `${name}-error` : hint ? `${name}-hint` : undefined);

export function TextField({ label, name, error, hint, required, className, ...input }: FieldProps & Omit<ComponentProps<"input">, "name">) {
  return (
    <Wrapper {...{ label, name, error, hint, required, className }}>
      <input id={name} name={name} required={required} aria-invalid={!!error || undefined} aria-describedby={describedBy(name, error, hint)} className="input" {...input} />
    </Wrapper>
  );
}

export function TextArea({ label, name, error, hint, required, className, ...input }: FieldProps & Omit<ComponentProps<"textarea">, "name">) {
  return (
    <Wrapper {...{ label, name, error, hint, required, className }}>
      <textarea id={name} name={name} required={required} aria-invalid={!!error || undefined} aria-describedby={describedBy(name, error, hint)} className="input min-h-28" {...input} />
    </Wrapper>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  required,
  className,
  options,
  placeholder,
  ...input
}: FieldProps & Omit<ComponentProps<"select">, "name"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Wrapper {...{ label, name, error, hint, required, className }}>
      <select id={name} name={name} required={required} aria-invalid={!!error || undefined} aria-describedby={describedBy(name, error, hint)} className="input" {...input}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function Checkbox({ label, name, hint, className, ...input }: { label: ReactNode; name: string; hint?: ReactNode; className?: string } & Omit<ComponentProps<"input">, "name" | "type">) {
  const id = input.id ?? name;
  return (
    <div className={cn("flex gap-3", className)}>
      <input id={id} name={name} type="checkbox" className="mt-0.5 h-5 w-5 flex-none rounded border-line accent-peat" {...input} />
      <label htmlFor={id} className="text-sm leading-relaxed text-peat">
        {label}
        {hint && <span className="mt-0.5 block text-stone">{hint}</span>}
      </label>
    </div>
  );
}
