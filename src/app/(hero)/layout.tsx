import { SiteShell } from "@/components/site/shell";

export default function HeroLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell overlay>{children}</SiteShell>;
}
