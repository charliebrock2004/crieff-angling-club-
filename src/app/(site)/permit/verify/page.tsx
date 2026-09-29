import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Verify a Fishing Permit",
  description: "Club officials can check whether a Crieff Angling Club permit is valid by scanning its QR code or entering the code.",
  path: "/permit/verify",
});

async function go(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 32);
  redirect(code ? `/permit/verify/${code}` : "/permit/verify");
}

export default function VerifyIndex() {
  return (
    <div className="container-club max-w-xl py-16 sm:py-24">
      <p className="eyebrow">For club officials</p>
      <h1 className="display-lg mt-3">Verify a permit</h1>
      <p className="lede mt-4">Scan the QR code on the angler&rsquo;s permit, or type the code printed under it.</p>
      <form action={go} className="mt-8 flex gap-2">
        <label htmlFor="code" className="sr-only">Permit code</label>
        <input id="code" name="code" required autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="e.g. 7K3M9PQ2XH4R8T" className="input font-mono uppercase" />
        <button className="h-[50px] flex-none rounded-xl bg-peat px-5 font-semibold text-bone hover:bg-moss">Check</button>
      </form>
    </div>
  );
}
