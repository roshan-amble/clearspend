import { DomainError } from "./errors.js";
import { div, frac, mul, parseExactText, sub, type Fraction } from "./fraction.js";
import { COMPOSITION } from "./portfolio.js";

/**
 * The supplier list (Roshan, 2026-10-01, P8 and P9): for each supplier of 1 food, the quantity it could reasonably
 * supply and what that would cost against the price we compare with. Pure and exact.
 */

/** A supplier's own offer from the supplier site (CsSupplierBid). It counts only after a person accepts it. */
export interface SupplierBidInput {
  readonly bidId: string;
  readonly commodity: string;
  readonly businessName: string;
  readonly contact: string;
  readonly deliveryArea: string;
  /** USD cents per 1,000 base units: cents per kg, or per L for oil. */
  readonly priceCentsPer1000: number;
  /** Base units a month. */
  readonly quantityPerMonth: number;
  readonly earliestStart: string;
  readonly note: string | null;
  readonly status: "SUBMITTED" | "ACCEPTED" | "REJECTED";
  readonly submittedAt: string;
}

/** An accepted bid joins the supplier list as a lead with this logical ID. */
export const bidSupplierId = (bidId: string): string => `bid:${bidId}`;

/**
 * The price we compare with (P9): what we pay now when a supplier is paid; otherwise what importing costs (WFP's
 * import median); otherwise the local retail median. Cents for 1 base unit.
 */
export type Baseline =
  | { readonly kind: "PAID"; readonly centsPerUnit: Fraction; readonly supplierLogicalId: string }
  | { readonly kind: "IMPORT" | "LOCAL_MARKET"; readonly centsPerUnit: Fraction };

/** WFP medians are micro-dollars per kg (or L): 1 cent per g = 10,000,000 micro-dollars per kg. */
export const centsPerUnitFromMicros = (micros: string): Fraction => div(parseExactText(micros), frac(10_000_000n));

export function baselineOf(input: {
  readonly paid: { readonly centsPerUnit: Fraction; readonly supplierLogicalId: string } | null;
  readonly importMicros: string | null;
  readonly localMicros: string | null;
}): Baseline | null {
  if (input.paid !== null) return { kind: "PAID", ...input.paid };
  if (input.importMicros !== null) return { kind: "IMPORT", centsPerUnit: centsPerUnitFromMicros(input.importMicros) };
  if (input.localMicros !== null) return { kind: "LOCAL_MARKET", centsPerUnit: centsPerUnitFromMicros(input.localMicros) };
  return null;
}

/**
 * What 1 supplier could reasonably supply a month, on its own: its capacity, never more than our need, and for a
 * local supplier never more than the safe share of the local market. Null when its capacity is unknown.
 */
export function reasonableVolume(input: { readonly route: string; readonly capacityPerMonth: number | null; readonly needPerMonth: number; readonly safeLocalPerMonth: number | null }): number | null {
  if (input.capacityPerMonth === null) return null;
  let volume = Math.min(input.capacityPerMonth, input.needPerMonth);
  if (input.route === "LOCAL" && input.safeLocalPerMonth !== null) volume = Math.min(volume, input.safeLocalPerMonth);
  return Math.max(0, volume);
}

/** (price − baseline) × volume, in cents a month. Negative is a saving. */
export function netPerMonth(price: Fraction | null, baseline: Baseline | null, volume: number | null): Fraction | null {
  if (price === null || baseline === null || volume === null) return null;
  return mul(sub(price, baseline.centsPerUnit), frac(BigInt(volume)));
}

/** What a supplier sends from the supplier site, as typed: price in cents per kg (or L), quantity in kg (or L). */
export interface BidCommand {
  readonly countryIso3: string;
  readonly commodity: string;
  readonly businessName: string;
  readonly contact: string;
  readonly deliveryArea: string;
  readonly priceCentsPer1000: number;
  readonly quantityPerMonth: number;
  readonly earliestStart: string;
  readonly note: string | null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * P10: the checks on a supplier's offer, the same on the site and in the function. It returns the stored units.
 * The site shows the supplier nothing of ours: no market price, no other offer, no volume (P11).
 */
export function checkBid(command: BidCommand, today: string): { readonly sourceUnit: "kg" | "L"; readonly baseUnit: "g" | "ml"; readonly quantityPerMonthBase: number } {
  const text = (value: string, field: string, min: number, max: number) => {
    const length = value.trim().length;
    if (length < min || length > max) throw new DomainError("BAD_BID", `${field} must be ${min} to ${max} characters.`);
  };
  if (COMPOSITION[command.commodity] === undefined) throw new DomainError("BAD_BID", `${command.commodity} is not a food we buy.`);
  text(command.businessName, "The business name", 2, 120);
  text(command.contact, "The contact", 3, 120);
  text(command.deliveryArea, "The delivery area", 2, 120);
  if (command.note !== null) text(command.note, "The note", 0, 2_000);
  if (!Number.isSafeInteger(command.priceCentsPer1000) || command.priceCentsPer1000 < 1 || command.priceCentsPer1000 > 1_000_000) {
    throw new DomainError("BAD_BID", "The price must be between 0.01 and 10,000.00 US dollars.");
  }
  if (!Number.isSafeInteger(command.quantityPerMonth) || command.quantityPerMonth < 1 || command.quantityPerMonth > 10_000_000) {
    throw new DomainError("BAD_BID", "The monthly quantity must be a whole number from 1 to 10,000,000.");
  }
  if (!ISO_DAY.test(command.earliestStart) || command.earliestStart < today) throw new DomainError("BAD_BID", "The earliest start must be a date from today on.");
  const oil = command.commodity === "OIL";
  return { sourceUnit: oil ? "L" : "kg", baseUnit: oil ? "ml" : "g", quantityPerMonthBase: command.quantityPerMonth * 1000 };
}
