import type { Metadata } from "next";
import { ResetForm } from "@/components/site/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function Page() {
  
  return (
    <div className="container-club flex justify-center py-16 sm:py-24">
      <div className="w-full max-w-md">
        <h1 className="display-md text-center">Choose a new password</h1>
        <div className="card mt-8 p-6 sm:p-8"><ResetForm /></div>
        
      </div>
    </div>
  );
}
