import { describe, expect, it } from "vitest";
import { addDays, clubNow, inRecurringRange, isIsoDate, nextOccurrence, weekday } from "@/lib/dates";
import { calendar, capacityFor, dayOptions, emptyUsage, evaluate, key, priceFor, rulesForBooking } from "@/lib/booking/engine";
import type { BookingConfig, PermitTypeCfg } from "@/lib/booking/types";
import { membershipExpiry } from "@/lib/membership/service";

const W_RIVER = "w-river";
const W_LOCH = "w-loch";

function cfg(): BookingConfig {
  const salmon: PermitTypeCfg = {
    id: "p-salmon", slug: "salmon", name: "Salmon", description: null, waterId: W_RIVER, seasonId: "s-salmon",
    isJunior: false, minAge: null, maxAge: null, maxPerBooking: 4, dailyLimit: null, requiresBoat: false,
    conditions: null, isActive: true, sortOrder: 1, beatIds: [], speciesIds: ["sp-salmon"], speciesNames: ["Salmon"],
  };
  const grayling: PermitTypeCfg = { ...salmon, id: "p-grayling", slug: "grayling", seasonId: "s-grayling", beatIds: ["b-dc"], speciesIds: ["sp-grayling"] };
  const loch: PermitTypeCfg = { ...salmon, id: "p-loch", slug: "loch", waterId: W_LOCH, seasonId: null, requiresBoat: true, maxPerBooking: 3 };
  return {
    waters: [
      { id: W_RIVER, slug: "river-earn", name: "River Earn", kind: "river", bookingEnabled: true, isPublished: true, sortOrder: 1 },
      { id: W_LOCH, slug: "drummond-loch", name: "Drummond Loch", kind: "loch", bookingEnabled: true, isPublished: true, sortOrder: 2 },
    ],
    beats: [
      { id: "b-us", waterId: W_RIVER, slug: "upper-strowan", name: "Upper Strowan", dailyCapacity: 4, bookingEnabled: true, isPublished: true, sortOrder: 1 },
      { id: "b-dc", waterId: W_RIVER, slug: "drummond-castle", name: "Drummond Castle", dailyCapacity: 4, bookingEnabled: true, isPublished: true, sortOrder: 2 },
      { id: "b-loch", waterId: W_LOCH, slug: "drummond-loch", name: "Drummond Loch", dailyCapacity: 9, bookingEnabled: true, isPublished: true, sortOrder: 1 },
    ],
    permitTypes: [salmon, grayling, loch],
    prices: [
      { id: "pr-1", permitTypeId: "p-salmon", label: "Spring", startMonth: 2, startDay: 1, endMonth: 7, endDay: 31, pricePence: 2500, closedWeekdays: [0], saleEnabled: true },
      { id: "pr-2", permitTypeId: "p-salmon", label: "Autumn", startMonth: 8, startDay: 1, endMonth: 9, endDay: 30, pricePence: 3000, closedWeekdays: [0], saleEnabled: true },
      { id: "pr-3", permitTypeId: "p-salmon", label: "October", startMonth: 10, startDay: 1, endMonth: 10, endDay: 15, pricePence: 3000, closedWeekdays: [0, 6], saleEnabled: true },
      { id: "pr-4", permitTypeId: "p-grayling", label: "Winter", startMonth: 11, startDay: 15, endMonth: 1, endDay: 15, pricePence: 700, closedWeekdays: [], saleEnabled: true },
      { id: "pr-5", permitTypeId: "p-loch", label: "Loch", startMonth: 3, startDay: 15, endMonth: 10, endDay: 6, pricePence: 1000, closedWeekdays: [], saleEnabled: true },
    ],
    seasons: [
      { id: "s-salmon", name: "Salmon", startMonth: 2, startDay: 1, endMonth: 10, endDay: 31, closedWeekdays: [0] },
      { id: "s-grayling", name: "Grayling", startMonth: 11, startDay: 15, endMonth: 1, endDay: 15, closedWeekdays: [] },
    ],
    overrides: [],
    boats: [
      { id: "boat-1", waterId: W_LOCH, name: "Boat 1", capacityAnglers: 3, hirePricePence: 0, isActive: true, sortOrder: 1 },
      { id: "boat-2", waterId: W_LOCH, name: "Boat 2", capacityAnglers: 3, hirePricePence: 0, isActive: true, sortOrder: 2 },
    ],
    settings: { holdMinutes: 30, maxDaysAhead: 365, sameDayCutoffHour: 20 },
  };
}

// Evaluate as if "now" is 1 Jan 2027 at 09:00 UK time.
const NOW = new Date("2027-01-01T09:00:00Z");
const at = (c: BookingConfig, permitId: string, beatId: string, date: string, usage = emptyUsage()) =>
  evaluate(c, usage, c.permitTypes.find((p) => p.id === permitId)!, c.beats.find((b) => b.id === beatId)!, date, { now: NOW });

describe("dates", () => {
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2027-02-28")).toBe(true);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("27-02-01")).toBe(false);
  });

  it("handles ranges that wrap the year end", () => {
    const g = { startMonth: 11, startDay: 15, endMonth: 1, endDay: 15 };
    expect(inRecurringRange("2026-11-14", g)).toBe(false);
    expect(inRecurringRange("2026-11-15", g)).toBe(true);
    expect(inRecurringRange("2026-12-31", g)).toBe(true);
    expect(inRecurringRange("2027-01-15", g)).toBe(true);
    expect(inRecurringRange("2027-01-16", g)).toBe(false);
  });

  it("uses UK local date across midnight UTC in summer", () => {
    // 23:30 UTC on 30 June is 00:30 BST on 1 July
    expect(clubNow(new Date("2027-06-30T23:30:00Z")).date).toBe("2027-07-01");
  });

  it("computes next occurrences including 29 Feb", () => {
    expect(nextOccurrence("2027-03-01", 2, 29)).toBe("2028-02-29");
    expect(nextOccurrence("2027-01-01", 12, 31)).toBe("2027-12-31");
  });

  it("gives memberships at least 60 days", () => {
    expect(membershipExpiry("2026-12-10", 12, 31)).toBe("2027-12-31");
    expect(membershipExpiry("2026-03-10", 12, 31)).toBe("2026-12-31");
  });
});

describe("pricing and seasons", () => {
  it("sells salmon permits at the right price for each period", () => {
    const c = cfg();
    expect(at(c, "p-salmon", "b-us", "2027-03-02").price?.pricePence).toBe(2500);
    expect(at(c, "p-salmon", "b-us", "2027-08-03").price?.pricePence).toBe(3000);
  });

  it("never sells salmon permits on Sundays", () => {
    const c = cfg();
    const sunday = "2027-03-07";
    expect(weekday(sunday)).toBe(0);
    const a = at(c, "p-salmon", "b-us", sunday);
    expect(a.sellable).toBe(false);
    expect(a.reason).toBe("closed_weekday");
  });

  it("blocks October Saturdays and has no day permits after 15 October", () => {
    const c = cfg();
    expect(at(c, "p-salmon", "b-us", "2027-10-09").reason).toBe("closed_weekday"); // Saturday
    expect(at(c, "p-salmon", "b-us", "2027-10-08").sellable).toBe(true); // Friday
    expect(at(c, "p-salmon", "b-us", "2027-10-18").reason).toBe("no_price"); // members-only fortnight
  });

  it("is out of season in winter", () => {
    expect(at(cfg(), "p-salmon", "b-us", "2027-01-12").reason).toBe("out_of_season");
  });

  it("restricts grayling to Drummond Castle and wraps the new year", () => {
    const c = cfg();
    const start = new Date("2026-11-01T09:00:00Z");
    const g = (beat: string, date: string) =>
      evaluate(c, emptyUsage(), c.permitTypes[1], c.beats.find((b) => b.id === beat)!, date, { now: start });
    expect(g("b-dc", "2026-12-28").sellable).toBe(true);
    expect(g("b-dc", "2027-01-10").sellable).toBe(true);
    expect(g("b-us", "2026-12-28").reason).toBe("not_on_beat");
  });

  it("prefers the most specific overlapping price period", () => {
    const c = cfg();
    c.prices.push({ id: "pr-x", permitTypeId: "p-salmon", label: "Festival", startMonth: 3, startDay: 1, endMonth: 3, endDay: 3, pricePence: 100, closedWeekdays: [], saleEnabled: true });
    expect(priceFor(c, c.permitTypes[0], "2027-03-02").price?.id).toBe("pr-x");
  });
});

describe("booking window", () => {
  it("rejects past dates and dates too far ahead", () => {
    const c = cfg();
    expect(at(c, "p-loch", "b-loch", "2026-12-31").reason).toBe("past");
    c.settings.maxDaysAhead = 30;
    expect(at(c, "p-loch", "b-loch", "2027-04-01").reason).toBe("too_far_ahead");
  });

  it("closes same-day booking after the cut-off hour", () => {
    const c = cfg();
    const late = new Date("2027-05-04T20:30:00Z"); // 21:30 BST
    const a = evaluate(c, emptyUsage(), c.permitTypes[2], c.beats[2], "2027-05-04", { now: late });
    expect(a.reason).toBe("same_day_closed");
    const early = new Date("2027-05-04T08:00:00Z");
    expect(evaluate(c, emptyUsage(), c.permitTypes[2], c.beats[2], "2027-05-04", { now: early }).sellable).toBe(true);
  });
});

describe("capacity", () => {
  it("counts remaining permits and reports full", () => {
    const c = cfg();
    const u = emptyUsage();
    u.beatDay.set(key.beatDay("b-us", "2027-03-02"), 2);
    let a = at(c, "p-salmon", "b-us", "2027-03-02", u);
    expect([a.capacity, a.booked, a.remaining, a.maxQuantity]).toEqual([4, 2, 2, 2]);
    u.beatDay.set(key.beatDay("b-us", "2027-03-02"), 4);
    a = at(c, "p-salmon", "b-us", "2027-03-02", u);
    expect(a.sellable).toBe(false);
    expect(a.reason).toBe("full");
  });

  it("applies blocks at club, water and beat level", () => {
    const c = cfg();
    const base = { id: "o", permitTypeId: null, isBlocked: true, capacity: null, publicNote: "Competition day", createdAt: "2026-01-01T00:00:00Z" };
    c.overrides = [{ ...base, waterId: null, beatId: "b-dc", startDate: "2027-03-01", endDate: "2027-03-03" }];
    expect(at(c, "p-salmon", "b-dc", "2027-03-02").reason).toBe("blocked");
    expect(at(c, "p-salmon", "b-dc", "2027-03-02").message).toBe("Competition day");
    expect(at(c, "p-salmon", "b-us", "2027-03-02").sellable).toBe(true);
    c.overrides = [{ ...base, waterId: W_RIVER, beatId: null, startDate: "2027-03-02", endDate: "2027-03-02" }];
    expect(at(c, "p-salmon", "b-us", "2027-03-02").reason).toBe("blocked");
    expect(at(c, "p-loch", "b-loch", "2027-04-06").sellable).toBe(true);
    c.overrides = [{ ...base, waterId: null, beatId: null, startDate: "2027-04-06", endDate: "2027-04-06" }];
    expect(at(c, "p-loch", "b-loch", "2027-04-06").reason).toBe("blocked");
  });

  it("uses the most specific capacity override", () => {
    const c = cfg();
    const beat = c.beats[0];
    const base = { permitTypeId: null, isBlocked: false, publicNote: null, startDate: "2027-03-01", endDate: "2027-03-31" };
    c.overrides = [
      { ...base, id: "club", waterId: null, beatId: null, capacity: 10, createdAt: "2026-01-03T00:00:00Z" },
      { ...base, id: "beat", waterId: null, beatId: "b-us", capacity: 2, createdAt: "2026-01-01T00:00:00Z" },
    ];
    expect(capacityFor(c, beat, "2027-03-02")).toBe(2);
    expect(capacityFor(c, c.beats[1], "2027-03-02")).toBe(10);
    expect(capacityFor(c, beat, "2027-04-02")).toBe(4);
  });

  it("allocates loch permits by free boats", () => {
    const c = cfg();
    const u = emptyUsage();
    u.boatsTaken.set("2027-05-04", new Set(["boat-1"]));
    let a = at(c, "p-loch", "b-loch", "2027-05-04", u);
    expect(a.boatsFree).toBe(1);
    expect(a.maxQuantity).toBe(3);
    u.boatsTaken.set("2027-05-04", new Set(["boat-1", "boat-2"]));
    a = at(c, "p-loch", "b-loch", "2027-05-04", u);
    expect(a.reason).toBe("no_boats");
  });
});

describe("calendar and day options", () => {
  it("summarises days for the date picker", () => {
    const c = cfg();
    const u = emptyUsage();
    u.beatDay.set(key.beatDay("b-us", "2027-03-03"), 4);
    u.beatDay.set(key.beatDay("b-us", "2027-03-04"), 3);
    const days = calendar(c, u, "2027-03-01", "2027-03-07", { beatId: "b-us" }, { now: NOW });
    const by = Object.fromEntries(days.map((d) => [d.date, d.status]));
    expect(by["2027-03-02"]).toBe("available");
    expect(by["2027-03-03"]).toBe("full");
    expect(by["2027-03-04"]).toBe("limited");
    expect(by["2027-03-07"]).toBe("closed"); // Sunday
  });

  it("lists options water → beat → permit for a date", () => {
    const tree = dayOptions(cfg(), emptyUsage(), "2027-05-04", { now: NOW });
    expect(tree.map((w) => w.water.slug)).toEqual(["river-earn", "drummond-loch"]);
    const river = tree[0];
    expect(river.beats.find((b) => b.beat.id === "b-dc")!.permits.map((p) => p.permit.id)).toEqual(["p-salmon", "p-grayling"]);
    expect(river.beats.find((b) => b.beat.id === "b-us")!.permits.map((p) => p.permit.id)).toEqual(["p-salmon"]);
  });

  it("surfaces only relevant rules at booking", () => {
    const rules = [
      { id: "general", category: "general", waterId: null, beatId: null, speciesId: null, showAtBooking: true, requiresAcknowledgement: true },
      { id: "loch", category: "drummond_loch", waterId: W_LOCH, beatId: null, speciesId: null, showAtBooking: true, requiresAcknowledgement: true },
      { id: "grayling", category: "grayling", waterId: W_RIVER, beatId: "b-dc", speciesId: "sp-grayling", showAtBooking: true, requiresAcknowledgement: true },
      { id: "boat", category: "boat", waterId: W_LOCH, beatId: null, speciesId: null, showAtBooking: true, requiresAcknowledgement: false },
      { id: "hidden", category: "general", waterId: null, beatId: null, speciesId: null, showAtBooking: false, requiresAcknowledgement: false },
    ];
    const salmonUs = rulesForBooking(rules, { waterId: W_RIVER, beatId: "b-us", speciesIds: ["sp-salmon"], requiresBoat: false });
    expect(salmonUs.map((r) => r.id)).toEqual(["general"]);
    const graylingDc = rulesForBooking(rules, { waterId: W_RIVER, beatId: "b-dc", speciesIds: ["sp-grayling"], requiresBoat: false });
    expect(graylingDc.map((r) => r.id)).toEqual(["general", "grayling"]);
    const loch = rulesForBooking(rules, { waterId: W_LOCH, beatId: "b-loch", speciesIds: [], requiresBoat: true });
    expect(loch.map((r) => r.id)).toEqual(["general", "loch", "boat"]);
  });

  it("addDays is DST-safe", () => {
    expect(addDays("2027-03-27", 1)).toBe("2027-03-28");
    expect(addDays("2027-03-28", 1)).toBe("2027-03-29");
  });
});
