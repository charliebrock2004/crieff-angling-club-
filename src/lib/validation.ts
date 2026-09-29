import { z } from "zod";
import { isIsoDate } from "./dates";

const trimmed = (max: number) => z.string().trim().max(max);
const required = (label: string, max = 80) => trimmed(max).min(1, `${label} is required`);

export const isoDate = z.string().refine(isIsoDate, "Enter a valid date");
export const uuid = z.string().uuid();

// UK postcode (lenient on spacing); also allows BFPO / overseas via "other" field if needed later.
const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;
export const postcode = z
  .string()
  .trim()
  .max(12)
  .refine((v) => UK_POSTCODE.test(v) || /^[A-Z0-9 -]{3,12}$/i.test(v), "Enter a valid postcode")
  .transform((v) => {
    const m = v.match(UK_POSTCODE);
    return m ? `${m[1]} ${m[2]}`.toUpperCase() : v.toUpperCase();
  });

export const phone = z
  .string()
  .trim()
  .max(40)
  .refine((v) => /^[+()\d\s-]{7,20}$/.test(v), "Enter a valid phone number");

export const email = z.string().trim().toLowerCase().max(254).email("Enter a valid email address");

export const contactSchema = z.object({
  firstName: required("First name"),
  lastName: required("Surname"),
  email,
  phone,
  addressLine1: required("Address", 120),
  addressLine2: trimmed(120).optional().default(""),
  town: required("Town", 80),
  postcode,
});
export type ContactInput = z.infer<typeof contactSchema>;

export const anglerSchema = z.object({
  firstName: required("Angler first name"),
  lastName: required("Angler surname"),
});

export const checkoutSchema = z
  .object({
    date: isoDate,
    beatId: uuid,
    permitTypeId: uuid,
    quantity: z.coerce.number().int().min(1).max(20),
    anglers: z.array(anglerSchema).min(1).max(20),
    contact: contactSchema,
    acknowledgedRuleIds: z.array(uuid).max(100).default([]),
    juniorConfirmed: z.boolean().default(false),
    // Honeypot: must be empty. Bots tend to fill every field.
    website: z.string().max(0).optional().default(""),
  })
  .refine((v) => v.anglers.length === v.quantity, { message: "Enter a name for each angler", path: ["anglers"] });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const catchReturnSchema = z.object({
  anglerName: required("Name", 160),
  email,
  fishingDate: isoDate,
  waterId: uuid,
  beatId: uuid.optional().or(z.literal("").transform(() => undefined)),
  hoursFished: z
    .union([z.literal(""), z.coerce.number().min(0).max(24)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  isBlank: z.boolean().default(false),
  permitReference: trimmed(20).optional().default(""),
  notes: trimmed(2000).optional().default(""),
  items: z
    .array(
      z.object({
        speciesId: uuid,
        quantity: z.coerce.number().int().min(1).max(200),
        weightLb: z.union([z.literal(""), z.coerce.number().min(0).max(100)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
        lengthIn: z.union([z.literal(""), z.coerce.number().min(0).max(70)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
        method: trimmed(80).optional().default(""),
        released: z.boolean().default(true),
      }),
    )
    .max(30)
    .default([]),
  website: z.string().max(0).optional().default(""),
});
export type CatchReturnInput = z.infer<typeof catchReturnSchema>;

export const contactMessageSchema = z.object({
  name: required("Name", 120),
  email,
  phone: z.union([z.literal(""), phone]).optional().default(""),
  subject: required("Subject", 160),
  message: required("Message", 5000),
  website: z.string().max(0).optional().default(""),
});

export const membershipApplicationSchema = z.object({
  membershipTypeId: uuid,
  firstName: required("First name"),
  lastName: required("Surname"),
  email,
  phone,
  addressLine1: required("Address", 120),
  addressLine2: trimmed(120).optional().default(""),
  town: required("Town", 80),
  postcode,
  dateOfBirth: z.union([z.literal(""), isoDate]).optional().default(""),
  isRenewal: z.boolean().default(false),
  statement: trimmed(2000).optional().default(""),
  website: z.string().max(0).optional().default(""),
});

/** Flatten zod errors to { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = issue.path.join(".");
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}
