import "server-only";
import { cache } from "react";
import { sql } from "./db";

export interface PermitOutlet {
  name: string;
  phone: string | null;
  notes: string | null;
}

export interface SiteSettings {
  clubName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  permitOutlets: PermitOutlet[];
  facebookUrl: string | null;
  waterLevelUrl: string | null;
  announcement: string | null;
  adminNotificationEmail: string | null;
}

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await sql`select key, value from public.settings`;
  const v = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
  const str = (k: string) => {
    const x = v(k);
    return typeof x === "string" && x.trim() ? x.trim() : null;
  };
  return {
    clubName: str("club_name") ?? "Crieff Angling Club",
    contactEmail: str("contact_email"),
    contactPhone: str("contact_phone"),
    contactAddress: str("contact_address"),
    permitOutlets: Array.isArray(v("permit_outlets")) ? (v("permit_outlets") as PermitOutlet[]) : [],
    facebookUrl: str("facebook_url"),
    waterLevelUrl: str("water_level_url"),
    announcement: str("announcement"),
    adminNotificationEmail: str("admin_notification_email"),
  };
});
