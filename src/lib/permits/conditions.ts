import type { Sql } from "../db";
import { rulesForBooking } from "../booking/engine";
import type { BookingDetail } from "./data";

/** Rules shown at booking for this permit, as plain sentences for permits and emails. */
export async function conditionsForBooking(db: Sql, b: BookingDetail): Promise<string[]> {
  const [rules, species] = await Promise.all([
    db`select id, category, water_id, beat_id, species_id, show_at_booking, requires_acknowledgement, title, body
       from public.rules where is_published and show_at_booking order by category, sort_order`,
    db`select species_id from public.permit_type_species where permit_type_id = ${b.permitType.id}`,
  ]);
  const relevant = rulesForBooking(
    rules.map((r) => ({
      id: r.id as string,
      category: r.category as string,
      waterId: r.water_id,
      beatId: r.beat_id,
      speciesId: r.species_id,
      showAtBooking: r.show_at_booking,
      requiresAcknowledgement: r.requires_acknowledgement,
      body: r.body as string,
    })),
    { waterId: b.water.id, beatId: b.beat.id, speciesIds: species.map((s) => s.species_id), requiresBoat: b.permitType.requiresBoat },
  );
  const out = relevant.map((r) => r.body);
  if (b.permitType.conditions) out.unshift(...b.permitType.conditions.split(/\n+/).filter(Boolean));
  return Array.from(new Set(out));
}
