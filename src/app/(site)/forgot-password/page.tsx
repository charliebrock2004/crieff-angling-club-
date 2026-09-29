import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/site/auth-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default async function Page() {
  
  return (
    <div className="container-club flex justify-center py-16 sm:py-24">
      <div className="w-full max-w-md">
        <h1 className="display-md text-center">Reset your password</h1>
        <div className="card mt-8 p-6 sm:p-8"><ForgotForm /></div>
        <p className="mt-6 text-center text-sm"><Link href="/login" className="link-underline">Back to sign in</Link></p>
      </div>
    </div>
  );
}
