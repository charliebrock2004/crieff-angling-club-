import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/site/auth-forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function Page({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/account";
  const error = sp.error;
  return (
    <div className="container-club flex justify-center py-16 sm:py-24">
      <div className="w-full max-w-md">
        <h1 className="display-md text-center">Sign in</h1>
        <div className="card mt-8 p-6 sm:p-8">
          {error === "link" && <p role="alert" className="mb-5 rounded-xl bg-bad-bg p-3 text-sm text-bad">That link has expired or was already used. Please try again.</p>}
          <LoginForm next={next} /></div>
        <p className="mt-6 text-center text-sm text-stone">New here? <Link href="/register" className="link-underline font-semibold text-peat">Create an account</Link>. You don&rsquo;t need one to book.</p>
      </div>
    </div>
  );
}
