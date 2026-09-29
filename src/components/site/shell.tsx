import type { ReactNode } from "react";
import { isEphemeralDatabase } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { organizationJsonLd } from "@/lib/seo";
import { Footer } from "./footer";
import { Header } from "./header";
import { JsonLd } from "./json-ld";

export async function SiteShell({ children, overlay }: { children: ReactNode; overlay: boolean }) {
  const settings = await getSettings();
  return (
    <>
      {isEphemeralDatabase && (
        <div className="relative z-40 bg-bracken px-4 py-2 text-center text-sm font-medium text-bone" role="status">
          The club database is not connected yet. Waters, prices and availability shown here are the seeded fishery records. Bookings are not confirmed and nothing is charged until that database is in place.
        </div>
      )}
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
