import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { clubToday, isIsoDate } from "@/lib/dates";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Book a Fishing Permit",
  description: "Check live availability and book River Earn and Drummond Loch day permits online. Instant digital permit by email.",
  path: "/book",
});

const slug = (v: string | string[] | undefined) => (typeof v === "string" && /^[a-z0-9-]{1,60}$/.test(v) ? v : null);

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const sp = await searchParams;
  const date = typeof sp.date === "string" && isIsoDate(sp.date) && sp.date >= clubToday() ? sp.date : null;
  const today = clubToday();
  return (
    <div className="container-club py-10 sm:py-14">
      <Breadcrumbs items={[{ href: "/book", label: "Book a permit" }]} />
      <div className="mt-6 max-w-2xl">
        <h1 className="display-lg">Book a permit</h1>
        <p className="lede mt-4">Choose a date to see live availability for every beat. Your permits are held while you pay, and your digital permit arrives by email straight away.</p>
      </div>
      <div className="mt-10 sm:mt-12">
        <BookingWizard preselect={{ date, water: slug(sp.water), beat: slug(sp.beat), permit: slug(sp.permit) }} initialMonth={(date ?? today).slice(0, 7)} />
      </div>
    </div>
  );
}
