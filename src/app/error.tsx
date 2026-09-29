"use client";
import Link from "next/link";

export default function Error({ reset, error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="container-club flex min-h-[70svh] flex-col justify-center py-20">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="display-lg mt-3 max-w-2xl">Sorry — we couldn&rsquo;t load this page.</h1>
      <p className="lede mt-4 max-w-xl">This is on our side, not yours. If you were paying for a permit, no booking is confirmed until you receive our email — please check before trying again.</p>
      {error.digest && <p className="mt-3 text-sm text-stone">Reference: {error.digest}</p>}
      <div className="mt-8 flex gap-3">
        <button onClick={reset} className="h-12 rounded-full bg-peat px-6 font-semibold text-bone">Try again</button>
        <Link href="/contact" className="inline-flex h-12 items-center rounded-full border border-line px-6 font-semibold">Contact the club</Link>
      </div>
    </main>
  );
}
