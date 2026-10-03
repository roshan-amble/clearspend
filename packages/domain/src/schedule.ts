import { DomainError } from "./errors.js";
import type { TripForAi } from "./ai.js";

/**
 * Investigation scheduling (Roshan, 2026-10-01: "propose, person books"). Pure: given the investigators, their busy
 * days, and an investigation, it lists the earliest feasible trips. A person confirms 1 option with an Action, and
 * the Action checks the same rule again on the stored calendar, so a stale option cannot double-book anyone.
 *
 * Days are whole calendar days in ISO form (YYYY-MM-DD); busy blocks include both ends. A trip is travel out, days on
 * the ground, and travel back, and the whole trip must fit between busy blocks.
 */

export type Skill = "SUPPLIER_AUDIT" | "MARKET_SURVEY";

export interface Investigator {
  readonly investigatorId: string;
  readonly name: string;
  readonly homeCountryIso3: string;
  readonly hub: string;
  readonly kind: "LOCAL" | "REGIONAL";
  readonly skills: readonly string[];
  readonly scheduleVersion: number;
}

export interface BusyBlock {
  readonly investigatorId: string;
  readonly startDate: string;
  readonly endDate: string;
}

export interface Need {
  readonly countryIso3: string;
  /** The country's hub (CsCountry.hub). */
  readonly hub: string;
  readonly requiredSkill: Skill;
  readonly durationDays: number;
}

export interface TripOption {
  readonly investigatorId: string;
  readonly name: string;
  readonly mode: "LOCAL" | "FLY_IN";
  /** Days of travel each way: 0 in the home country, 1 inside the hub, 2 from another hub. */
  readonly travelDays: number;
  readonly departure: string;
  readonly onGroundStart: string;
  readonly onGroundEnd: string;
  readonly returnDate: string;
  readonly scheduleVersion: number;
}

const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function dayNumber(date: string): number {
  if (!ISO_DATE.test(date)) throw new DomainError("BAD_DATE", `Not a date like 2026-10-01: ${date}.`);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
}

export const dateOf = (day: number): string => new Date(day * DAY).toISOString().slice(0, 10);

export function travelDays(investigator: Investigator, need: Need): number {
  if (investigator.homeCountryIso3 === need.countryIso3) return 0;
  return investigator.hub === need.hub ? 1 : 2;
}

/** True when the trip [first, last] touches no busy day of the investigator. */
export function isFree(busy: readonly BusyBlock[], investigatorId: string, first: number, last: number): boolean {
  return busy.every((block) => block.investigatorId !== investigatorId || dayNumber(block.endDate) < first || dayNumber(block.startDate) > last);
}

/**
 * The earliest trip for each investigator who has the skill, sorted by the first day on the ground, then by less
 * travel. `horizonDays` bounds the search; an investigator with no free window inside it is left out.
 */
export function scheduleOptions(input: {
  readonly need: Need;
  readonly investigators: readonly Investigator[];
  readonly busy: readonly BusyBlock[];
  readonly today: string;
  readonly horizonDays?: number;
}): TripOption[] {
  const { need } = input;
  if (!Number.isSafeInteger(need.durationDays) || need.durationDays < 1) throw new DomainError("BAD_DURATION", "An investigation needs at least 1 day on the ground.");
  const start = dayNumber(input.today);
  const horizon = input.horizonDays ?? 120;
  const options: TripOption[] = [];
  for (const investigator of input.investigators) {
    if (!investigator.skills.includes(need.requiredSkill)) continue;
    const travel = travelDays(investigator, need);
    const length = travel + need.durationDays + travel;
    for (let departure = start; departure <= start + horizon; departure += 1) {
      const last = departure + length - 1;
      if (!isFree(input.busy, investigator.investigatorId, departure, last)) continue;
      options.push({
        investigatorId: investigator.investigatorId,
        name: investigator.name,
        mode: travel === 0 ? "LOCAL" : "FLY_IN",
        travelDays: travel,
        departure: dateOf(departure),
        onGroundStart: dateOf(departure + travel),
        onGroundEnd: dateOf(departure + travel + need.durationDays - 1),
        returnDate: dateOf(last),
        scheduleVersion: investigator.scheduleVersion,
      });
      break;
    }
  }
  return options.sort((a, b) => a.onGroundStart.localeCompare(b.onGroundStart) || a.travelDays - b.travelDays || a.investigatorId.localeCompare(b.investigatorId));
}

/**
 * The Action's check before it books: the investigator has the skill, and the whole trip around the requested first
 * day on the ground is still free. Throws with the reason; the caller turns it into a user-facing refusal.
 */
export function checkBooking(input: { readonly need: Need; readonly investigator: Investigator; readonly busy: readonly BusyBlock[]; readonly onGroundStart: string; readonly today: string }): TripOption {
  const { need, investigator } = input;
  if (!investigator.skills.includes(need.requiredSkill)) throw new DomainError("SKILL", `${investigator.name} does not do ${need.requiredSkill.replace("_", " ").toLowerCase()}.`);
  const travel = travelDays(investigator, need);
  const onGround = dayNumber(input.onGroundStart);
  const departure = onGround - travel;
  if (departure < dayNumber(input.today)) throw new DomainError("PAST", "The trip would have to start in the past.");
  const last = departure + travel + need.durationDays + travel - 1;
  if (!isFree(input.busy, investigator.investigatorId, departure, last)) {
    throw new DomainError("NOT_FREE", `${investigator.name} is no longer free from ${dateOf(departure)} to ${dateOf(last)}. Reload the options.`);
  }
  return {
    investigatorId: investigator.investigatorId,
    name: investigator.name,
    mode: travel === 0 ? "LOCAL" : "FLY_IN",
    travelDays: travel,
    departure: dateOf(departure),
    onGroundStart: dateOf(onGround),
    onGroundEnd: dateOf(onGround + need.durationDays - 1),
    returnDate: dateOf(last),
    scheduleVersion: investigator.scheduleVersion,
  };
}

/** Days on the ground and the skill for each kind of investigation. */
export const INVESTIGATION_KINDS: Readonly<Record<"SUPPLIER" | "MARKET", { readonly skill: Skill; readonly durationDays: number }>> = {
  SUPPLIER: { skill: "SUPPLIER_AUDIT", durationDays: 2 },
  MARKET: { skill: "MARKET_SURVEY", durationDays: 3 },
};

/**
 * P8: the facts the booking recommendation weighs for each free trip, calculated here so the model only reads them.
 * Busy days count the investigator's blocks inside the next 60 days; past investigations count bookings in the
 * country (SCHEDULED or DONE).
 */
export function tripsForAi(input: {
  readonly options: readonly TripOption[];
  readonly investigators: readonly { readonly investigatorId: string; readonly kind: string; readonly homeCountryIso3: string; readonly baseCity: string }[];
  readonly busy: readonly BusyBlock[];
  readonly investigations: readonly { readonly investigatorId: string | null; readonly countryIso3: string; readonly status: string }[];
  readonly countryIso3: string;
  readonly today: string;
}): TripForAi[] {
  const first = Math.min(...input.options.map((o) => dayNumber(o.onGroundStart)));
  const from = dayNumber(input.today);
  const to = from + 59;
  return input.options.map((option) => {
    const person = input.investigators.find((i) => i.investigatorId === option.investigatorId);
    const busyDays = input.busy
      .filter((b) => b.investigatorId === option.investigatorId)
      .reduce((total, b) => total + Math.max(0, Math.min(to, dayNumber(b.endDate)) - Math.max(from, dayNumber(b.startDate)) + 1), 0);
    return {
      investigatorId: option.investigatorId,
      name: option.name,
      kind: person?.kind ?? "LOCAL",
      homeCountryIso3: person?.homeCountryIso3 ?? "",
      baseCity: person?.baseCity ?? "",
      mode: option.mode,
      travelDays: option.travelDays,
      departure: option.departure,
      onGroundStart: option.onGroundStart,
      onGroundEnd: option.onGroundEnd,
      returnDate: option.returnDate,
      daysAfterEarliest: dayNumber(option.onGroundStart) - first,
      pastInvestigationsHere: input.investigations.filter((i) => i.investigatorId === option.investigatorId && i.countryIso3 === input.countryIso3 && (i.status === "SCHEDULED" || i.status === "DONE")).length,
      busyDaysNext60: busyDays,
    };
  });
}
