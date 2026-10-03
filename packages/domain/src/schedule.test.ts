import { describe, expect, it } from "vitest";
import { checkBooking, dateOf, dayNumber, scheduleOptions, tripsForAi, type BusyBlock, type Investigator, type Need, type TripOption } from "./schedule.js";

const need: Need = { countryIso3: "MDG", hub: "JNB", requiredSkill: "SUPPLIER_AUDIT", durationDays: 2 };
const person = (id: string, home: string, hub: string, skills = ["SUPPLIER_AUDIT"]): Investigator => ({
  investigatorId: id,
  name: id,
  homeCountryIso3: home,
  hub,
  kind: home === "MDG" ? "LOCAL" : "REGIONAL",
  skills,
  scheduleVersion: 0,
});

describe("scheduleOptions", () => {
  it("finds each investigator's earliest free trip and sorts by first day on the ground", () => {
    const busy: BusyBlock[] = [
      { investigatorId: "local", startDate: "2026-10-01", endDate: "2026-10-12" },
      { investigatorId: "jnb", startDate: "2026-10-03", endDate: "2026-10-04" },
    ];
    const options = scheduleOptions({
      need,
      investigators: [person("local", "MDG", "JNB"), person("jnb", "ZAF", "JNB"), person("nbo", "KEN", "NBO"), person("nope", "MOZ", "JNB", ["MARKET_SURVEY"])],
      busy,
      today: "2026-10-01",
    });
    expect(options.map((o) => [o.investigatorId, o.mode, o.travelDays, o.departure, o.onGroundStart, o.returnDate])).toEqual([
      // From another hub: 2 days out, 2 on the ground, 2 back; free from today.
      ["nbo", "FLY_IN", 2, "2026-10-01", "2026-10-03", "2026-10-06"],
      // Same hub, 1 day each way: a 4-day trip does not fit before the busy days on 10-03, so it starts 10-05.
      ["jnb", "FLY_IN", 1, "2026-10-05", "2026-10-06", "2026-10-08"],
      // Local: no travel, but busy until 10-12.
      ["local", "LOCAL", 0, "2026-10-13", "2026-10-13", "2026-10-14"],
    ]);
  });

  it("counts days in UTC without drift across months", () => {
    expect(dateOf(dayNumber("2026-10-31") + 1)).toBe("2026-11-01");
    expect(() => dayNumber("2026-10-1")).toThrow("Not a date");
  });
});

describe("checkBooking", () => {
  it("refuses a trip that overlaps a busy block, and books a free one", () => {
    const investigator = person("jnb", "ZAF", "JNB");
    const busy: BusyBlock[] = [{ investigatorId: "jnb", startDate: "2026-10-03", endDate: "2026-10-04" }];
    expect(() => checkBooking({ need, investigator, busy, onGroundStart: "2026-10-02", today: "2026-10-01" })).toThrow("no longer free");
    expect(checkBooking({ need, investigator, busy, onGroundStart: "2026-10-06", today: "2026-10-01" })).toMatchObject({ departure: "2026-10-05", returnDate: "2026-10-08" });
    expect(() => checkBooking({ need, investigator, busy, onGroundStart: "2026-10-01", today: "2026-10-01" })).toThrow("in the past");
    expect(() => checkBooking({ need: { ...need, requiredSkill: "MARKET_SURVEY" }, investigator, busy, onGroundStart: "2026-10-06", today: "2026-10-01" })).toThrow("does not do");
  });
});

describe("tripsForAi", () => {
  it("counts days after the earliest trip, busy days in the next 60 days, and past bookings in the country", () => {
    const trip = (investigatorId: string, onGroundStart: string): TripOption => ({ investigatorId, name: investigatorId, mode: "FLY_IN", travelDays: 1, departure: onGroundStart, onGroundStart, onGroundEnd: onGroundStart, returnDate: onGroundStart, scheduleVersion: 0 });
    const trips = tripsForAi({
      options: [trip("A", "2026-10-07"), trip("B", "2026-10-16")],
      investigators: [{ investigatorId: "B", kind: "LOCAL", homeCountryIso3: "MDG", baseCity: "Androy" }],
      // 2026-10-01 to 2026-10-15 is 15 days; the block in December is outside the 60 days.
      busy: [
        { investigatorId: "B", startDate: "2026-09-25", endDate: "2026-10-15" },
        { investigatorId: "B", startDate: "2026-12-20", endDate: "2026-12-24" },
      ],
      investigations: [
        { investigatorId: "B", countryIso3: "MDG", status: "DONE" },
        { investigatorId: "B", countryIso3: "MDG", status: "OPEN" },
        { investigatorId: "B", countryIso3: "KEN", status: "SCHEDULED" },
      ],
      countryIso3: "MDG",
      today: "2026-10-01",
    });
    expect(trips.map((t) => [t.investigatorId, t.daysAfterEarliest, t.busyDaysNext60, t.pastInvestigationsHere, t.baseCity])).toEqual([
      ["A", 0, 0, 0, ""],
      ["B", 9, 15, 1, "Androy"],
    ]);
  });
});
