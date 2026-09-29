import Image from "next/image";
import { Landscape } from "./landscape";

/** Admin-uploaded photograph if there is one, otherwise the illustrated landscape. */
export function HeroMedia({ src, alt, variant = "river", seed = 7, priority = false, sizes = "100vw" }: { src?: string | null; alt?: string | null; variant?: "river" | "loch" | "dusk" | "winter"; seed?: number; priority?: boolean; sizes?: string }) {
  if (src) {
    return <Image src={src} alt={alt ?? ""} fill priority={priority} sizes={sizes} className="object-cover" />;
  }
  return <Landscape variant={variant} seed={seed} className="absolute inset-0 h-full w-full" />;
}
