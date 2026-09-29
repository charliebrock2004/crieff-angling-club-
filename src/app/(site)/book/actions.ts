"use server";
import { sql, databaseNotReadyMessage, isEphemeralDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { getViewer } from "@/lib/auth";
import { rateLimit } from "@/lib/request";
import { BookingError, startCheckout } from "@/lib/booking/service";
import { checkoutSchema, fieldErrors } from "@/lib/validation";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

export async function startCheckoutAction(payload: unknown): Promise<CheckoutResult> {
  if (!(await rateLimit("checkout", 12, 600))) {
    return { ok: false, error: "Too many booking attempts from your connection. Please wait a few minutes and try again." };
  }
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted details.", fieldErrors: fieldErrors(parsed.error) };
  }
  if (parsed.data.website) return { ok: false, error: "Unable to process this booking." };
  if (isEphemeralDatabase) return { ok: false, error: databaseNotReadyMessage, code: "payments_unavailable" };
  try {
    const viewer = await getViewer().catch(() => null);
    const { url } = await startCheckout(sql, parsed.data, { stripe: getStripe(), siteUrl: env.siteUrl }, { userId: viewer?.id, userEmail: viewer?.emailConfirmed ? viewer.email : null });
    return { ok: true, url };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message, code: err.code };
    console.error("checkout failed", err);
    return { ok: false, error: "Something went wrong on our side. Nothing has been charged — please try again." };
  }
}
