import type { Sql } from "../db";
import { clubToday, type IsoDate } from "../dates";
import { safeEqual } from "../ids";

export interface PermitRow {
  id: string;
  permitNumber: string;
  verificationCode: string;
  anglerFirstName: string;
  anglerLastName: string;
}

export interface BookingDetail {
  id: string;
  reference: string;
  accessToken: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "refunded";
  source: string;
  fishingDate: IsoDate;
  quantity: number;
  unitPricePence: number;
  boatFeePence: number;
  totalPence: number;
  amountRefundedPence: number;
  holdExpiresAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  refundedAt: string | null;
  createdAt: string;
  adminNotes: string | null;
  needsAttention: string | null;
  capacityOverride: boolean;
  confirmationSentAt: string | null;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    town: string;
    postcode: string;
  };
  customerId: string;
  water: { id: string; name: string; slug: string; kind: string };
  beat: { id: string; name: string; slug: string };
  permitType: { id: string; name: string; conditions: string | null; isJunior: boolean; requiresBoat: boolean };
  priceLabel: string | null;
  boat: { name: string } | null;
  permits: PermitRow[];
  payment: {
    status: string;
    method: string;
    stripePaymentIntentId: string | null;
    stripeCheckoutSessionId: string | null;
    failureMessage: string | null;
  } | null;
}

export async function loadBooking(db: Sql, where: { id?: string; reference?: string }): Promise<BookingDetail | null> {
  const rows = where.id
    ? await db`select b.*, w.name as water_name, w.slug as water_slug, w.kind as water_kind, bt.name as beat_name, bt.slug as beat_slug,
                 p.name as permit_name, p.conditions, p.is_junior, p.requires_boat, pp.label as price_label
               from public.bookings b
               join public.waters w on w.id = b.water_id join public.beats bt on bt.id = b.beat_id
               join public.permit_types p on p.id = b.permit_type_id left join public.permit_prices pp on pp.id = b.permit_price_id
               where b.id = ${where.id}`
    : await db`select b.*, w.name as water_name, w.slug as water_slug, w.kind as water_kind, bt.name as beat_name, bt.slug as beat_slug,
                 p.name as permit_name, p.conditions, p.is_junior, p.requires_boat, pp.label as price_label
               from public.bookings b
               join public.waters w on w.id = b.water_id join public.beats bt on bt.id = b.beat_id
               join public.permit_types p on p.id = b.permit_type_id left join public.permit_prices pp on pp.id = b.permit_price_id
               where b.reference = ${where.reference ?? ""}`;
  const b = rows[0];
  if (!b) return null;
  const [permits, payments, boats] = await Promise.all([
    db`select id, permit_number, verification_code, angler_first_name, angler_last_name from public.permits where booking_id = ${b.id} order by permit_number`,
    db`select * from public.payments where booking_id = ${b.id} order by created_at desc limit 1`,
    db`select bt.name from public.boat_bookings bb join public.boats bt on bt.id = bb.boat_id where bb.booking_id = ${b.id} order by bb.created_at desc limit 1`,
  ]);
  const p = payments[0];
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: b.id,
    reference: b.reference,
    accessToken: b.access_token,
    status: b.status,
    source: b.source,
    fishingDate: b.fishing_date,
    quantity: b.quantity,
    unitPricePence: b.unit_price_pence,
    boatFeePence: b.boat_fee_pence,
    totalPence: b.total_pence,
    amountRefundedPence: b.amount_refunded_pence,
    holdExpiresAt: iso(b.hold_expires_at),
    paidAt: iso(b.paid_at),
    cancelledAt: iso(b.cancelled_at),
    cancellationReason: b.cancellation_reason,
    refundedAt: iso(b.refunded_at),
    createdAt: iso(b.created_at)!,
    adminNotes: b.admin_notes,
    needsAttention: b.needs_attention,
    capacityOverride: b.capacity_override,
    confirmationSentAt: iso(b.confirmation_sent_at),
    contact: b.contact,
    customerId: b.customer_id,
    water: { id: b.water_id, name: b.water_name, slug: b.water_slug, kind: b.water_kind },
    beat: { id: b.beat_id, name: b.beat_name, slug: b.beat_slug },
    permitType: { id: b.permit_type_id, name: b.permit_name, conditions: b.conditions, isJunior: b.is_junior, requiresBoat: b.requires_boat },
    priceLabel: b.price_label,
    boat: boats[0] ? { name: boats[0].name } : null,
    permits: permits.map((r) => ({
      id: r.id,
      permitNumber: r.permit_number,
      verificationCode: r.verification_code,
      anglerFirstName: r.angler_first_name,
      anglerLastName: r.angler_last_name,
    })),
    payment: p
      ? {
          status: p.status,
          method: p.method,
          stripePaymentIntentId: p.stripe_payment_intent_id,
          stripeCheckoutSessionId: p.stripe_checkout_session_id,
          failureMessage: p.failure_message,
        }
      : null,
  };
}

/** Customer access: the booking reference AND its secret token must match. */
export async function loadBookingForCustomer(db: Sql, reference: string, token: string | null | undefined): Promise<BookingDetail | null> {
  if (!token || !/^CAC-[A-Z0-9]{6}$/.test(reference)) return null;
  const b = await loadBooking(db, { reference });
  if (!b || !safeEqual(b.accessToken, token)) return null;
  return b;
}

export type VerificationResult =
  | "valid"
  | "valid_other_day"
  | "expired"
  | "cancelled"
  | "refunded"
  | "unpaid"
  | "not_found";

export interface Verification {
  result: VerificationResult;
  permitId: string | null;
  permitNumber: string | null;
  /** Public view shows initial + surname only; staff see the full name. */
  anglerName: string | null;
  fishingDate: IsoDate | null;
  waterName: string | null;
  beatName: string | null;
  permitTypeName: string | null;
  bookingReference: string | null;
  boatName: string | null;
}

export async function verifyPermit(db: Sql, code: string, opts: { staff: boolean; today?: IsoDate }): Promise<Verification> {
  const clean = code.trim().toUpperCase();
  const empty: Verification = {
    result: "not_found",
    permitId: null,
    permitNumber: null,
    anglerName: null,
    fishingDate: null,
    waterName: null,
    beatName: null,
    permitTypeName: null,
    bookingReference: null,
    boatName: null,
  };
  if (!/^[A-Z0-9]{10,32}$/.test(clean)) return empty;
  const [row] = await db`
    select pm.id, pm.permit_number, pm.angler_first_name, pm.angler_last_name,
           b.status, b.fishing_date, b.reference, w.name as water_name, bt.name as beat_name, p.name as permit_name,
           (select boat.name from public.boat_bookings bb join public.boats boat on boat.id = bb.boat_id
             where bb.booking_id = b.id and bb.released_at is null limit 1) as boat_name
    from public.permits pm
    join public.bookings b on b.id = pm.booking_id
    join public.waters w on w.id = b.water_id
    join public.beats bt on bt.id = b.beat_id
    join public.permit_types p on p.id = b.permit_type_id
    where pm.verification_code = ${clean}`;
  if (!row) return empty;
  const today = opts.today ?? clubToday();
  let result: VerificationResult;
  if (row.status === "cancelled" || row.status === "failed") result = "cancelled";
  else if (row.status === "refunded") result = "refunded";
  else if (row.status === "pending") result = "unpaid";
  else if (row.fishing_date === today) result = "valid";
  else if (row.fishing_date < today) result = "expired";
  else result = "valid_other_day";
  return {
    result,
    permitId: row.id,
    permitNumber: row.permit_number,
    anglerName: opts.staff ? `${row.angler_first_name} ${row.angler_last_name}` : `${row.angler_first_name.charAt(0)}. ${row.angler_last_name}`,
    fishingDate: row.fishing_date,
    waterName: row.water_name,
    beatName: row.beat_name,
    permitTypeName: row.permit_name,
    bookingReference: opts.staff ? row.reference : null,
    boatName: row.boat_name,
  };
}
