import "server-only";
import { sql } from "../db";
import { eachDay, type IsoDate } from "../dates";
import { loadBookingConfig, loadUsage } from "../booking/config";
import { blockFor, capacityFor, evaluate, key } from "../booking/engine";

export type AdminDayState = "open" | "booked" | "full" | "blocked" | "closed";

export interface AdminBeatDay {
  beatId: string;
  beatName: string;
  waterName: string;
  capacity: number;
  booked: number;
  state: AdminDayState;
  note: string | null;
  boatsTaken: number | null;
  boatsTotal: number | null;
}

/** Per-beat state for each day, from the admin's point of view (no booking-window rules). */
export async function adminCalendar(start: IsoDate, end: IsoDate) {
  const [cfg, usage] = await Promise.all([loadBookingConfig(sql, { overridesFrom: start, overridesTo: end }), loadUsage(sql, start, end)]);
  const beats = cfg.beats
    .slice()
    .sort((a, b) => (cfg.waters.find((w) => w.id === a.waterId)?.sortOrder ?? 0) - (cfg.waters.find((w) => w.id === b.waterId)?.sortOrder ?? 0) || a.sortOrder - b.sortOrder);
  const days = eachDay(start, end).map((date) => ({
    date,
    beats: beats.map((beat): AdminBeatDay => {
      const capacity = capacityFor(cfg, beat, date);
      const booked = usage.beatDay.get(key.beatDay(beat.id, date)) ?? 0;
      const block = blockFor(cfg, beat, date);
      const permits = cfg.permitTypes.filter((p) => p.isActive && p.waterId === beat.waterId && (p.beatIds.length === 0 || p.beatIds.includes(beat.id)));
      const inSeason = permits.some((p) => {
        const r = evaluate(cfg, usage, p, beat, date, { ignoreBookingWindow: true }).reason;
        return r === null || r === "full" || r === "no_boats" || r === "blocked";
      });
      const boats = cfg.boats.filter((b) => b.isActive && b.waterId === beat.waterId);
      const hasBoats = permits.some((p) => p.requiresBoat) && boats.length > 0;
      let state: AdminDayState = "open";
      if (block.blocked) state = "blocked";
      else if (!inSeason) state = "closed";
      else if (booked >= capacity) state = "full";
      else if (booked > 0) state = "booked";
      return {
        beatId: beat.id,
        beatName: beat.name,
        waterName: cfg.waters.find((w) => w.id === beat.waterId)?.name ?? "",
        capacity,
        booked,
        state,
        note: block.note,
        boatsTaken: hasBoats ? (usage.boatsTaken.get(date)?.size ?? 0) : null,
        boatsTotal: hasBoats ? boats.length : null,
      };
    }),
  }));
  return { beats, days, cfg };
}
