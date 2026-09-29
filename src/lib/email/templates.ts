/**
 * Email templates. Table-based, inline-styled HTML so they render in every
 * mainstream client, single column so they read well on a phone. Every
 * template also returns a plain-text version.
 */
import { formatDate, formatMoney } from "../format";
import type { BookingDetail } from "../permits/data";

const C = { ink: "#14221d", paper: "#f5f1e8", card: "#ffffff", muted: "#5b665f", accent: "#b8782e", line: "#e3ddd0", good: "#2f6b45", bad: "#9b3b30" };

export interface Email {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(opts: { preheader: string; title: string; body: string; siteUrl: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="background:${C.ink};padding:28px 28px 24px;border-radius:14px 14px 0 0;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:.06em;color:#f5f1e8;">CRIEFF ANGLING CLUB</div>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.2em;color:${C.accent};margin-top:6px;">RIVER EARN · DRUMMOND LOCH</div>
</td></tr>
<tr><td style="background:${C.card};padding:32px 28px;border-radius:0 0 14px 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${C.ink};">
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.25;margin:0 0 16px;color:${C.ink};">${esc(opts.title)}</h1>
  ${opts.body}
</td></tr>
<tr><td style="padding:20px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${C.muted};text-align:center;">
  Crieff Angling Club · Crieff, Perthshire<br>
  <a href="${esc(opts.siteUrl)}" style="color:${C.muted};">${esc(opts.siteUrl.replace(/^https?:\/\//, ""))}</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:${C.ink};border-radius:999px;">
<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#f5f1e8;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

function rows(pairs: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};margin:20px 0;">
${pairs
  .map(
    ([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:13px;color:${C.muted};width:40%;vertical-align:top;">${esc(k)}</td>
<td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:15px;color:${C.ink};vertical-align:top;">${esc(v)}</td></tr>`,
  )
  .join("")}</table>`;
}

function bookingPairs(b: BookingDetail): [string, string][] {
  const pairs: [string, string][] = [
    ["Booking reference", b.reference],
    ["Date", formatDate(b.fishingDate, "full")],
    ["Water", b.water.name],
  ];
  if (b.beat.name !== b.water.name) pairs.push(["Beat", b.beat.name]);
  pairs.push(["Permit", `${b.permitType.name} × ${b.quantity}`]);
  if (b.boat) pairs.push(["Boat", b.boat.name]);
  pairs.push(["Anglers", b.permits.map((p) => `${p.anglerFirstName} ${p.anglerLastName}`).join(", ")]);
  pairs.push(["Total", formatMoney(b.totalPence)]);
  return pairs;
}

function textPairs(pairs: [string, string][]) {
  return pairs.map(([k, v]) => `${k}: ${v}`).join("\n");
}

export function bookingConfirmationEmail(b: BookingDetail, ctx: { siteUrl: string; conditions: string[] }): Email {
  const permitUrl = `${ctx.siteUrl}/permit/${b.reference}?t=${encodeURIComponent(b.accessToken)}`;
  const pairs = bookingPairs(b);
  const conditions = ctx.conditions.length
    ? `<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:18px;margin:28px 0 8px;">Before you fish</h2>
<ul style="padding-left:18px;margin:0;">${ctx.conditions.map((c) => `<li style="margin:0 0 8px;">${esc(c)}</li>`).join("")}</ul>`
    : "";
  return {
    subject: `Your fishing permit — ${formatDate(b.fishingDate, "short")} · ${b.reference}`,
    html: layout({
      siteUrl: ctx.siteUrl,
      preheader: `Payment received. Your permit for ${b.water.name} on ${formatDate(b.fishingDate)} is attached.`,
      title: "You're booked. Tight lines.",
      body: `<p style="margin:0 0 12px;">Thank you, ${esc(b.contact.firstName)}. We've received your payment of <strong>${esc(formatMoney(b.totalPence))}</strong> and your permit is confirmed.</p>
<p style="margin:0;">Your digital permit is attached as a PDF, and you can open it on your phone at any time. Each angler's permit has its own QR code for club officials to scan.</p>
${button(permitUrl, "View your permit")}
${rows(pairs)}
${conditions}
<p style="margin:28px 0 0;font-size:13px;color:${C.muted};">Need to change or cancel? Reply to this email or use the contact page, quoting ${esc(b.reference)}. Please remember to complete a catch return after your day — even a blank one.</p>`,
    }),
    text: `You're booked. Tight lines.\n\nThank you, ${b.contact.firstName}. We've received your payment of ${formatMoney(b.totalPence)} and your permit is confirmed.\n\n${textPairs(pairs)}\n\nView your permit: ${permitUrl}\n\n${ctx.conditions.map((c) => `- ${c}`).join("\n")}\n\nPlease complete a catch return after your day: ${ctx.siteUrl}/catch-returns\n`,
  };
}

export function paymentReceiptEmail(b: BookingDetail, ctx: { siteUrl: string }): Email {
  const pairs: [string, string][] = [
    ["Booking reference", b.reference],
    ["Description", `${b.permitType.name} — ${b.water.name}${b.beat.name !== b.water.name ? `, ${b.beat.name}` : ""}`],
    ["Quantity", String(b.quantity)],
    ["Unit price", formatMoney(b.unitPricePence)],
  ];
  if (b.boatFeePence) pairs.push(["Boat hire", formatMoney(b.boatFeePence)]);
  pairs.push(["Amount paid", formatMoney(b.totalPence)], ["Paid", b.paidAt ? new Date(b.paidAt).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "—"]);
  return {
    subject: `Payment receipt — ${b.reference}`,
    html: layout({
      siteUrl: ctx.siteUrl,
      preheader: `Receipt for ${formatMoney(b.totalPence)}`,
      title: "Payment receipt",
      body: `<p style="margin:0;">This is your receipt for your Crieff Angling Club booking. Card payments are processed securely by Stripe; the club never sees your card details.</p>${rows(pairs)}`,
    }),
    text: `Payment receipt\n\n${textPairs(pairs)}\n`,
  };
}

export function cancellationEmail(b: BookingDetail, ctx: { siteUrl: string }): Email {
  return {
    subject: `Booking cancelled — ${b.reference}`,
    html: layout({
      siteUrl: ctx.siteUrl,
      preheader: `Your booking for ${formatDate(b.fishingDate)} has been cancelled.`,
      title: "Your booking has been cancelled",
      body: `<p style="margin:0 0 12px;">Hello ${esc(b.contact.firstName)}, your booking <strong>${esc(b.reference)}</strong> for ${esc(b.water.name)} on ${esc(formatDate(b.fishingDate, "full"))} has been cancelled. The permit${b.quantity > 1 ? "s are" : " is"} no longer valid.</p>
${b.cancellationReason && !b.cancellationReason.startsWith("checkout") ? `<p style="margin:0 0 12px;"><strong>Reason:</strong> ${esc(b.cancellationReason)}</p>` : ""}
<p style="margin:0;">If a refund is due you'll receive a separate confirmation when it has been processed. If you didn't expect this, please get in touch.</p>
${button(`${ctx.siteUrl}/contact`, "Contact the club")}`,
    }),
    text: `Your booking ${b.reference} for ${b.water.name} on ${formatDate(b.fishingDate, "full")} has been cancelled. The permit is no longer valid.\n\nContact: ${ctx.siteUrl}/contact\n`,
  };
}

export function refundEmail(b: BookingDetail, ctx: { siteUrl: string }): Email {
  const full = b.amountRefundedPence >= b.totalPence;
  return {
    subject: `Refund ${full ? "processed" : "issued"} — ${b.reference}`,
    html: layout({
      siteUrl: ctx.siteUrl,
      preheader: `${formatMoney(b.amountRefundedPence)} refunded`,
      title: full ? "Your refund has been processed" : "A partial refund has been issued",
      body: `<p style="margin:0 0 12px;">Hello ${esc(b.contact.firstName)}, we've refunded <strong>${esc(formatMoney(b.amountRefundedPence))}</strong> of ${esc(formatMoney(b.totalPence))} for booking ${esc(b.reference)}.</p>
<p style="margin:0;">Refunds go back to the card you paid with and usually appear within 5–10 working days, depending on your bank.${full ? " The permit for this booking is no longer valid." : ""}</p>`,
    }),
    text: `We've refunded ${formatMoney(b.amountRefundedPence)} of ${formatMoney(b.totalPence)} for booking ${b.reference}. Refunds usually appear within 5-10 working days.\n`,
  };
}

export function adminNewBookingEmail(b: BookingDetail, ctx: { siteUrl: string }): Email {
  const pairs: [string, string][] = [
    ...bookingPairs(b),
    ["Customer", `${b.contact.firstName} ${b.contact.lastName}`],
    ["Email", b.contact.email],
    ["Phone", b.contact.phone],
    ["Source", b.source],
  ];
  return {
    subject: `New booking: ${b.beat.name}, ${formatDate(b.fishingDate, "short")} (${b.quantity}) — ${b.reference}`,
    html: layout({
      siteUrl: ctx.siteUrl,
      preheader: `${b.contact.firstName} ${b.contact.lastName} booked ${b.quantity} × ${b.permitType.name}`,
      title: "New booking",
      body: `${rows(pairs)}${button(`${ctx.siteUrl}/admin/bookings/${b.id}`, "Open in admin")}`,
    }),
    text: `New booking\n\n${textPairs(pairs)}\n\n${ctx.siteUrl}/admin/bookings/${b.id}\n`,
  };
}

export function adminAlertEmail(subject: string, message: string, ctx: { siteUrl: string }): Email {
  return {
    subject: `[Action needed] ${subject}`,
    html: layout({ siteUrl: ctx.siteUrl, preheader: message, title: subject, body: `<p style="margin:0;">${esc(message)}</p>${button(`${ctx.siteUrl}/admin/bookings?attention=1`, "Review in admin")}` }),
    text: `${subject}\n\n${message}\n`,
  };
}

export function membershipOfferEmail(a: { firstName: string; typeName: string; totalPence: number; payUrl: string }, ctx: { siteUrl: string }): Email {
  return {
    subject: "A place in Crieff Angling Club is available",
    html: layout({
      siteUrl: ctx.siteUrl,
      preheader: "Your membership application has been approved.",
      title: "Welcome — your place is ready",
      body: `<p style="margin:0 0 12px;">Hello ${esc(a.firstName)}, the committee has approved your application for <strong>${esc(a.typeName)}</strong>.</p>
<p style="margin:0;">To take up your place, pay ${esc(formatMoney(a.totalPence))} online using the secure link below.</p>${button(a.payUrl, "Pay and join")}`,
    }),
    text: `The committee has approved your application for ${a.typeName}. Pay ${formatMoney(a.totalPence)} to take up your place: ${a.payUrl}\n`,
  };
}

export function membershipApplicationReceivedEmail(a: { firstName: string; typeName: string; reference: string }, ctx: { siteUrl: string }): Email {
  return {
    subject: `Membership application received — ${a.reference}`,
    html: layout({
      siteUrl: ctx.siteUrl,
      preheader: "Thank you for applying.",
      title: "Thank you for applying",
      body: `<p style="margin:0 0 12px;">Hello ${esc(a.firstName)}, we've received your application for <strong>${esc(a.typeName)}</strong> (reference ${esc(a.reference)}).</p>
<p style="margin:0;">Applications are held by the Secretary until there is room on the membership list. When a place is available we'll email you a link to confirm and pay.</p>`,
    }),
    text: `We've received your application for ${a.typeName} (ref ${a.reference}). We'll email you when a place is available.\n`,
  };
}

export function membershipConfirmedEmail(m: { firstName: string; typeName: string; membershipNumber: string; expiresOn: string; totalPence: number }, ctx: { siteUrl: string }): Email {
  const pairs: [string, string][] = [
    ["Membership", m.typeName],
    ["Membership number", m.membershipNumber],
    ["Valid until", formatDate(m.expiresOn, "full")],
    ["Paid", formatMoney(m.totalPence)],
  ];
  return {
    subject: `Welcome to Crieff Angling Club — ${m.membershipNumber}`,
    html: layout({
      siteUrl: ctx.siteUrl,
      preheader: "Your membership is active.",
      title: "Your membership is active",
      body: `<p style="margin:0;">Hello ${esc(m.firstName)}, thank you — your payment has been received and your membership is now active.</p>${rows(pairs)}${button(`${ctx.siteUrl}/account`, "Go to your account")}`,
    }),
    text: `Your membership is active.\n\n${textPairs(pairs)}\n`,
  };
}

export function contactNotificationEmail(m: { name: string; email: string; phone: string; subject: string; message: string }, ctx: { siteUrl: string }): Email {
  return {
    subject: `Website enquiry: ${m.subject}`,
    html: layout({
      siteUrl: ctx.siteUrl,
      preheader: m.message.slice(0, 100),
      title: m.subject,
      body: `${rows([["From", m.name], ["Email", m.email], ["Phone", m.phone || "—"]])}<p style="white-space:pre-wrap;margin:0;">${esc(m.message)}</p>`,
    }),
    text: `From: ${m.name} <${m.email}> ${m.phone}\n\n${m.message}\n`,
  };
}
