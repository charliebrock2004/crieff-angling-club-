import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { getViewer } from "@/lib/auth";
import { ipHash, rateLimit } from "@/lib/request";
import { formatDate } from "@/lib/format";
import { verifyPermit, type VerificationResult } from "@/lib/permits/data";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Permit check", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const RESULT: Record<VerificationResult, { label: string; detail: string; tone: "good" | "warn" | "bad" }> = {
  valid: { label: "VALID TODAY", detail: "This permit is paid and valid for today.", tone: "good" },
  valid_other_day: { label: "NOT VALID TODAY", detail: "This permit is paid, but for a different date.", tone: "warn" },
  expired: { label: "EXPIRED", detail: "This permit was for an earlier date.", tone: "bad" },
  cancelled: { label: "CANCELLED", detail: "This booking has been cancelled. The permit is not valid.", tone: "bad" },
  refunded: { label: "REFUNDED", detail: "This booking was refunded. The permit is not valid.", tone: "bad" },
  unpaid: { label: "NOT PAID", detail: "Payment for this booking was not completed. The permit is not valid.", tone: "bad" },
  not_found: { label: "NOT RECOGNISED", detail: "No permit matches this code. Check the code, or ask the angler for their booking reference.", tone: "bad" },
};

export default async function VerifyPage({ params }: PageProps<"/permit/verify/[code]">) {
  const { code } = await params;
  if (!(await rateLimit("verify", 60, 60))) {
    return <div className="container-club max-w-xl py-24"><p role="alert">Too many checks from this connection. Please wait a minute.</p></div>;
  }
  const viewer = await getViewer().catch(() => null);
  const staff = viewer?.role === "admin" || viewer?.role === "bailiff";
  const v = await verifyPermit(sql, code, { staff });
  await sql`insert into public.permit_verifications (permit_id, code, result, verified_by, ip_hash) values (${v.permitId}, ${code.slice(0, 40)}, ${v.result}, ${viewer?.id ?? null}, ${await ipHash()})`.catch(() => {});
  const r = RESULT[v.result];

  return (
    <div className="container-club max-w-xl py-10 sm:py-16">
      <div
        role="status"
        className={cn(
          "rounded-[var(--radius-card)] p-8 text-center text-white shadow-[var(--shadow-lift)]",
          r.tone === "good" ? "bg-good" : r.tone === "warn" ? "bg-warn" : "bg-bad",
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="mx-auto h-16 w-16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {r.tone === "good" ? <path d="m14 25 7 7 14-16" /> : r.tone === "warn" ? <path d="M24 14v12m0 8h.01" /> : <path d="m16 16 16 16M32 16 16 32" />}
          <circle cx="24" cy="24" r="21" />
        </svg>
        <p className="mt-4 font-display text-4xl tracking-wide">{r.label}</p>
        <p className="mt-2 text-white/90">{r.detail}</p>
      </div>

      {v.permitId && (
        <dl className="card mt-6 divide-y divide-line">
          {[
            ["Angler", v.anglerName],
            ["Date", v.fishingDate ? formatDate(v.fishingDate, "full") : null],
            ["Water", v.waterName],
            ["Beat", v.beatName],
            ["Permit", v.permitTypeName],
            ["Boat", v.boatName],
            ["Permit no.", v.permitNumber],
            ["Booking ref.", v.bookingReference],
          ]
            .filter(([, val]) => val)
            .map(([k, val]) => (
              <div key={k} className="flex justify-between gap-4 px-5 py-3.5">
                <dt className="text-stone">{k}</dt>
                <dd className="text-right font-medium">{val}</dd>
              </div>
            ))}
        </dl>
      )}
      <p className="mt-6 text-center text-sm text-stone">
        {staff ? `Checked as ${viewer?.email}.` : <>Club officials: <Link href={`/login?next=/permit/verify/${code}`} className="link-underline">sign in</Link> to see full details.</>}
      </p>
      <p className="mt-2 text-center text-sm"><Link href="/permit/verify" className="link-underline">Check another permit</Link></p>
    </div>
  );
}
