import type { ReactNode } from "react";
import { HeroMedia } from "./hero-media";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

export function PageHero({
  eyebrow,
  title,
  intro,
  image,
  imageAlt,
  variant = "river",
  seed = 3,
  crumbs,
  actions,
  size = "md",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  image?: string | null;
  imageAlt?: string | null;
  variant?: "river" | "loch" | "dusk" | "winter";
  seed?: number;
  crumbs?: Crumb[];
  actions?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <section className={`grain relative overflow-hidden bg-peat text-bone ${size === "lg" ? "min-h-[78svh]" : "min-h-[58svh]"} flex items-end`}>
      <HeroMedia src={image} alt={imageAlt} variant={variant} seed={seed} priority />
      <div className="absolute inset-0 bg-gradient-to-t from-peat via-peat/45 to-peat/10" aria-hidden="true" />
      <div className="container-club relative pb-12 pt-32 sm:pb-16 lg:pb-20">
        {crumbs && <Breadcrumbs items={crumbs} tone="light" />}
        {eyebrow && <p className="eyebrow mt-6 text-bracken">{eyebrow}</p>}
        <h1 className="display-xl mt-4 max-w-4xl animate-rise">{title}</h1>
        {intro && <div className="mt-6 max-w-2xl text-lg leading-relaxed text-bone/85 sm:text-xl">{intro}</div>}
        {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </section>
  );
}
