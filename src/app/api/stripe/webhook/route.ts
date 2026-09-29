import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { processStripeEvent } from "@/lib/booking/webhook";
import { emailNotifier } from "@/lib/email/notifier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook. The signature is verified against the raw body with
 * STRIPE_WEBHOOK_SECRET; unsigned or tampered requests are rejected.
 * Returns 500 on processing errors so Stripe retries (processing is idempotent).
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = env.stripeWebhookSecret;
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const outcome = await processStripeEvent(sql, event, emailNotifier);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    console.error(`stripe webhook ${event.type} ${event.id} failed`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
