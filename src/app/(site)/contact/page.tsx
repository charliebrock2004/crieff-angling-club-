import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ContactForm } from "@/components/site/contact-form";
import { getSettings } from "@/lib/settings";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export const metadata: Metadata = pageMetadata({ title: "Contact the Club", description: "Contact Crieff Angling Club about permits, membership, bookings or the fishing on the River Earn and Drummond Loch.", path: "/contact" });

export default async function ContactPage() {
  const s = await getSettings();
  return (
    <div className="container-club py-12 sm:py-16">
      <Breadcrumbs items={[{ href: "/contact", label: "Contact" }]} />
      <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h1 className="display-lg">Contact the club</h1>
          <p className="lede mt-4">Questions about permits, membership or the fishing? Send a message and the secretary will get back to you. If it&rsquo;s about a booking, include your reference.</p>
          <dl className="mt-8 space-y-5">
            {s.contactPhone && <div><dt className="eyebrow">Secretary</dt><dd className="mt-1 text-lg"><a href={`tel:${s.contactPhone.replace(/\s/g, "")}`} className="link-underline">{s.contactPhone}</a></dd></div>}
            {s.contactEmail && <div><dt className="eyebrow">Email</dt><dd className="mt-1 text-lg"><a href={`mailto:${s.contactEmail}`} className="link-underline">{s.contactEmail}</a></dd></div>}
            {s.contactAddress && <div><dt className="eyebrow">Post</dt><dd className="mt-1 whitespace-pre-line">{s.contactAddress}</dd></div>}
            {s.permitOutlets.length > 0 && (
              <div>
                <dt className="eyebrow">Permits in person</dt>
                <dd className="mt-2 space-y-2">
                  {s.permitOutlets.map((o) => <p key={o.name}><span className="font-medium">{o.name}</span>{o.phone && <> · <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="link-underline">{o.phone}</a></>}</p>)}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="card p-6 sm:p-10"><ContactForm /></div>
      </div>
    </div>
  );
}
