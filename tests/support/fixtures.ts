import { addDays, clubToday, monthDay, weekday } from "@/lib/dates";
import type { CheckoutInput } from "@/lib/validation";
import type { Sql } from "@/lib/db";

/** First date after today matching the predicate (within the booking window). */
export function nextDate(pred: (d: string) => boolean, from = addDays(clubToday(), 2)): string {
  for (let d = from, i = 0; i < 400; i++, d = addDays(d, 1)) if (pred(d)) return d;
  throw new Error("no matching date");
}

export const isTroutWeekday = (d: string) => {
  const { month } = monthDay(d);
  return month >= 4 && month <= 9 && weekday(d) >= 1 && weekday(d) <= 5;
};

export async function ids(sql: Sql) {
  const rows = await sql`select slug, id from public.beats union all select slug, id from public.permit_types union all select 'water-' || slug, id from public.waters`;
  return Object.fromEntries(rows.map((r) => [r.slug, r.id as string])) as Record<string, string>;
}

export async function requiredRuleIds(sql: Sql) {
  return (await sql`select id from public.rules where requires_acknowledgement`).map((r) => r.id as string);
}

export function checkoutInput(over: Partial<CheckoutInput> & Pick<CheckoutInput, "date" | "beatId" | "permitTypeId">, ack: string[] = []): CheckoutInput {
  const quantity = over.quantity ?? 1;
  return {
    quantity,
    anglers: Array.from({ length: quantity }, (_, i) => ({ firstName: "Angus", lastName: `Test${i}` })),
    contact: {
      firstName: "Angus",
      lastName: "McTest",
      email: `angus+${Math.random().toString(36).slice(2, 8)}@example.com`,
      phone: "07700 900123",
      addressLine1: "1 High Street",
      addressLine2: "",
      town: "Crieff",
      postcode: "PH7 3AA",
    },
    acknowledgedRuleIds: ack,
    juniorConfirmed: false,
    website: "",
    ...over,
  };
}

export function fakeNotifier() {
  const calls: { type: string; id: string }[] = [];
  return {
    calls,
    bookingConfirmed: async (id: string) => void calls.push({ type: "confirmed", id }),
    bookingCancelled: async (id: string) => void calls.push({ type: "cancelled", id }),
    bookingRefunded: async (id: string) => void calls.push({ type: "refunded", id }),
    membershipPaid: async (id: string) => void calls.push({ type: "membership", id }),
    needsAttention: async (subject: string) => void calls.push({ type: "attention", id: subject }),
  };
}

/** Minimal Stripe stand-in: records calls, returns realistic shapes. */
export function fakeStripe(opts: { failCreate?: boolean } = {}) {
  const sessions: Record<string, unknown>[] = [];
  const refunds: Record<string, unknown>[] = [];
  const stripe = {
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          if (opts.failCreate) throw new Error("Stripe is down");
          const id = `cs_test_${sessions.length + 1}_${Math.random().toString(36).slice(2, 8)}`;
          sessions.push({ id, ...params });
          return { id, url: `https://checkout.stripe.test/${id}` };
        },
        expire: async (id: string) => ({ id, status: "expired" }),
      },
    },
    refunds: {
      create: async (params: Record<string, unknown>) => {
        refunds.push(params);
        return { id: `re_${refunds.length}`, status: "succeeded", ...params };
      },
    },
  };
  return { stripe: stripe as never, sessions, refunds };
}
