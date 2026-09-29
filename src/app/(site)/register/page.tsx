import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/site/auth-forms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function Page() {
  
  return (
    <div className="container-club flex justify-center py-16 sm:py-24">
      <div className="w-full max-w-md">
        <h1 className="display-md text-center">Create an account</h1>
        <div className="card mt-8 p-6 sm:p-8"><RegisterForm /></div>
        <p className="mt-6 text-center text-sm text-stone">Already registered? <Link href="/login" className="link-underline font-semibold text-peat">Sign in</Link></p>
      </div>
    </div>
  );
}
