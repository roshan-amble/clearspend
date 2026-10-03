/**
 * Turns stored snapshot text into display text. It only rounds exact values that Foundry stored; it never computes
 * a new number (D2; brief section 7: round only at presentation). Pure, so the root test suite covers it.
 */
import { DEFAULT_PRESSURE_THRESHOLD, div, formatFixed, frac, mul, parseExactText, type Finding } from "@clearspend/domain";

export interface PerMealText {
  readonly nominal: string;
  readonly supplier: string;
  readonly route: string;
}

interface PerMealJson {
  readonly quantityPerMeal: number | null;
  readonly nominal?: string | null;
  readonly supplierLow?: string | null;
  readonly supplierHigh?: string | null;
  readonly routeLow?: string | null;
  readonly routeHigh?: string | null;
}

const cents = (exact: string | null | undefined): string | null =>
  exact === null || exact === undefined ? null : formatFixed(parseExactText(exact), 1);

/** "5.5" for a point, "5.5 to 5.7" for a range (C5), "Unknown" when no cost can be stated. Cents for 1 meal. */
function range(low: string | null | undefined, high: string | null | undefined): string {
  const a = cents(low);
  const b = cents(high);
  if (a === null || b === null) return "Unknown";
  return a === b ? a : `${a} to ${b}`;
}

export function perMealText(perMealJson: string | undefined): PerMealText | null {
  if (perMealJson === undefined) return null;
  const value = JSON.parse(perMealJson) as PerMealJson;
  if (value.quantityPerMeal === null) return null;
  return {
    nominal: cents(value.nominal) ?? "Unknown",
    supplier: range(value.supplierLow, value.supplierHigh),
    route: range(value.routeLow, value.routeHigh),
  };
}

interface MealsPerDollarJson {
  readonly nominal?: string | null;
  readonly supplierLow?: string | null;
  readonly supplierHigh?: string | null;
  readonly routeLow?: string | null;
  readonly routeHigh?: string | null;
  readonly quoted?: string | null;
}

/** The comparison of Screen A (brief section 5). Paid and quoted values stay apart (C7). */
export interface ComparisonText {
  /** Paid cost for 1 accepted meal, supplier view: "5.5 to 5.7", or null for a lead with no paid purchase. */
  readonly paidCents: string | null;
  readonly paidMealsPerDollar: string | null;
  /** A lead's quote for 1 meal. Never shown as a paid cost or a saving. */
  readonly quotedCents: string | null;
  readonly quotedMealsPerDollar: string | null;
}

export function comparisonText(perMealJson: string | undefined): ComparisonText | null {
  if (perMealJson === undefined) return null;
  const value = JSON.parse(perMealJson) as PerMealJson & { readonly quoted?: string | null; readonly mealsPerDollar?: MealsPerDollarJson };
  if (value.quantityPerMeal === null) return null;
  const known = (text: string): string | null => (text === "Unknown" ? null : text);
  const perDollar = value.mealsPerDollar;
  return {
    paidCents: known(range(value.supplierLow, value.supplierHigh)),
    paidMealsPerDollar: perDollar === undefined ? null : known(range(perDollar.supplierLow, perDollar.supplierHigh)),
    quotedCents: cents(value.quoted),
    quotedMealsPerDollar: perDollar === undefined ? null : cents(perDollar.quoted),
  };
}

/** An exact share such as "1/40" as a percent for display: "2.5%". Formatting only. */
export const percentText = (exact: string | null | undefined, decimals = 1): string =>
  exact === null || exact === undefined ? "Unknown" : `${formatFixed(mul(parseExactText(exact), frac(100n)), decimals)}%`;

export const THRESHOLD_TEXT = `${formatFixed(mul(DEFAULT_PRESSURE_THRESHOLD, frac(100n)), 0)}%`;

export interface MarketView {
  readonly commodity: string;
  readonly pressureShare: string;
  readonly pressureFlagged: boolean;
  readonly series: readonly {
    readonly series: string;
    readonly route: string;
    readonly firstMonth: string | null;
    readonly lastMonth: string;
    readonly change: string | null;
    readonly firstMedianMicros?: string | null;
    readonly lastMedianMicros?: string;
  }[];
}

export const marketViews = (marketIndicatorsJson: string | undefined): MarketView[] =>
  marketIndicatorsJson === undefined ? [] : (JSON.parse(marketIndicatorsJson) as MarketView[]);

/** D5 words for eligibility (C9). Only a passed field verification makes a supplier eligible. */
export const ELIGIBILITY_LABEL: Readonly<Record<string, string>> = {
  LEAD: "Lead, not verified",
  SELECTED_FOR_VISIT: "Selected for a field visit",
  VERIFIED_PASS: "Eligible: passed field verification",
  VERIFIED_FAIL: "Not eligible: failed field verification",
};

/** Capacity against the monthly need. A profile's claim is a claim; only a field visit confirms (brief section 4). */
export function capacityText(need: number | undefined, confirmed: number | undefined, claimed: number | undefined): string {
  if (need === undefined) return "Unknown";
  if (confirmed !== undefined) return confirmed >= need ? "Meets (confirmed on a visit)" : "Below the need (confirmed on a visit)";
  if (claimed !== undefined) return claimed >= need ? "Claims to meet" : "Claims less than the need";
  return "Unknown";
}

export interface PurchaseView {
  readonly orderLogicalId: string;
  readonly status: string;
  readonly findings: readonly Finding[];
}

export const purchaseViews = (purchasesJson: string | undefined): PurchaseView[] =>
  purchasesJson === undefined ? [] : (JSON.parse(purchasesJson) as PurchaseView[]);

export interface IncidentView {
  readonly incidentLogicalId: string;
  readonly versionId: string;
  readonly orderLogicalId: string;
  readonly status: "RULE_CLASSIFIED" | "UNCONFIRMED" | "AI_PROPOSED" | "CONFIRMED";
  readonly effectiveCause: string | null;
}

export const incidentViews = (incidentsJson: string | undefined): IncidentView[] =>
  incidentsJson === undefined ? [] : (JSON.parse(incidentsJson) as IncidentView[]);

/** D5 words for each cause status. "Unconfirmed" and "AI proposed" both keep the metric a range (C5). */
export const STATUS_LABEL: Readonly<Record<IncidentView["status"], string>> = {
  RULE_CLASSIFIED: "Rule-classified",
  UNCONFIRMED: "Unconfirmed",
  AI_PROPOSED: "AI proposed, not confirmed",
  CONFIRMED: "Confirmed by a person",
};

/** The external ID for display: "t1/harbor-erp:PO-A3" shows as "PO-A3". */
export const shortId = (logicalId: string): string => logicalId.slice(logicalId.lastIndexOf(":") + 1);

/**
 * An AI citation for display. A cost line ID "EXP-1@15:t2/harbor-erp:SUP-A:RICE" shows as "SUP-A RICE", the market
 * item "EXP-1@15:market" as "market", and an evidence ID "t2/harbor-erp:DEL-A4" as "DEL-A4".
 */
export function evidenceLabel(id: string): string {
  const parts = id.split(":");
  if (parts[0]?.includes("@") === true && parts.length >= 4) return `${parts.at(-2)} ${parts.at(-1)}`;
  return parts.at(-1) ?? id;
}

/**
 * A Foundry token's `sub` claim is the user's UUID as 16 bytes in base64. Actions and stored objects use the
 * 36-character UUID text, for example e42055e5-f00a-4868-a7db-62735eacf24f.
 */
export function userIdFromSub(sub: string): string {
  const bytes = atob(sub.replace(/-/g, "+").replace(/_/g, "/"));
  if (bytes.length !== 16) throw new Error("The sign-in token's user ID is not 16 bytes.");
  const hex = [...bytes].map((char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Formatting for the price screens (UI1). Each function rounds a stored exact value for display only.

/** "51" cents per 1,000 base units → "0.51" USD per kg or L. */
export const usdPerUnit = (centsPer1000: number): string => formatFixed(frac(BigInt(centsPer1000), 100n), 2);

/** "810000/1" micro-dollars → "0.81" USD. */
export const usdFromMicros = (exact: string): string => formatFixed(div(parseExactText(exact), frac(1_000_000n)), 2);

/** 440000 cents → "4,400.00". */
export const usdFromCents = (cents: number): string => {
  const [whole, fraction] = formatFixed(frac(BigInt(cents), 100n), 2).split(".");
  return `${Number(whole).toLocaleString("en-US")}.${fraction}`;
};

/** 10000000 base units (g or ml) → "10,000" kg or L. */
export const thousands = (base: number): string => Math.round(base / 1000).toLocaleString("en-US");

/**
 * The number a chart needs to place a stored exact value. Charts position marks with numbers; every label and
 * tooltip still shows the formatted exact value.
 */
export const plot = (exact: string | null | undefined, scale = 1): number | null =>
  exact === null || exact === undefined ? null : Number(formatFixed(mul(parseExactText(exact), frac(BigInt(scale))), 4));

/** "2026-09-30T23:14:50.888Z" → "09-30 23:14". */
export const shortTime = (iso: string | undefined): string => (iso === undefined ? "" : `${iso.slice(5, 10)} ${iso.slice(11, 16)}`);

/** "0.5" or "0.50" USD → 50 whole cents. Exact: no floating point. Null when it is not a price with at most 2 decimals. */
export function centsFromUsd(text: string): number | null {
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (match === null) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

// ---------------------------------------------------------------------------------------------------------------
// Formatting for the portfolio screens. Each rounds a stored or server-computed exact value for display only.

/** Exact cents text → "5.8" (cents, 1 decimal). */
export const centsText = (exact: string | null | undefined, decimals = 1): string => (exact === null || exact === undefined ? "—" : formatFixed(parseExactText(exact), decimals));

/** Exact cents text → "$12,345" (whole dollars). */
export const dollarsText = (exact: string | null | undefined): string => {
  if (exact === null || exact === undefined) return "—";
  return `$${Number(formatFixed(div(parseExactText(exact), frac(100n)), 0)).toLocaleString("en-US")}`;
};

/** Exact cents per base unit → "0.51" USD per kg or L. */
export const usdPerKgText = (exact: string | null | undefined): string => (exact === null || exact === undefined ? "—" : formatFixed(mul(parseExactText(exact), frac(10n)), 2));

/** Exact micro-dollars → "0.81" USD. */
export const usdMicrosText = (exact: string | null | undefined): string => (exact === null || exact === undefined ? "—" : formatFixed(div(parseExactText(exact), frac(1_000_000n)), 2));

/** An exact share (1 = 100%) → "37%". */
export const shareText = (exact: string | null | undefined, decimals = 0): string => (exact === null || exact === undefined ? "—" : `${formatFixed(mul(parseExactText(exact), frac(100n)), decimals)}%`);

/** 1234567 → "1.2M", 45000 → "45k": for headline counts only. */
export const compact = (value: number): string => (value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 10_000 ? `${Math.round(value / 1000)}k` : value.toLocaleString("en-US"));

/** Exact cents text → "$1.23" (dollars and cents). */
export const dollarsCents = (exact: string | null | undefined): string => {
  if (exact === null || exact === undefined) return "—";
  const [whole, fraction] = formatFixed(div(parseExactText(exact), frac(100n)), 2).split(".");
  return `$${Number(whole).toLocaleString("en-US")}.${fraction}`;
};

/** Exact cents of a net cost → "−$1,234" (a saving) or "+$1,234" (costs more), whole dollars. */
export const netDollarsText = (exact: string | null | undefined): string => {
  if (exact === null || exact === undefined) return "—";
  const dollars = Number(formatFixed(div(parseExactText(exact), frac(100n)), 0));
  if (dollars === 0) return "$0";
  return `${dollars < 0 ? "−" : "+"}$${Math.abs(dollars).toLocaleString("en-US")}`;
};
