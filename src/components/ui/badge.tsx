import type { ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "good" | "bad" | "warn" | "info" | "accent" | "dark";
const tones: Record<Tone, string> = {
  neutral: "bg-mist text-peat",
  good: "bg-good-bg text-good",
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
  info: "bg-info-bg text-info",
  accent: "bg-bracken/15 text-bracken-dark",
  dark: "bg-peat text-bone",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

const bookingTone: Record<string, Tone> = { paid: "good", pending: "warn", failed: "bad", cancelled: "neutral", refunded: "info" };
const bookingLabel: Record<string, string> = { paid: "Paid", pending: "Pending", failed: "Failed", cancelled: "Cancelled", refunded: "Refunded" };

export function BookingStatusBadge({ status }: { status: string }) {
  return <Badge tone={bookingTone[status] ?? "neutral"}>{bookingLabel[status] ?? status}</Badge>;
}

export function NeedsConfirmation({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <Badge tone="warn" className="uppercase tracking-wider">
      Needs confirmation
    </Badge>
  );
}
