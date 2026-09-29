import type { ReactNode } from "react";
import { getSettings } from "@/lib/settings";
import { organizationJsonLd } from "@/lib/seo";
import { Footer } from "./footer";
import { Header } from "./header";
import { JsonLd } from "./json-ld";

export async function SiteShell({ children, overlay }: { children: ReactNode; overlay: boolean }) {
  const settings = await getSettings();
  return (
    <>
      {settings.announcement && (
        <div className="relative z-40 bg-bracken px-4 py-2 text-center text-sm font-medium text-bone" role="status">
          {settings.announcement}
        </div>
      )}
      <div className="relative">
        <Header overlay={overlay} />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
      </div>
      <Footer settings={settings} />
      <JsonLd data={organizationJsonLd({ phone: settings.contactPhone, email: settings.contactEmail, sameAs: [settings.facebookUrl].filter(Boolean) as string[] })} />
    </>
  );
}
