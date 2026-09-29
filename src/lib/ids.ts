import { randomBytes, randomInt, createHash } from "node:crypto";

// Crockford-style alphabet without easily confused characters (0/O, 1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Booking reference shown to customers, e.g. CAC-7K3M9P */
export function bookingReference(): string {
  return `CAC-${randomCode(6)}`;
}

export function membershipReference(): string {
  return `MEM-${randomCode(6)}`;
}

/** Unguessable code printed in permit QR codes (~70 bits). */
export function verificationCode(): string {
  return randomCode(14);
}

/** Secret token for customer links (256 bits). */
export function accessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashIp(ip: string | null | undefined, salt: string): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Constant-time string comparison for tokens. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
