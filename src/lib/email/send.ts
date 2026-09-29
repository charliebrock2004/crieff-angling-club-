import "server-only";
import { Resend } from "resend";
import { sql } from "../db";
import { env } from "../env";
import type { Email } from "./templates";

export interface SendResult {
  status: "sent" | "failed" | "skipped";
  error?: string;
}

let client: Resend | null | undefined;
function resend(): Resend | null {
  if (client === undefined) client = env.resendApiKey ? new Resend(env.resendApiKey) : null;
  return client;
}

/**
 * Sends an email via Resend and records the outcome in email_logs. When
 * RESEND_API_KEY is not set the email is logged as "skipped" (and printed in
 * development) — it is never reported as sent.
 */
export async function sendEmail(
  to: string,
  template: string,
  email: Email,
  opts: { bookingId?: string; membershipApplicationId?: string; attachments?: { filename: string; content: Buffer }[]; replyTo?: string } = {},
): Promise<SendResult> {
  const r = resend();
  let result: SendResult;
  let providerId: string | null = null;
  if (!r) {
    result = { status: "skipped", error: "RESEND_API_KEY not configured" };
    if (process.env.NODE_ENV !== "production") console.info(`[email:skipped] to=${to} subject="${email.subject}"`);
  } else {
    try {
      const { data, error } = await r.emails.send({
        from: env.emailFrom,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: opts.replyTo ?? env.emailReplyTo,
        attachments: opts.attachments,
      });
      if (error) result = { status: "failed", error: error.message };
      else {
        result = { status: "sent" };
        providerId = data?.id ?? null;
      }
    } catch (err) {
      result = { status: "failed", error: (err as Error).message };
    }
  }
  try {
    await sql`
      insert into public.email_logs (to_email, template, subject, booking_id, membership_application_id, status, provider_id, error)
      values (${to}, ${template}, ${email.subject}, ${opts.bookingId ?? null}, ${opts.membershipApplicationId ?? null}, ${result.status}, ${providerId}, ${result.error ?? null})`;
  } catch (err) {
    console.error("email log failed", err);
  }
  if (result.status === "failed") console.error(`[email:failed] ${template} to=${to}: ${result.error}`);
  return result;
}
