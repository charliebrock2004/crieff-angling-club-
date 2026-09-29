import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "info" | "good" | "bad" | "warn";
const styles: Record<Tone, string> = {
  info: "border-info/25 bg-info-bg text-info",
  good: "border-good/25 bg-good-bg text-good",
  bad: "border-bad/25 bg-bad-bg text-bad",
  warn: "border-warn/25 bg-warn-bg text-warn",
};
const icons: Record<Tone, ReactNode> = {
  info: <path d="M10 9v5m0-8h.01M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />,
  good: <path d="m6.5 10.5 2.5 2.5 5-6M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />,
  bad: <path d="M10 6v5m0 3h.01M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />,
  warn: <path d="M10 7v4m0 3h.01M8.3 3.2 1.9 14.5A2 2 0 0 0 3.6 17.5h12.8a2 2 0 0 0 1.7-3l-6.4-11.3a2 2 0 0 0-3.4 0Z" />,
};

export function Alert({ tone = "info", title, children, className, role }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string; role?: "alert" | "status" }) {
  return (
    <div role={role ?? (tone === "bad" ? "alert" : "status")} className={cn("flex gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-relaxed", styles[tone], className)}>
      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 flex-none" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {icons[tone]}
      </svg>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-peat/85")}>{children}</div>}
      </div>
    </div>
  );
}
