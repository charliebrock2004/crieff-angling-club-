import Link from "next/link";
import { Landscape } from "@/components/site/landscape";

export default function NotFound() {
  return (
    <main id="main" className="grain relative flex min-h-svh items-center overflow-hidden bg-peat text-bone">
      <Landscape variant="dusk" seed={40} className="absolute inset-0 h-full w-full opacity-70" />
      <div className="container-club relative">
        <p className="eyebrow text-bracken">404</p>
        <h1 className="display-xl mt-4 max-w-3xl">This pool&rsquo;s been fished out.</h1>
        <p className="mt-6 max-w-lg text-lg text-bone/80">The page you were looking for doesn&rsquo;t exist, or has moved.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex h-12 items-center rounded-full bg-bone px-6 font-semibold text-peat">Home</Link>
          <Link href="/book" className="inline-flex h-12 items-center rounded-full border border-white/30 px-6 font-semibold">Book a permit</Link>
        </div>
      </div>
    </main>
  );
}
