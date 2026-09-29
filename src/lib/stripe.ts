import "server-only";
import Stripe from "stripe";
import { env } from "./env";

let instance: Stripe | null | undefined;

/** Stripe client, or null when STRIPE_SECRET_KEY is not configured. */
export function getStripe(): Stripe | null {
  if (instance === undefined) {
    instance = env.stripeSecretKey ? new Stripe(env.stripeSecretKey, { appInfo: { name: "Crieff Angling Club" }, maxNetworkRetries: 2 }) : null;
  }
  return instance;
}
