import { add, compare, div, exactText, formatFixed, frac, mul, parseExactText, type Fraction } from "./fraction.js";

/**
 * The sourcing workflow (Roshan, 2026-10-02, P13): each food of a program moves through the stages of a procurement
 * process. The recommended steps of a program (P17, P18) come from it and from the rules. Pure: it reads the country
 * view's own figures.
 *
 * Stages: find suppliers → compare offers → verify on the ground → decide → deliver.
 */

export const STAGES = ["FIND_SUPPLIERS", "COMPARE_OFFERS", "BEING_VERIFIED", "READY_TO_DECIDE", "DELIVERING"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_NAME: Readonly<Record<Stage, string>> = {
  FIND_SUPPLIERS: "Find suppliers",
  COMPARE_OFFERS: "Compare offers",
  BEING_VERIFIED: "Being verified",
  READY_TO_DECIDE: "Ready to decide",
  DELIVERING: "Delivering",
};

/** A cheaper candidate is worth a row on the worklist from 10% below what we pay (the CHEAPER_LEAD rule). */
const WORTH_CHECKING = frac(9n, 10n);

export interface StepSupplier {
  readonly supplierLogicalId: string;
  readonly name: string;
  readonly role: string;
  readonly eligibility: string;
  /** LOCAL or IMPORT (international). */
  readonly route?: string;
  readonly price: string | null;
  readonly netPerMonth: string | null;
}
export interface StepInvestigation {
  readonly investigationId: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly commodity: string;
  readonly status: string;
  readonly onGroundStart: string | null;
}
export interface StepInput {
  readonly commodity: string;
  readonly foodName: string;
  readonly suppliers: readonly StepSupplier[];
  readonly baselineCentsPerUnit: string | null;
  /**
   * Cents a month: the cheapest-first plan (local up to the 10% line, then international offers) against the compared
   * price (the baseline). Negative is a saving.
   */
  readonly planNet: string | null;
  /** Base units a month: the need, and what the 10% rule lets us buy locally (null when the market is unknown). */
  readonly needPerMonth?: number;
  readonly safeLocalPerMonth?: number | null;
  /** What the net costs compare with: PAID (what we pay now), IMPORT, or LOCAL_MARKET. */
  readonly baselineKind: string | null;
  readonly investigations: readonly StepInvestigation[];
}

export type NextKind = "SURVEY" | "COMPARE" | "BOOK" | "WAIT" | "DECIDE" | "NONE";
export interface FoodStep {
  readonly commodity: string;
  readonly stage: Stage;
  readonly stageName: string;
  /** For a food that is delivered: a candidate at least 10% cheaper, and how far its own check has got. */
  readonly alternative: { readonly stage: Stage; readonly supplierLogicalId: string; readonly name: string; readonly netPerMonth: string } | null;
  readonly candidates: number;
  /** 1 plain line: the best option on record. */
  readonly bestOption: string;
  /** Cents a month between the best option and the alternative, for ordering the worklist. */
  readonly atStake: string | null;
  readonly next: { readonly kind: NextKind; readonly label: string; readonly investigationId: string | null };
  /**
   * P16: the supplier to check next, chosen by code: the biggest saving on record that is neither verified nor under
   * investigation. Null when nobody on record would save money.
   */
  readonly check: Check | null;
  /** P20: the next supplier to check on each route, so a person can look at local and international offers apart. */
  readonly checks: { readonly LOCAL: Check | null; readonly IMPORT: Check | null };
  /** P20: the volume the 10% rule keeps out of the local market, base units a month; 0 when local can cover the need. */
  readonly beyondLocalPerMonth: number;
  /** The need, base units a month, when it is known. */
  readonly needPerMonth?: number;
}

export interface Check {
  readonly supplierLogicalId: string;
  readonly name: string;
  readonly role: string;
  readonly route: string;
  readonly netPerMonth: string;
  readonly reason: string;
}

/** Whole kg (or L) of base units: "451,960". */
export const kgText = (base: number): string => Math.round(base / 1000).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const ACTIVE = new Set(["OPEN", "SCHEDULED"]);
const short = (logicalId: string): string => logicalId.slice(logicalId.lastIndexOf(":") + 1);
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Whole US dollars of an amount in cents, without its sign: "$5,780". */
export function usdWhole(cents: Fraction): string {
  const positive = cents.num < 0n ? mul(cents, frac(-1n)) : cents;
  return `$${formatFixed(div(positive, frac(100n)), 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function foodStep(input: StepInput): FoodStep {
  const current = input.suppliers.filter((s) => s.role === "CURRENT");
  const candidates = input.suppliers.filter((s) => s.role !== "CURRENT");
  const active = input.investigations.filter((i) => ACTIVE.has(i.status) && i.commodity === input.commodity);
  const open = active.find((i) => i.status === "OPEN") ?? null;
  const scheduled = active.find((i) => i.status === "SCHEDULED") ?? null;
  const candidateStage: Stage = candidates.some((s) => s.eligibility === "VERIFIED_PASS")
    ? "READY_TO_DECIDE"
    : active.length > 0
      ? "BEING_VERIFIED"
      : candidates.length > 0
        ? "COMPARE_OFFERS"
        : "FIND_SUPPLIERS";
  const nextOf = (stage: Stage, compareLabel: string): FoodStep["next"] => {
    if (stage === "READY_TO_DECIDE") return { kind: "DECIDE", label: "Record the decision", investigationId: null };
    if (stage === "BEING_VERIFIED") {
      if (open !== null) return { kind: "BOOK", label: "Book investigator", investigationId: open.investigationId };
      return { kind: "WAIT", label: `On the ground ${scheduled?.onGroundStart ?? "soon"}`, investigationId: scheduled?.investigationId ?? null };
    }
    if (stage === "COMPARE_OFFERS") return { kind: "COMPARE", label: compareLabel, investigationId: null };
    return { kind: "SURVEY", label: "Survey the market", investigationId: null };
  };

  // The next supplier to check: the biggest saving that nobody has verified or is verifying, overall and on each route.
  const visiting = new Set(active.filter((i) => i.subjectType === "SUPPLIER").map((i) => i.subjectId));
  const checkOf = (route: string | null): Check | null => {
    const best = candidates
      .filter((s) => (route === null || (s.route ?? "LOCAL") === route) && s.netPerMonth !== null && parseExactText(s.netPerMonth).num < 0n && s.eligibility !== "VERIFIED_PASS" && s.eligibility !== "VERIFIED_FAIL" && !visiting.has(s.supplierLogicalId))
      .sort((a, b) => compare(parseExactText(a.netPerMonth as string), parseExactText(b.netPerMonth as string)) || a.supplierLogicalId.localeCompare(b.supplierLogicalId))[0];
    if (best === undefined) return null;
    const international = (best.route ?? "LOCAL") === "IMPORT";
    return {
      supplierLogicalId: best.supplierLogicalId,
      name: best.name,
      role: best.role,
      route: best.route ?? "LOCAL",
      netPerMonth: best.netPerMonth as string,
      reason: `the biggest ${route === null ? "" : international ? "international " : "local "}saving on record (${usdWhole(parseExactText(best.netPerMonth as string))} a month); its ${international ? "price, delivery terms, and capacity are" : "price and capacity are"} not checked on the ground`,
    };
  };
  const check = checkOf(null);
  const checks = { LOCAL: checkOf("LOCAL"), IMPORT: checkOf("IMPORT") };
  const beyondLocalPerMonth = input.needPerMonth !== undefined && input.safeLocalPerMonth !== undefined && input.safeLocalPerMonth !== null ? Math.max(0, input.needPerMonth - input.safeLocalPerMonth) : 0;

  if (current.length === 0) {
    const net = input.planNet === null ? null : parseExactText(input.planNet);
    const against = input.baselineKind === "IMPORT" ? "WFP's import price" : "the local retail price";
    const bestOption =
      candidates.length === 0
        ? "no supplier or offer yet"
        : net === null
          ? `${candidates.length} offer${candidates.length === 1 ? "" : "s"}, no price to compare with`
          : net.num < 0n
            ? `the cheapest offers save ${usdWhole(net)} a month against ${against}`
            : net.num > 0n
              ? `the cheapest offers cost ${usdWhole(net)} a month more than ${against}`
              : `the cheapest offers cost the same as ${against}`;
    return { commodity: input.commodity, stage: candidateStage, stageName: STAGE_NAME[candidateStage], alternative: null, candidates: candidates.length, bestOption, atStake: input.planNet, next: nextOf(candidateStage, "Compare offers"), check, checks, beyondLocalPerMonth, ...(input.needPerMonth === undefined ? {} : { needPerMonth: input.needPerMonth }) };
  }

  // Delivered already: the pipeline starts again only for a candidate at least 10% below what we pay.
  const baseline = input.baselineCentsPerUnit === null ? null : parseExactText(input.baselineCentsPerUnit);
  const cheaper = candidates
    .filter((s) => s.price !== null && s.netPerMonth !== null && baseline !== null && compare(parseExactText(s.price), mul(baseline, WORTH_CHECKING)) <= 0)
    .sort((a, b) => compare(parseExactText(a.netPerMonth as string), parseExactText(b.netPerMonth as string)) || a.supplierLogicalId.localeCompare(b.supplierLogicalId))[0];
  if (cheaper === undefined) {
    return { commodity: input.commodity, stage: "DELIVERING", stageName: STAGE_NAME.DELIVERING, alternative: null, candidates: candidates.length, bestOption: "no cheaper option on record", atStake: null, next: { kind: "NONE", label: "", investigationId: null }, check, checks, beyondLocalPerMonth, ...(input.needPerMonth === undefined ? {} : { needPerMonth: input.needPerMonth }) };
  }
  const label = cheaper.role === "BID" ? cheaper.name : short(cheaper.supplierLogicalId);
  return {
    commodity: input.commodity,
    stage: "DELIVERING",
    stageName: STAGE_NAME.DELIVERING,
    alternative: { stage: candidateStage, supplierLogicalId: cheaper.supplierLogicalId, name: cheaper.name, netPerMonth: cheaper.netPerMonth as string },
    candidates: candidates.length,
    bestOption: `${label} would save ${usdWhole(parseExactText(cheaper.netPerMonth as string))} a month`,
    atStake: cheaper.netPerMonth,
    next: nextOf(candidateStage, `Compare with ${label}`),
    check,
    checks,
    beyondLocalPerMonth,
    ...(input.needPerMonth === undefined ? {} : { needPerMonth: input.needPerMonth }),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The recommended steps of 1 program (P17, P18): found by rules, with exact numbers, in 3 groups. The AI analysis
// orders and explains them; it cannot add one.

export const STEP_GROUPS = ["COST", "MEALS", "SUPPLIERS"] as const;
export type StepGroup = (typeof STEP_GROUPS)[number];
export const STEP_GROUP_NAME: Readonly<Record<StepGroup, string>> = { COST: "Cut cost", MEALS: "Serve more and better meals", SUPPLIERS: "Supplier problems" };

export type StepLink =
  | { readonly type: "SUPPLIERS"; readonly commodity: string; readonly supplierLogicalId: string | null }
  | { readonly type: "INGREDIENTS" }
  | { readonly type: "INCIDENTS" }
  | { readonly type: "INVESTIGATIONS"; readonly investigationId: string };

export interface Step {
  readonly id: string;
  readonly group: StepGroup;
  readonly title: string;
  readonly detail: string;
  /** Cents a month at stake, when the step is about money; it orders the steps of a group. */
  readonly amountPerMonth: string | null;
  readonly action: string;
  readonly link: StepLink;
}

const magnitude = (cents: string | null): Fraction => {
  if (cents === null) return frac(0n);
  const value = parseExactText(cents);
  return value.num < 0n ? mul(value, frac(-1n)) : value;
};

export function countrySteps(input: {
  readonly steps: readonly FoodStep[];
  readonly foodNames: Readonly<Record<string, string>>;
  readonly offersToReview: number;
  readonly investigations: readonly StepInvestigation[];
  /** The average cost of 1 ration, cents, exact text; null when it is unknown. */
  readonly costPerRation: string | null;
  readonly recommendations: readonly { readonly id: string; readonly kind: string; readonly severity: string; readonly title: string; readonly detail: string; readonly action: { readonly type: string; readonly commodity?: string } }[];
}): Step[] {
  const food = (commodity: string) => capital(input.foodNames[commodity] ?? commodity.toLowerCase());
  const out: Step[] = [];
  const who = (check: NonNullable<FoodStep["check"]>) => (check.role === "BID" ? check.name : short(check.supplierLogicalId));

  for (const step of input.steps) {
    const suppliers = (supplierLogicalId: string | null): StepLink => ({ type: "SUPPLIERS", commodity: step.commodity, supplierLogicalId });
    if (step.stage === "READY_TO_DECIDE" || step.alternative?.stage === "READY_TO_DECIDE") {
      out.push({ id: `DECIDE:${step.commodity}`, group: "COST", title: `${food(step.commodity)}: a visit passed, record the decision`, detail: step.bestOption, amountPerMonth: step.atStake, action: "Open", link: suppliers(null) });
    } else if (step.stage === "DELIVERING" && step.check !== null) {
      out.push({ id: `CHEAPER:${step.commodity}`, group: "COST", title: `${food(step.commodity)}: check ${who(step.check)} (${step.check.route === "IMPORT" ? "international" : "local"}), it would save ${usdWhole(parseExactText(step.check.netPerMonth))} a month`, detail: "A quote, not checked on the ground yet: its price and capacity need a visit.", amountPerMonth: step.check.netPerMonth, action: "Open", link: suppliers(step.check.supplierLogicalId) });
    } else if ((step.stage === "COMPARE_OFFERS" || step.stage === "FIND_SUPPLIERS") && step.beyondLocalPerMonth > 0) {
      // P20: the 10% rule keeps most of this food out of the local market, so it needs international suppliers too.
      const beyond = kgText(step.beyondLocalPerMonth);
      const local = step.checks.LOCAL;
      const international = step.checks.IMPORT;
      if (local !== null) {
        out.push({ id: `SOURCE_LOCAL:${step.commodity}`, group: "MEALS", title: `${food(step.commodity)}: choose local suppliers within the 10% rule, check ${who(local)} first`, detail: `Up to ${kgText((step.needPerMonth ?? 0) - step.beyondLocalPerMonth)} kg a month can be bought locally without pushing local prices up.`, amountPerMonth: local.netPerMonth, action: "Open", link: suppliers(local.supplierLogicalId) });
      }
      out.push({
        id: `SOURCE_IMPORT:${step.commodity}`,
        group: "MEALS",
        title: international === null ? `${food(step.commodity)}: find an international supplier for ${beyond} kg a month` : `${food(step.commodity)}: choose an international supplier for ${beyond} kg a month, check ${who(international)} first`,
        detail: `The 10% rule keeps ${beyond} kg a month out of the local market${international === null ? ", and no international offer is on record" : ""}. No supplier yet: ${step.bestOption}, local and international together.`,
        amountPerMonth: international?.netPerMonth ?? step.atStake,
        action: "Open",
        link: suppliers(international?.supplierLogicalId ?? null),
      });
    } else if (step.stage === "COMPARE_OFFERS" || step.stage === "FIND_SUPPLIERS") {
      // Nothing is served until this food has a supplier.
      out.push({
        id: `SOURCE:${step.commodity}`,
        group: "MEALS",
        title: step.check === null ? `${food(step.commodity)}: choose a supplier` : `${food(step.commodity)}: choose a supplier, check ${who(step.check)} first`,
        detail: `No supplier yet, so nothing is delivered: ${step.bestOption}.`,
        amountPerMonth: step.atStake,
        action: "Open",
        link: suppliers(step.check?.supplierLogicalId ?? null),
      });
    }
  }
  if (input.offersToReview > 0) {
    out.push({ id: "OFFERS", group: "COST", title: `${input.offersToReview} supplier offer${input.offersToReview === 1 ? "" : "s"} to review`, detail: "From the supplier site. An offer counts only after a person accepts it.", amountPerMonth: null, action: "Review", link: { type: "SUPPLIERS", commodity: "", supplierLogicalId: null } });
  }
  for (const investigation of input.investigations.filter((i) => i.status === "OPEN")) {
    const subject = investigation.subjectType === "MARKET" ? `${food(investigation.commodity)} market survey` : `Visit to ${short(investigation.subjectId)} for ${food(investigation.commodity).toLowerCase()}`;
    out.push({ id: `BOOK:${investigation.investigationId}`, group: "COST", title: `${subject}: book an investigator`, detail: "Tagged, not booked yet.", amountPerMonth: null, action: "Book", link: { type: "INVESTIGATIONS", investigationId: investigation.investigationId } });
  }
  for (const r of input.recommendations) {
    const commodity = r.action.commodity;
    if (r.kind === "PRICE_ABOVE_MARKET" && commodity !== undefined && !out.some((s) => s.link.type === "SUPPLIERS" && s.link.commodity === commodity)) {
      out.push({ id: r.id, group: "COST", title: r.title, detail: r.detail, amountPerMonth: null, action: "Open", link: { type: "SUPPLIERS", commodity, supplierLogicalId: null } });
    } else if (r.kind === "UNCONFIRMED_FAILURE" || r.kind === "SUPPLIER_FAILURES") {
      out.push({ id: r.id, group: "SUPPLIERS", title: r.title, detail: r.detail, amountPerMonth: null, action: "Review", link: { type: "INCIDENTS" } });
    } else if (r.kind === "SINGLE_SUPPLIER" && commodity !== undefined) {
      out.push({ id: r.id, group: "SUPPLIERS", title: r.title, detail: r.detail, amountPerMonth: null, action: "Open", link: { type: "SUPPLIERS", commodity, supplierLogicalId: null } });
    } else if (r.kind === "NUTRITION_GAP" && r.severity !== "LOW") {
      out.push({ id: r.id, group: "MEALS", title: r.title, detail: r.detail, amountPerMonth: null, action: "Open", link: { type: "INGREDIENTS" } });
    }
  }
  // What the savings on record would buy: the same money, as rations.
  const saving = out.filter((s) => s.id.startsWith("CHEAPER:")).reduce((total, s) => add(total, magnitude(s.amountPerMonth)), frac(0n));
  if (saving.num > 0n && input.costPerRation !== null) {
    const perRation = parseExactText(input.costPerRation);
    if (perRation.num > 0n) {
      const rations = div(saving, perRation);
      const whole = (rations.num / rations.den).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      out.push({ id: "MORE_RATIONS", group: "MEALS", title: `The savings on record would pay for ${whole} more rations a month`, detail: `${usdWhole(saving)} a month at ${formatFixed(perRation, 1)} cents a ration, the program's average.`, amountPerMonth: exactText(saving), action: "Open", link: { type: "INGREDIENTS" } });
    }
  }
  const order = (group: StepGroup) => STEP_GROUPS.indexOf(group);
  return out.sort((a, b) => order(a.group) - order(b.group) || compare(magnitude(b.amountPerMonth), magnitude(a.amountPerMonth)) || a.title.localeCompare(b.title));
}
