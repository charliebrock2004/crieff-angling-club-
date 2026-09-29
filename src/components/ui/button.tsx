import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light" | "accent" | "glass";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[0.01em] transition duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-peat text-bone hover:bg-moss shadow-sm hover:shadow-md",
  accent: "bg-bracken text-bone hover:bg-bracken-dark shadow-sm hover:shadow-md",
  secondary: "border border-peat/20 bg-transparent text-peat hover:border-peat hover:bg-peat hover:text-bone",
  ghost: "text-peat hover:bg-mist",
  danger: "bg-bad text-white hover:bg-[#7f2f26]",
  light: "bg-bone text-peat hover:bg-white shadow-sm",
  glass: "border border-white/30 bg-white/10 text-bone backdrop-blur hover:bg-white/20 hover:border-white/50",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-7 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function ArrowRight({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={cn("h-4 w-4", className)} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10h11m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
