import { DomainError } from "./errors.js";
import { add, compare, div, exactText, formatFixed, frac, fromSafeInteger, mul, parseExactText, sub, type Fraction } from "./fraction.js";

/** A decimal written in this file, such as "8.9", as an exact fraction. */
function dec(text: string): Fraction {
  if (!/^\d+(\.\d+)?$/.test(text)) throw new DomainError("BAD_DECIMAL", `Not a decimal: ${text}.`);
  const [whole, fraction = ""] = text.split(".");
  return frac(BigInt(`${whole}${fraction}`), 10n ** BigInt(fraction.length));
}

/**
 * Portfolio (Roshan, 2026-10-01): many countries, each with a menu of school meals that share ingredients. This file
 * holds the pure rules: what a recipe costs from the stored cost lines, what it gives in nutrients against a
 * reference, and which next steps the evidence supports. Every number is exact; text is formatted only at the end.
 */

// ---------------------------------------------------------------------------------------------------------------
// Nutrition reference (Roshan, 2026-10-01: WHO/FAO, key nutrients, school meal target 30%).

export const NUTRIENTS = ["ENERGY", "PROTEIN", "IRON", "VITAMIN_A", "ZINC"] as const;
export type Nutrient = (typeof NUTRIENTS)[number];

export const NUTRIENT_UNIT: Readonly<Record<Nutrient, string>> = { ENERGY: "kcal", PROTEIN: "g", IRON: "mg", VITAMIN_A: "µg", ZINC: "mg" };
export const NUTRIENT_NAME: Readonly<Record<Nutrient, string>> = { ENERGY: "Energy", PROTEIN: "Protein", IRON: "Iron", VITAMIN_A: "Vitamin A", ZINC: "Zinc" };

/**
 * Daily reference for a child aged 7 to 9. Planning values, rounded from: FAO/WHO/UNU (2004) energy requirements;
 * WHO/FAO/UNU (2007) protein safe level, 0.92 g/kg at about 26 kg; FAO/WHO (2004) vitamin and mineral requirements
 * (iron at 10% bioavailability, zinc at moderate bioavailability). Demo values: verify before any real use.
 */
export const DAILY_REFERENCE: Readonly<Record<Nutrient, Fraction>> = {
  ENERGY: dec("1750"),
  PROTEIN: dec("24"),
  IRON: dec("8.9"),
  VITAMIN_A: dec("500"),
  ZINC: dec("5.6"),
};

/** The share of the daily reference that 1 school meal should give (WFP school feeding guidance: at least 30%). */
export const SCHOOL_MEAL_SHARE: Fraction = frac(3n, 10n);

/**
 * Whose needs a ration is measured against (Roshan, 2026-10-01: WFP-style activities). Planning values, rounded;
 * demo values to verify before any real use.
 * - SCHOOL_CHILD: the 7-to-9-year-old reference above; 1 school meal = 30% of it.
 * - GENERAL_POPULATION: the Sphere Handbook (2018) planning figures for a whole population (2,100 kcal, 53 g protein,
 *   32 mg iron, 550 µg vitamin A, 12.4 mg zinc); a full general ration = 100% of it.
 * - YOUNG_CHILD: a child aged 6 to 23 months, FAO/WHO values averaged over the age range (800 kcal, 11 g protein,
 *   7 mg iron at 10% bioavailability, 400 µg vitamin A, 4.1 mg zinc); the supplement is assumed to cover 50%,
 *   because breastfeeding and family food cover the rest.
 */
export const BENEFICIARY_GROUPS = {
  SCHOOL_CHILD: { label: "School children aged 7 to 9", reference: DAILY_REFERENCE, share: SCHOOL_MEAL_SHARE },
  GENERAL_POPULATION: {
    label: "Everyone, all ages (Sphere planning figures)",
    reference: { ENERGY: dec("2100"), PROTEIN: dec("53"), IRON: dec("32"), VITAMIN_A: dec("550"), ZINC: dec("12.4") } as Readonly<Record<Nutrient, Fraction>>,
    share: frac(1n),
  },
  YOUNG_CHILD: {
    label: "Children aged 6 to 23 months",
    reference: { ENERGY: dec("800"), PROTEIN: dec("11"), IRON: dec("7"), VITAMIN_A: dec("400"), ZINC: dec("4.1") } as Readonly<Record<Nutrient, Fraction>>,
    share: frac(1n, 2n),
  },
} as const;
export type BeneficiaryGroup = keyof typeof BENEFICIARY_GROUPS;
export const groupOf = (value: string | null | undefined): BeneficiaryGroup => (value !== null && value !== undefined && value in BENEFICIARY_GROUPS ? (value as BeneficiaryGroup) : "SCHOOL_CHILD");

export const ACTIVITY_NAME: Readonly<Record<string, string>> = {
  SCHOOL_MEALS: "School meals",
  GENERAL_DISTRIBUTION: "General food distribution",
  NUTRITION_SUPPORT: "Nutrition support",
};

/**
 * Nutrients in 100 base units (100 g, or 100 ml for oil). Rounded from USDA FoodData Central (SR Legacy) for the raw
 * foods; WFP product specifications for the fortified ones (vegetable oil with vitamin A, Super Cereal). Demo
 * values: verify before any real use.
 */
export const COMPOSITION: Readonly<Record<string, Readonly<Record<Nutrient, Fraction>>>> = {
  RICE: composition("365", "7.1", "0.8", "0", "1.1"),
  MAIZE: composition("362", "8.1", "3.5", "11", "1.8"),
  SORGHUM: composition("329", "10.6", "3.4", "0", "1.7"),
  MILLET: composition("378", "11.0", "3.0", "0", "1.7"),
  BEANS: composition("337", "22.5", "6.7", "0", "2.8"),
  LENTILS: composition("352", "24.6", "6.5", "2", "3.3"),
  OIL: composition("813", "0", "0", "550", "0"),
  CSB: composition("380", "14", "6.5", "166", "5"),
  FISH: composition("315", "63", "4.7", "30", "3"),
  MILK: composition("496", "26.3", "0.5", "258", "3.3"),
};

function composition(energy: string, protein: string, iron: string, vitaminA: string, zinc: string): Record<Nutrient, Fraction> {
  return { ENERGY: dec(energy), PROTEIN: dec(protein), IRON: dec(iron), VITAMIN_A: dec(vitaminA), ZINC: dec(zinc) };
}

export const FOOD_NAME: Readonly<Record<string, string>> = {
  RICE: "rice",
  MAIZE: "maize meal",
  SORGHUM: "sorghum",
  MILLET: "millet",
  BEANS: "beans",
  LENTILS: "lentils",
  OIL: "vegetable oil",
  CSB: "Super Cereal",
  FISH: "dried fish",
  MILK: "milk powder",
};
export const foodText = (commodity: string): string => FOOD_NAME[commodity] ?? commodity.toLowerCase();

// ---------------------------------------------------------------------------------------------------------------
// Recipes.

export interface RecipeItem {
  readonly commodity: string;
  /** Whole grams or millilitres in 1 serving. */
  readonly quantity: number;
}

/** A stored recipe (CsMeal.ingredientsJson). Unknown foods and non-whole quantities are errors, never skipped. */
export function parseRecipe(json: string): RecipeItem[] {
  const value = JSON.parse(json) as unknown;
  if (!Array.isArray(value) || value.length === 0) throw new DomainError("BAD_RECIPE", "A recipe is a non-empty list.");
  return value.map((item: unknown, index) => {
    const row = item as { commodity?: unknown; quantity?: unknown };
    if (typeof row.commodity !== "string" || COMPOSITION[row.commodity] === undefined) {
      throw new DomainError("BAD_RECIPE", `Recipe item ${index + 1} names an unknown food: ${String(row.commodity)}.`);
    }
    if (typeof row.quantity !== "number" || !Number.isSafeInteger(row.quantity) || row.quantity <= 0) {
      throw new DomainError("BAD_RECIPE", `Recipe item ${index + 1} needs a positive whole quantity.`);
    }
    return { commodity: row.commodity, quantity: row.quantity };
  });
}

export interface NutrientResult {
  readonly nutrient: Nutrient;
  /** Amount in 1 serving, in the nutrient's unit. */
  readonly amount: Fraction;
  /** The school meal target: daily reference × 30%. */
  readonly target: Fraction;
  /** amount ÷ target. 1 means the target is met. */
  readonly coverage: Fraction;
}

export function recipeNutrition(recipe: readonly RecipeItem[], group: BeneficiaryGroup = "SCHOOL_CHILD"): NutrientResult[] {
  const { reference, share } = BENEFICIARY_GROUPS[group];
  return NUTRIENTS.map((nutrient) => {
    const amount = recipe.reduce((total, item) => {
      const per100 = COMPOSITION[item.commodity]?.[nutrient];
      if (per100 === undefined) throw new DomainError("BAD_RECIPE", `No composition for ${item.commodity}.`);
      return add(total, div(mul(per100, fromSafeInteger(item.quantity, "quantity")), frac(100n)));
    }, frac(0n));
    const target = mul(reference[nutrient], share);
    return { nutrient, amount, target, coverage: div(amount, target) };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Costs, from the stored cost lines of the country's current snapshot.

/** 1 stored cost line, as the portfolio reads it (CsCostLine). */
export interface PortfolioLine {
  readonly supplierLogicalId: string;
  readonly commodity: string;
  /** Exact cents for 1 base unit, supplier view. Null without a reconciled purchase. */
  readonly supplierLowExact: string | null;
  readonly supplierHighExact: string | null;
  readonly batchCount: number;
  readonly unconfirmedFailures: number;
  /** Batches that failed because of the supplier (a confirmed or rule-classified cause). */
  readonly supplierFailures?: number;
  readonly quotedCentsPer1000: number | null;
  readonly eligibility: string;
  /** A lead's claimed capacity, base units a month, from its profile. A claim, not a fact. */
  readonly claimedCapacityPerMonth?: number | null;
}

export interface UnitCost {
  /** Cents for 1 base unit. */
  readonly low: Fraction;
  readonly high: Fraction;
  /** PAID: from reconciled purchases. QUOTE: no purchase yet, the lowest quote; a promise, not a cost (C7). */
  readonly basis: "PAID" | "QUOTE";
  readonly supplierLogicalId: string;
}

/**
 * The unit cost of each food: the supplier with the most reconciled batches (the current supplier), or, with no
 * purchase at all, the lowest quote. A food with neither has no unit cost, and every recipe that uses it says so.
 */
export function unitCosts(lines: readonly PortfolioLine[]): Map<string, UnitCost> {
  const result = new Map<string, UnitCost>();
  const foods = [...new Set(lines.map((line) => line.commodity))];
  for (const commodity of foods) {
    const of = lines.filter((line) => line.commodity === commodity);
    const paid = of.filter((line) => line.supplierLowExact !== null && line.supplierHighExact !== null).sort((a, b) => b.batchCount - a.batchCount || a.supplierLogicalId.localeCompare(b.supplierLogicalId))[0];
    if (paid !== undefined) {
      result.set(commodity, { low: parseExactText(paid.supplierLowExact as string), high: parseExactText(paid.supplierHighExact as string), basis: "PAID", supplierLogicalId: paid.supplierLogicalId });
      continue;
    }
    const quote = of.filter((line) => line.quotedCentsPer1000 !== null).sort((a, b) => (a.quotedCentsPer1000 as number) - (b.quotedCentsPer1000 as number))[0];
    if (quote !== undefined) {
      const perUnit = frac(BigInt(quote.quotedCentsPer1000 as number), 1000n);
      result.set(commodity, { low: perUnit, high: perUnit, basis: "QUOTE", supplierLogicalId: quote.supplierLogicalId });
    }
  }
  return result;
}

export interface RecipeCost {
  /** Cents for 1 serving; null when a food has no unit cost. */
  readonly low: Fraction | null;
  readonly high: Fraction | null;
  /** PAID when every food is paid; QUOTE when any food is only quoted. */
  readonly basis: "PAID" | "QUOTE" | "UNKNOWN";
  readonly missing: readonly string[];
}

export function recipeCost(recipe: readonly RecipeItem[], costs: ReadonlyMap<string, UnitCost>): RecipeCost {
  const missing = recipe.filter((item) => !costs.has(item.commodity)).map((item) => item.commodity);
  if (missing.length > 0) return { low: null, high: null, basis: "UNKNOWN", missing };
  let low = frac(0n);
  let high = frac(0n);
  let quoted = false;
  for (const item of recipe) {
    const cost = costs.get(item.commodity) as UnitCost;
    const quantity = fromSafeInteger(item.quantity, "quantity");
    low = add(low, mul(cost.low, quantity));
    high = add(high, mul(cost.high, quantity));
    quoted ||= cost.basis === "QUOTE";
  }
  return { low, high, basis: quoted ? "QUOTE" : "PAID", missing: [] };
}

// ---------------------------------------------------------------------------------------------------------------
// Local sourcing without inflating local prices (Roshan, 2026-10-01).
//
// An approximation, not a price model: C8 treats our purchases as market pressure, and the declared policy reviews
// any share above 10% of the estimated local market. So the safe local volume is 10% of that estimate. Local bids
// fill it cheapest first, each up to what the supplier can supply; the rest of the need comes from imports. Imports
// do not draw on the local market, so they do not count against the safe volume.

export interface SourcingCandidate {
  readonly supplierLogicalId: string;
  readonly route: string;
  /** Cents for 1 base unit: the paid cost, or the quote for a lead. */
  readonly centsPerUnit: Fraction;
  /** Base units a month: confirmed on a visit, else claimed; null when unknown. */
  readonly capacityPerMonth: number | null;
}

export interface SourcingPlan {
  readonly needPerMonth: number;
  readonly marketVolumePerMonth: number | null;
  readonly threshold: Fraction;
  /** threshold × market, rounded down to a whole base unit; null without a market estimate. */
  readonly safeLocalPerMonth: number | null;
  /** need ÷ market: the share if everything were bought locally. */
  readonly shareIfAllLocal: Fraction | null;
  readonly allocations: readonly { readonly supplierLogicalId: string; readonly volume: number }[];
  readonly localTotal: number;
  readonly importNeeded: number;
}

export function localSourcingPlan(input: { readonly needPerMonth: number; readonly marketVolumePerMonth: number | null; readonly candidates: readonly SourcingCandidate[]; readonly threshold?: Fraction }): SourcingPlan {
  const threshold = input.threshold ?? frac(10n, 100n);
  const market = input.marketVolumePerMonth;
  const safe = market === null || market <= 0 ? null : Number((BigInt(market) * threshold.num) / threshold.den);
  let room = Math.min(input.needPerMonth, safe ?? input.needPerMonth);
  const allocations: { supplierLogicalId: string; volume: number }[] = [];
  const local = input.candidates.filter((c) => c.route === "LOCAL").sort((a, b) => compare(a.centsPerUnit, b.centsPerUnit) || a.supplierLogicalId.localeCompare(b.supplierLogicalId));
  for (const candidate of local) {
    if (room <= 0) break;
    const volume = Math.min(room, candidate.capacityPerMonth ?? room);
    if (volume <= 0) continue;
    allocations.push({ supplierLogicalId: candidate.supplierLogicalId, volume });
    room -= volume;
  }
  const localTotal = allocations.reduce((total, a) => total + a.volume, 0);
  return {
    needPerMonth: input.needPerMonth,
    marketVolumePerMonth: market,
    threshold,
    safeLocalPerMonth: safe,
    shareIfAllLocal: market === null || market <= 0 ? null : frac(BigInt(input.needPerMonth), BigInt(market)),
    allocations,
    localTotal,
    importNeeded: input.needPerMonth - localTotal,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Recommendations: deterministic rules over stored evidence. A recommendation changes nothing; a person acts on it.

export type Severity = "HIGH" | "MEDIUM" | "LOW";
export type RecommendationAction =
  | { readonly type: "INVESTIGATE_SUPPLIER"; readonly supplierLogicalId: string; readonly commodity: string }
  | { readonly type: "INVESTIGATE_MARKET"; readonly commodity: string }
  | { readonly type: "CONFIRM_CAUSE"; readonly commodity: string }
  | { readonly type: "REVIEW_MEAL"; readonly mealId: string }
  | { readonly type: "OPEN_PRICES"; readonly commodity: string };

export interface Recommendation {
  readonly id: string;
  readonly kind: "NO_SUPPLIER" | "PRICE_ABOVE_MARKET" | "CHEAPER_LEAD" | "SINGLE_SUPPLIER" | "UNCONFIRMED_FAILURE" | "SUPPLIER_FAILURES" | "NUTRITION_GAP" | "MARKET_RISING" | "LOCAL_MARKET_LIMIT";
  readonly severity: Severity;
  readonly title: string;
  readonly detail: string;
  readonly action: RecommendationAction;
}

export interface IngredientInput {
  readonly commodity: string;
  readonly lines: readonly PortfolioLine[];
  /** Latest WFP median of the local series, micro-dollars for 1 kg or L. Null without market data. */
  readonly marketLocalMicros: Fraction | null;
  /** 12-month change of the local series, for example 141/1000 for +14.1%. */
  readonly marketLocalChange: Fraction | null;
  /** The menu's need, base units a month; a lead that claims less cannot be the only supplier. */
  readonly needPerMonth?: number;
  /** The declared estimate of the local market, base units a month (synthetic, C8). */
  readonly marketVolumePerMonth?: number | null;
}

export interface MealInput {
  readonly mealId: string;
  readonly name: string;
  readonly recipe: readonly RecipeItem[];
  /** Servings each month; weights each food's share of the menu. */
  readonly servingsPerMonth?: number;
  /** Whose reference the nutrients are measured against; school children when absent. */
  readonly group?: BeneficiaryGroup;
}

const pct = (value: Fraction): string => `${formatFixed(mul(value, frac(100n)), 0)}%`;
const usdPerKg = (centsPerUnit: Fraction): string => formatFixed(div(mul(centsPerUnit, frac(1000n)), frac(100n)), 2);
/** The unit a price is quoted in: litres for oil, kilograms for the rest. */
export const priceUnit = (commodity: string): string => (commodity === "OIL" ? "L" : "kg");
const shortId = (logicalId: string): string => logicalId.slice(logicalId.lastIndexOf(":") + 1);

/** Price alarm: paid more than 15% above the local retail median. Retail is a ceiling for a bulk buyer. */
export const PRICE_ALERT: Fraction = frac(15n, 100n);
/** A lead is worth checking when it quotes at least 10% below the current paid cost. */
export const LEAD_GAP: Fraction = frac(10n, 100n);
/** A local market that rose more than 10% in 12 months is flagged for a look. */
export const MARKET_RISE: Fraction = frac(10n, 100n);

export function recommendations(input: { readonly ingredients: readonly IngredientInput[]; readonly meals: readonly MealInput[] }): Recommendation[] {
  const out: Recommendation[] = [];
  const used = new Set(input.meals.flatMap((meal) => meal.recipe.map((item) => item.commodity)));
  for (const ingredient of input.ingredients) {
    const { commodity, lines } = ingredient;
    const name = foodText(commodity);
    const paid = lines.filter((line) => line.supplierLowExact !== null);
    const leads = lines.filter((line) => line.batchCount === 0 && line.quotedCentsPer1000 !== null);
    const costs = unitCosts(lines).get(commodity);

    if (paid.length === 0) {
      const verified = leads.filter((line) => line.eligibility === "VERIFIED_PASS");
      const unchecked = leads.filter((line) => line.eligibility === "LEAD").sort((a, b) => (a.quotedCentsPer1000 as number) - (b.quotedCentsPer1000 as number));
      const need = ingredient.needPerMonth;
      const enough = need === undefined ? unchecked : unchecked.filter((line) => (line.claimedCapacityPerMonth ?? 0) >= need);
      const best = enough[0] ?? unchecked[0];
      const kgOrL = commodity === "OIL" ? "L" : "kg";
      const capacityNote =
        best === undefined || need === undefined
          ? ""
          : enough.length === 0
            ? ` No lead claims the full need of ${Math.round(need / 1000).toLocaleString("en-US")} ${kgOrL} a month.`
            : ` It claims ${Math.round((best.claimedCapacityPerMonth ?? 0) / 1000).toLocaleString("en-US")} ${kgOrL} a month against a need of ${Math.round(need / 1000).toLocaleString("en-US")}.`;
      out.push({
        id: `NO_SUPPLIER:${commodity}`,
        kind: "NO_SUPPLIER",
        severity: "HIGH",
        title: `Choose a ${name} supplier`,
        detail:
          leads.length === 0
            ? `No supplier and no quote for ${name} yet.`
            : `${leads.length} lead${leads.length === 1 ? "" : "s"} quoted, ${verified.length} passed a field visit.${best === undefined ? "" : ` Lowest unchecked quote${enough.length > 0 && need !== undefined ? " with enough capacity" : ""}: ${shortId(best.supplierLogicalId)} at ${usdPerKg(frac(BigInt(best.quotedCentsPer1000 as number), 1000n))} $/${priceUnit(commodity)}.${capacityNote}`}`,
        action: best === undefined ? { type: "INVESTIGATE_MARKET", commodity } : { type: "INVESTIGATE_SUPPLIER", supplierLogicalId: best.supplierLogicalId, commodity },
      });
    }

    if (costs?.basis === "PAID" && ingredient.marketLocalMicros !== null && ingredient.marketLocalMicros.num > 0n) {
      // Cents per base unit × 1,000 = cents per kg; × 10,000 = micro-dollars per kg.
      const paidMicros = mul(costs.low, frac(10_000_000n));
      const over = sub(div(paidMicros, ingredient.marketLocalMicros), frac(1n));
      if (compare(over, PRICE_ALERT) > 0) {
        out.push({
          id: `PRICE_ABOVE_MARKET:${commodity}`,
          kind: "PRICE_ABOVE_MARKET",
          severity: compare(over, frac(30n, 100n)) > 0 ? "HIGH" : "MEDIUM",
          title: `${capital(name)} costs ${pct(over)} more than the local market`,
          detail: `We pay ${usdPerKg(costs.low)} $/${priceUnit(commodity)}; the local retail median is ${formatFixed(div(ingredient.marketLocalMicros, frac(1_000_000n)), 2)} $/${priceUnit(commodity)}. Survey local sources.`,
          action: { type: "INVESTIGATE_MARKET", commodity },
        });
      }
    }

    if (costs?.basis === "PAID") {
      for (const lead of leads.filter((line) => line.eligibility === "LEAD")) {
        const quote = frac(BigInt(lead.quotedCentsPer1000 as number), 1000n);
        const gap = sub(frac(1n), div(quote, costs.low));
        if (compare(gap, LEAD_GAP) >= 0) {
          out.push({
            id: `CHEAPER_LEAD:${commodity}:${lead.supplierLogicalId}`,
            kind: "CHEAPER_LEAD",
            severity: "MEDIUM",
            title: `${shortId(lead.supplierLogicalId)} quotes ${pct(gap)} below what we pay for ${name}`,
            detail: `Quote ${usdPerKg(quote)} $/${priceUnit(commodity)} against ${usdPerKg(costs.low)} $/${priceUnit(commodity)} paid. A quote is a promise until a field visit checks it.`,
            action: { type: "INVESTIGATE_SUPPLIER", supplierLogicalId: lead.supplierLogicalId, commodity },
          });
        }
      }
    }

    if (lines.some((line) => line.unconfirmedFailures > 0)) {
      out.push({
        id: `UNCONFIRMED_FAILURE:${commodity}`,
        kind: "UNCONFIRMED_FAILURE",
        severity: "MEDIUM",
        title: `A failed ${name} delivery has no confirmed cause`,
        detail: `Until a person confirms the cause, the ${name} cost is a range.`,
        action: { type: "CONFIRM_CAUSE", commodity },
      });
    }

    // Deliveries that failed because of the supplier: the supplier's handling, not transport or storage after handover.
    for (const line of lines.filter((l) => l.batchCount > 0 && (l.supplierFailures ?? 0) > 0)) {
      const failed = line.supplierFailures ?? 0;
      out.push({
        id: `SUPPLIER_FAILURES:${commodity}:${line.supplierLogicalId}`,
        kind: "SUPPLIER_FAILURES",
        severity: failed * 3 >= line.batchCount ? "HIGH" : "MEDIUM",
        title: `${shortId(line.supplierLogicalId)}: ${failed} of ${line.batchCount} ${name} deliveries failed because of the supplier`,
        detail: "Each failed delivery raises the cost of every accepted ration. Review the incidents, and check another supplier.",
        action: { type: "CONFIRM_CAUSE", commodity },
      });
    }

    const market = ingredient.marketVolumePerMonth ?? null;
    if (ingredient.needPerMonth !== undefined && market !== null && market > 0 && used.has(commodity)) {
      const share = frac(BigInt(ingredient.needPerMonth), BigInt(market));
      if (compare(share, frac(10n, 100n)) > 0) {
        const safe = Math.floor(market / 10);
        const unit = commodity === "OIL" ? "L" : "kg";
        out.push({
          id: `LOCAL_MARKET_LIMIT:${commodity}`,
          kind: "LOCAL_MARKET_LIMIT",
          severity: "MEDIUM",
          title:
            compare(share, frac(2n)) >= 0
              ? `Buying all the ${name} locally would take ${formatFixed(share, 0)} times the local market`
              : `Buying all the ${name} locally would be ${pct(share)} of the local market`,
          detail: `Above the 10% line, our buying would push local prices up. Up to about ${Math.round(safe / 1000).toLocaleString("en-US")} ${unit} a month locally; import the other ${Math.round((ingredient.needPerMonth - safe) / 1000).toLocaleString("en-US")} ${unit}.`,
          action: { type: "INVESTIGATE_MARKET", commodity },
        });
      }
    }

    if (ingredient.marketLocalChange !== null && compare(ingredient.marketLocalChange, MARKET_RISE) > 0 && used.has(commodity)) {
      out.push({
        id: `MARKET_RISING:${commodity}`,
        kind: "MARKET_RISING",
        severity: "LOW",
        title: `Local ${name} prices rose ${pct(ingredient.marketLocalChange)} in 12 months`,
        detail: "An indicator, not a forecast.",
        action: { type: "OPEN_PRICES", commodity },
      });
    }
  }

  // 1 supplier only: flagged once, for the food the menu uses most.
  const need = (commodity: string): bigint =>
    input.meals.reduce((total, meal) => total + BigInt(meal.servingsPerMonth ?? 1) * BigInt(meal.recipe.find((item) => item.commodity === commodity)?.quantity ?? 0), 0n);
  const single = input.ingredients
    .filter((ingredient) => used.has(ingredient.commodity) && ingredient.lines.filter((line) => line.supplierLowExact !== null).length === 1)
    .sort((a, b) => (need(b.commodity) > need(a.commodity) ? 1 : need(b.commodity) < need(a.commodity) ? -1 : a.commodity.localeCompare(b.commodity)));
  const largest = single[0];
  if (largest !== undefined) {
    const supplier = largest.lines.find((line) => line.supplierLowExact !== null) as PortfolioLine;
    const others = single.length - 1;
    out.push({
      id: `SINGLE_SUPPLIER:${largest.commodity}`,
      kind: "SINGLE_SUPPLIER",
      severity: "LOW",
      title: `Only 1 ${foodText(largest.commodity)} supplier`,
      detail: `${capital(foodText(largest.commodity))} is the largest food on the menu and every delivery depends on ${shortId(supplier.supplierLogicalId)}.${others === 0 ? "" : ` ${others} other food${others === 1 ? " has" : "s have"} 1 supplier too.`}`,
      action: { type: "INVESTIGATE_MARKET", commodity: largest.commodity },
    });
  }

  // Nutrition: 1 recommendation for each nutrient below target, with the fix for the meal furthest from it.
  for (const nutrient of NUTRIENTS) {
    const below = input.meals
      .map((meal) => ({ meal, result: recipeNutrition(meal.recipe, meal.group).find((r) => r.nutrient === nutrient) as NutrientResult }))
      .filter(({ result }) => compare(result.coverage, frac(1n)) < 0)
      .sort((a, b) => compare(a.result.coverage, b.result.coverage));
    const worst = below[0];
    if (worst === undefined) continue;
    const fix = closeGap(worst.meal.recipe, worst.result);
    const label = NUTRIENT_NAME[nutrient];
    out.push({
      id: `NUTRITION_GAP:${nutrient}`,
      kind: "NUTRITION_GAP",
      severity: compare(worst.result.coverage, frac(6n, 10n)) < 0 ? "MEDIUM" : "LOW",
      title: `${label} below target in ${below.length} of ${input.meals.length} ration${input.meals.length === 1 ? "" : "s"}`,
      detail: `Lowest: ${worst.meal.name} at ${pct(worst.result.coverage)} of ${formatFixed(worst.result.target, 1)} ${NUTRIENT_UNIT[nutrient]}.${fix === null ? " No single food closes it in a normal serving; a fortified food or micronutrient powder is the usual fix." : ` Adding ${fix.grams} ${fix.commodity === "OIL" ? "ml" : "g"} of ${foodText(fix.commodity)} would meet it.`}`,
      action: { type: "REVIEW_MEAL", mealId: worst.meal.mealId },
    });
  }

  const order: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id));
}

/** The most 1 suggestion may add to a serving, in g (ml for oil). Past this it is a different ration, not a fix. */
const MAX_ADDITION: Readonly<Record<string, number>> = { OIL: 30 };
const MAX_ADDITION_DEFAULT = 100;

/**
 * The smallest whole amount of 1 food that closes a nutrient gap within MAX_ADDITION: the densest food in COMPOSITION
 * that fits. Null when no food fits.
 */
function closeGap(recipe: readonly RecipeItem[], gap: NutrientResult): { readonly commodity: string; readonly grams: number } | null {
  const missing = sub(gap.target, gap.amount);
  const candidates = Object.entries(COMPOSITION)
    .filter(([, values]) => values[gap.nutrient].num > 0n)
    .sort(([a, x], [b, y]) => compare(y[gap.nutrient], x[gap.nutrient]) || Number(recipe.some((i) => i.commodity === b)) - Number(recipe.some((i) => i.commodity === a)));
  for (const [commodity, values] of candidates) {
    // grams = missing ÷ (per 100 g ÷ 100), rounded up to a whole gram.
    const exact = div(mul(missing, frac(100n)), values[gap.nutrient]);
    const grams = Number((exact.num + exact.den - 1n) / exact.den);
    if (grams <= (MAX_ADDITION[commodity] ?? MAX_ADDITION_DEFAULT)) return { commodity, grams };
  }
  return null;
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Exact text for the browser. */
export const exact = (value: Fraction | null): string | null => (value === null ? null : exactText(value));
