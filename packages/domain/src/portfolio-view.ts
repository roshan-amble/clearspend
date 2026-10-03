import { add, compare, div, exactText, frac, fromSafeInteger, mul, parseExactText, sub, type Fraction } from "./fraction.js";
import {
  ACTIVITY_NAME,
  BENEFICIARY_GROUPS,
  FOOD_NAME,
  groupOf,
  localSourcingPlan,
  recipeCost,
  recipeNutrition,
  recommendations,
  unitCosts,
  type Nutrient,
  type PortfolioLine,
  type Recommendation,
  type RecipeItem,
} from "./portfolio.js";
import type { FoodForAi } from "./ai.js";
import { countrySteps, foodStep, STEP_GROUPS, usdWhole } from "./workflow.js";
import { baselineOf, bidSupplierId, centsPerUnitFromMicros, netPerMonth, reasonableVolume, type SupplierBidInput } from "./offers.js";

/**
 * The country page and the portfolio cards, assembled from stored objects by the query functions csCountry and
 * csPortfolio. Pure and JSON-safe: every fraction leaves as exact text, and the browser only formats it (D2).
 */

export interface MarketSeriesJson {
  readonly series: string;
  readonly route: "LOCAL" | "IMPORT";
  readonly lastMonth: string;
  readonly lastMedianMicros: string;
  readonly change: string | null;
}
export interface MarketJson {
  readonly commodity: string;
  readonly pressureShare: string;
  readonly pressureFlagged: boolean;
  readonly series: readonly MarketSeriesJson[];
}

export interface InvestigationRef {
  readonly investigationId: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly commodity: string;
  readonly status: string;
  readonly reason: string;
  readonly investigatorId: string | null;
  readonly onGroundStart: string | null;
  readonly onGroundEnd: string | null;
  readonly createdAt: string;
}

export interface CountryInput {
  readonly country: {
    readonly iso3: string;
    readonly name: string;
    readonly flag: string;
    readonly status: string;
    readonly region: string;
    readonly expansionId: string;
    readonly schools: number;
    readonly students: number;
    readonly hub: string;
    readonly synthetic: boolean;
  };
  readonly evidenceRevision: number | null;
  readonly lines: readonly (PortfolioLine & { readonly route: string })[];
  readonly supplierNames: Readonly<Record<string, string>>;
  readonly market: readonly MarketJson[];
  readonly meals: readonly {
    readonly mealId: string;
    readonly name: string;
    readonly daysServed: string;
    readonly servingsPerMonth: number;
    readonly recipe: readonly RecipeItem[];
    /** WFP-style activity and whose reference applies; school meals for children when absent. */
    readonly activity?: string | null;
    readonly group?: string | null;
    readonly beneficiaries?: number | null;
  }[];
  readonly investigations: readonly InvestigationRef[];
  /** The declared estimate of each local market, base units a month (CsExpansionCommodity, synthetic). */
  readonly commodities?: readonly { readonly commodity: string; readonly marketVolumePerMonth: number | null }[];
  /** Capacity confirmed on a field visit, base units a month, by supplier logical ID. */
  readonly confirmedCapacity?: Readonly<Record<string, number>>;
  /** Offers from the supplier site (CsSupplierBid). Only ACCEPTED ones join the supplier list. */
  readonly bids?: readonly SupplierBidInput[];
}

const ex = (value: Fraction | null): string | null => (value === null ? null : exactText(value));
const ACTIVE_INVESTIGATION = new Set(["OPEN", "SCHEDULED"]);

function investigationFor(recommendation: Recommendation, investigations: readonly InvestigationRef[]): InvestigationRef | null {
  const action = recommendation.action;
  const match = (type: string, subject: string) => investigations.find((i) => ACTIVE_INVESTIGATION.has(i.status) && i.subjectType === type && i.subjectId === subject) ?? null;
  if (action.type === "INVESTIGATE_SUPPLIER") return match("SUPPLIER", action.supplierLogicalId);
  if (action.type === "INVESTIGATE_MARKET") return match("MARKET", action.commodity);
  return null;
}

export function countryView(input: CountryInput) {
  const costs = unitCosts(input.lines);
  const foods = [...new Set([...input.meals.flatMap((meal) => meal.recipe.map((item) => item.commodity)), ...input.lines.map((line) => line.commodity)])].sort();

  const meals = input.meals.map((meal) => {
    const cost = recipeCost(meal.recipe, costs);
    const group = groupOf(meal.group);
    return {
      mealId: meal.mealId,
      name: meal.name,
      daysServed: meal.daysServed,
      servingsPerMonth: meal.servingsPerMonth,
      activity: meal.activity ?? "SCHOOL_MEALS",
      group,
      groupLabel: BENEFICIARY_GROUPS[group].label,
      targetShare: exactText(BENEFICIARY_GROUPS[group].share),
      beneficiaries: meal.beneficiaries ?? null,
      cost: { low: ex(cost.low), high: ex(cost.high), basis: cost.basis, missing: cost.missing },
      items: meal.recipe.map((item) => {
        const unit = costs.get(item.commodity);
        const quantity = fromSafeInteger(item.quantity, "quantity");
        return { commodity: item.commodity, quantity: item.quantity, low: unit === undefined ? null : ex(mul(unit.low, quantity)), high: unit === undefined ? null : ex(mul(unit.high, quantity)), basis: unit?.basis ?? "UNKNOWN" };
      }),
      nutrition: recipeNutrition(meal.recipe, group).map((n) => ({ nutrient: n.nutrient, amount: ex(n.amount), target: ex(n.target), coverage: ex(n.coverage) })),
    };
  });

  // P10: how each offer waiting for review would compare if accepted, so the reviewer sees it before deciding.
  const previews = new Map<string, { readonly price: string; readonly vsMarket: string | null; readonly reasonableVolume: number | null; readonly netPerMonth: string | null }>();
  const market = (commodity: string, route: "LOCAL" | "IMPORT") => input.market.find((m) => m.commodity === commodity)?.series.find((s) => s.route === route) ?? null;
  const ingredients = foods.map((commodity) => {
    const need = input.meals.reduce((total, meal) => total + meal.servingsPerMonth * (meal.recipe.find((item) => item.commodity === commodity)?.quantity ?? 0), 0);
    const unit = costs.get(commodity) ?? null;
    const needExact = fromSafeInteger(need, "need");
    const local = market(commodity, "LOCAL");
    const imported = market(commodity, "IMPORT");
    const indicator = input.market.find((m) => m.commodity === commodity);
    const marketVolume = input.commodities?.find((c) => c.commodity === commodity)?.marketVolumePerMonth ?? null;
    const localMicros = local === null ? null : parseExactText(local.lastMedianMicros);
    const lines = input.lines.filter((line) => line.commodity === commodity);
    const priceOf = (line: (typeof lines)[number]): Fraction | null =>
      line.supplierLowExact !== null ? parseExactText(line.supplierLowExact) : line.quotedCentsPer1000 === null ? null : frac(BigInt(line.quotedCentsPer1000), 1000n);
    const capacityOf = (line: (typeof lines)[number]): number | null => input.confirmedCapacity?.[line.supplierLogicalId] ?? line.claimedCapacityPerMonth ?? null;
    // P10: an accepted offer from the supplier site is a local lead whose price and quantity are the supplier's own.
    const bids = (input.bids ?? []).filter((bid) => bid.status === "ACCEPTED" && bid.commodity === commodity);
    const bidPrice = (bid: SupplierBidInput): Fraction => frac(BigInt(bid.priceCentsPer1000), 1000n);
    const bidCapacity = (bid: SupplierBidInput): number => input.confirmedCapacity?.[bidSupplierId(bid.bidId)] ?? bid.quantityPerMonth;
    const candidates = [
      ...lines.flatMap((line) => {
        const price = priceOf(line);
        return price === null ? [] : [{ supplierLogicalId: line.supplierLogicalId, route: line.route, centsPerUnit: price, capacityPerMonth: capacityOf(line) }];
      }),
      ...bids.map((bid) => ({ supplierLogicalId: bidSupplierId(bid.bidId), route: "LOCAL", centsPerUnit: bidPrice(bid), capacityPerMonth: bidCapacity(bid) })),
    ];
    const plan = localSourcingPlan({ needPerMonth: need, marketVolumePerMonth: marketVolume, candidates });
    const baseline = baselineOf({
      paid: unit !== null && unit.basis === "PAID" && unit.supplierLogicalId !== null ? { centsPerUnit: unit.low, supplierLogicalId: unit.supplierLogicalId } : null,
      importMicros: imported?.lastMedianMicros ?? null,
      localMicros: local?.lastMedianMicros ?? null,
    });
    const vsMarketOf = (price: Fraction | null): string | null =>
      price === null || localMicros === null || localMicros.num === 0n ? null : ex(sub(div(mul(price, frac(10_000_000n)), localMicros), frac(1n)));
    const offer = (route: string, price: Fraction | null, capacity: number | null) => {
      const volume = reasonableVolume({ route, capacityPerMonth: capacity, needPerMonth: need, safeLocalPerMonth: plan.safeLocalPerMonth });
      return { reasonableVolume: volume, netPerMonth: ex(netPerMonth(price, baseline, volume)) };
    };
    for (const bid of (input.bids ?? []).filter((b) => b.status === "SUBMITTED" && b.commodity === commodity)) {
      previews.set(bid.bidId, { price: exactText(bidPrice(bid)), vsMarket: vsMarketOf(bidPrice(bid)), ...offer("LOCAL", bidPrice(bid), bid.quantityPerMonth) });
    }
    const planNet = plan.allocations.reduce<Fraction | null>((total, allocation) => {
      const candidate = candidates.find((c) => c.supplierLogicalId === allocation.supplierLogicalId);
      const net = candidate === undefined ? null : netPerMonth(candidate.centsPerUnit, baseline, allocation.volume);
      return total === null || net === null ? null : add(total, net);
    }, frac(0n));
    // P20: what the 10% line leaves goes to international suppliers, cheapest first, each up to its capacity (a current
    // supplier, which already delivers the whole need, without a cap); what no offer covers stays at the compared price.
    const byPrice = (a: (typeof candidates)[number], b: (typeof candidates)[number]) => compare(a.centsPerUnit, b.centsPerUnit) || a.supplierLogicalId.localeCompare(b.supplierLogicalId);
    const currentIds = new Set(lines.filter((l) => l.batchCount > 0).map((l) => l.supplierLogicalId));
    let room = plan.importNeeded;
    const importAllocations: { readonly supplierLogicalId: string; readonly volume: number }[] = [];
    for (const candidate of candidates.filter((c) => c.route === "IMPORT").sort(byPrice)) {
      if (room <= 0) break;
      const cap = currentIds.has(candidate.supplierLogicalId) ? null : candidate.capacityPerMonth;
      const volume = Math.min(room, cap ?? room);
      if (volume <= 0) continue;
      importAllocations.push({ supplierLogicalId: candidate.supplierLogicalId, volume });
      room -= volume;
    }
    const importNet = importAllocations.reduce<Fraction | null>((total, allocation) => {
      const candidate = candidates.find((c) => c.supplierLogicalId === allocation.supplierLogicalId);
      const net = candidate === undefined ? null : netPerMonth(candidate.centsPerUnit, baseline, allocation.volume);
      return total === null || net === null ? null : add(total, net);
    }, frac(0n));
    const importPlanned = importAllocations.reduce((total, a) => total + a.volume, 0);
    // Local against international (Roshan, 2026-10-01): the price of the international route is what we pay an import
    // supplier now, else the lowest import quote, else WFP's import median (a price reference, not a supplier).
    const cheapest = (route: string) => candidates.filter((c) => c.route === route).sort((a, b) => compare(a.centsPerUnit, b.centsPerUnit) || a.supplierLogicalId.localeCompare(b.supplierLogicalId))[0] ?? null;
    const paidImport = lines.filter((l) => l.route === "IMPORT" && l.batchCount > 0 && l.supplierLowExact !== null).sort((a, b) => b.batchCount - a.batchCount || a.supplierLogicalId.localeCompare(b.supplierLogicalId))[0];
    const quotedImport = cheapest("IMPORT");
    const international: { readonly price: Fraction; readonly basis: "PAID" | "QUOTE" | "WFP_IMPORT_MEDIAN"; readonly supplierLogicalId: string | null } | null =
      paidImport !== undefined && paidImport.supplierLowExact !== null
        ? { price: parseExactText(paidImport.supplierLowExact), basis: "PAID", supplierLogicalId: paidImport.supplierLogicalId }
        : quotedImport !== null
          ? { price: quotedImport.centsPerUnit, basis: "QUOTE", supplierLogicalId: quotedImport.supplierLogicalId }
          : imported !== null
            ? { price: centsPerUnitFromMicros(imported.lastMedianMicros), basis: "WFP_IMPORT_MEDIAN", supplierLogicalId: null }
            : null;
    const localCost = plan.allocations.reduce((total, allocation) => {
      const candidate = candidates.find((c) => c.supplierLogicalId === allocation.supplierLogicalId);
      return candidate === undefined ? total : add(total, mul(candidate.centsPerUnit, frac(BigInt(allocation.volume))));
    }, frac(0n));
    // Every net cost on this food's screen compares with 1 price: the baseline (P9). The international route is
    // "the compared price" when it is that baseline; otherwise it has its own net cost for the whole need.
    const internationalIsCompared =
      international !== null &&
      baseline !== null &&
      ((baseline.kind === "IMPORT" && international.basis === "WFP_IMPORT_MEDIAN") || (baseline.kind === "PAID" && international.basis === "PAID" && baseline.supplierLogicalId === international.supplierLogicalId));
    const comparison = {
      compared: baseline === null ? null : { kind: baseline.kind, centsPerUnit: exactText(baseline.centsPerUnit), supplierLogicalId: baseline.kind === "PAID" ? baseline.supplierLogicalId : null, cost: exactText(mul(baseline.centsPerUnit, needExact)) },
      local: {
        count: candidates.filter((c) => c.route === "LOCAL" && !lines.some((l) => l.supplierLogicalId === c.supplierLogicalId && l.batchCount > 0)).length,
        bestPrice: ex(cheapest("LOCAL")?.centsPerUnit ?? null),
        plannedVolume: plan.localTotal,
        plannedCost: exactText(localCost),
        /** The cheapest-first local plan against the compared price, cents a month. */
        net: baseline === null ? null : ex(planNet),
      },
      international:
        international === null
          ? null
          : {
              count: lines.filter((l) => l.route === "IMPORT").length,
              price: exactText(international.price),
              basis: international.basis,
              supplierLogicalId: international.supplierLogicalId,
              isCompared: internationalIsCompared,
              /** Buying the whole need at the international price, against the compared price. Null when it is that price. */
              net: baseline === null || internationalIsCompared ? null : exactText(mul(sub(international.price, baseline.centsPerUnit), needExact)),
              /** P20: the international part of the cheapest-first plan, and its net cost against the compared price. */
              plannedVolume: importPlanned,
              plannedNet: baseline === null ? null : ex(importNet),
            },
    };
    // P17, the Ingredients page: who supplies this food now, and the lowest price on record for it (the ideal):
    // the lower of WFP's local and import medians and of every lead's or offer's price.
    const inUse = lines.filter((l) => l.batchCount > 0).sort((a, b) => b.batchCount - a.batchCount || a.supplierLogicalId.localeCompare(b.supplierLogicalId));
    const options: { readonly centsPerUnit: Fraction; readonly source: "LOCAL_MARKET" | "IMPORT_MARKET" | "OFFER"; readonly supplierLogicalId: string | null }[] = [
      ...(local === null ? [] : [{ centsPerUnit: centsPerUnitFromMicros(local.lastMedianMicros), source: "LOCAL_MARKET" as const, supplierLogicalId: null }]),
      ...(imported === null ? [] : [{ centsPerUnit: centsPerUnitFromMicros(imported.lastMedianMicros), source: "IMPORT_MARKET" as const, supplierLogicalId: null }]),
      ...candidates.filter((c) => !inUse.some((l) => l.supplierLogicalId === c.supplierLogicalId)).map((c) => ({ centsPerUnit: c.centsPerUnit, source: "OFFER" as const, supplierLogicalId: c.supplierLogicalId })),
    ];
    const ideal = options.sort((a, b) => compare(a.centsPerUnit, b.centsPerUnit) || a.source.localeCompare(b.source))[0] ?? null;
    return {
      commodity,
      comparison,
      inUse: inUse.map((l) => ({ supplierLogicalId: l.supplierLogicalId, name: input.supplierNames[l.supplierLogicalId] ?? l.supplierLogicalId, route: l.route, batchCount: l.batchCount, price: ex(priceOf(l)) })),
      ideal: ideal === null ? null : { centsPerUnit: exactText(ideal.centsPerUnit), source: ideal.source, supplierLogicalId: ideal.supplierLogicalId },
      /** (what we pay − the lowest price on record) × the need, cents a month. Positive: we pay above it. */
      gapPerMonth: ideal === null || unit === null || unit.basis !== "PAID" ? null : ex(mul(sub(unit.low, ideal.centsPerUnit), needExact)),
      /** What we pay ÷ the lowest price on record − 1: 22/100 is 22% over it. A price, not a saving: offers are capped by capacity and the 10% rule. */
      gapShare: ideal === null || unit === null || unit.basis !== "PAID" || ideal.centsPerUnit.num === 0n ? null : ex(sub(div(unit.low, ideal.centsPerUnit), frac(1n))),
      rations: input.meals.filter((meal) => meal.recipe.some((item) => item.commodity === commodity)).map((meal) => ({ mealId: meal.mealId, name: meal.name })),
      needPerMonth: need,
      meals: input.meals.filter((meal) => meal.recipe.some((item) => item.commodity === commodity)).map((meal) => meal.mealId),
      unitCost: unit === null ? null : { low: ex(unit.low), high: ex(unit.high), basis: unit.basis, supplierLogicalId: unit.supplierLogicalId },
      monthlyCost: unit === null ? null : { low: ex(mul(unit.low, needExact)), high: ex(mul(unit.high, needExact)) },
      market: { local, import: imported, pressureShare: indicator?.pressureShare ?? null, pressureFlagged: indicator?.pressureFlagged ?? false, volumePerMonth: marketVolume },
      sourcing: {
        needPerMonth: plan.needPerMonth,
        marketVolumePerMonth: plan.marketVolumePerMonth,
        threshold: exactText(plan.threshold),
        safeLocalPerMonth: plan.safeLocalPerMonth,
        shareIfAllLocal: ex(plan.shareIfAllLocal),
        allocations: plan.allocations,
        localTotal: plan.localTotal,
        importNeeded: plan.importNeeded,
        /** Σ (price − baseline) × planned volume of the cheapest-first plan, cents a month; the import part is at the baseline. */
        netPerMonth: baseline === null ? null : ex(planNet),
        /** P20: the rest, from international suppliers cheapest first; what no offer covers; the whole plan's net cost. */
        importAllocations,
        uncoveredPerMonth: room,
        netTotalPerMonth: baseline === null || planNet === null || importNet === null ? null : ex(add(planNet, importNet)),
      },
      /** The price each net cost compares with (P9). */
      baseline: baseline === null ? null : { kind: baseline.kind, centsPerUnit: exactText(baseline.centsPerUnit), supplierLogicalId: baseline.kind === "PAID" ? baseline.supplierLogicalId : null },
      suppliers: lines
        .map((line) => ({
          supplierLogicalId: line.supplierLogicalId,
          name: input.supplierNames[line.supplierLogicalId] ?? line.supplierLogicalId,
          role: line.batchCount > 0 ? "CURRENT" : "LEAD",
          route: line.route,
          batchCount: line.batchCount,
          eligibility: line.eligibility,
          quotedCentsPer1000: line.quotedCentsPer1000,
          lowExact: line.supplierLowExact,
          highExact: line.supplierHighExact,
          unconfirmedFailures: line.unconfirmedFailures,
          claimedCapacityPerMonth: line.claimedCapacityPerMonth ?? null,
          confirmedCapacityPerMonth: input.confirmedCapacity?.[line.supplierLogicalId] ?? null,
          /** Cents for 1 base unit: paid, or quoted for a lead. */
          price: ex(priceOf(line)),
          /** price ÷ local retail median − 1; negative means below the market. */
          vsMarket: vsMarketOf(priceOf(line)),
          plannedVolume: plan.allocations.find((a) => a.supplierLogicalId === line.supplierLogicalId)?.volume ?? 0,
          /** What we buy from it a month: the whole need when it is the food's only current supplier; else unknown. */
          usedPerMonth: line.batchCount > 0 && lines.filter((l) => l.batchCount > 0).length === 1 ? need : null,
          ...offer(line.route, priceOf(line), capacityOf(line)),
          bid: null as null | { readonly bidId: string; readonly deliveryArea: string; readonly earliestStart: string; readonly note: string | null },
        }))
        .concat(
          bids.map((bid) => ({
            supplierLogicalId: bidSupplierId(bid.bidId),
            name: bid.businessName,
            role: "BID",
            route: "LOCAL",
            batchCount: 0,
            eligibility: "BID",
            quotedCentsPer1000: bid.priceCentsPer1000,
            lowExact: null,
            highExact: null,
            unconfirmedFailures: 0,
            claimedCapacityPerMonth: bid.quantityPerMonth,
            confirmedCapacityPerMonth: input.confirmedCapacity?.[bidSupplierId(bid.bidId)] ?? null,
            price: exactText(bidPrice(bid)),
            vsMarket: vsMarketOf(bidPrice(bid)),
            plannedVolume: plan.allocations.find((a) => a.supplierLogicalId === bidSupplierId(bid.bidId))?.volume ?? 0,
            usedPerMonth: null as number | null,
            ...offer("LOCAL", bidPrice(bid), bidCapacity(bid)),
            bid: { bidId: bid.bidId, deliveryArea: bid.deliveryArea, earliestStart: bid.earliestStart, note: bid.note },
          })),
        )
        // The supplier list: the biggest saving first; a supplier without a known net cost last.
        .sort((a, b) => {
          if (a.netPerMonth === null || b.netPerMonth === null) return Number(a.netPerMonth === null) - Number(b.netPerMonth === null) || a.supplierLogicalId.localeCompare(b.supplierLogicalId);
          return compare(parseExactText(a.netPerMonth), parseExactText(b.netPerMonth)) || Number(a.role !== "CURRENT") - Number(b.role !== "CURRENT") || a.supplierLogicalId.localeCompare(b.supplierLogicalId);
        }),
    };
  });

  const recs = recommendations({
    meals: input.meals.map((meal) => ({ mealId: meal.mealId, name: meal.name, recipe: meal.recipe, servingsPerMonth: meal.servingsPerMonth, group: groupOf(meal.group) })),
    ingredients: foods.map((commodity) => {
      const local = market(commodity, "LOCAL");
      return {
        commodity,
        lines: input.lines.filter((line) => line.commodity === commodity),
        needPerMonth: input.meals.reduce((total, meal) => total + meal.servingsPerMonth * (meal.recipe.find((item) => item.commodity === commodity)?.quantity ?? 0), 0),
        marketVolumePerMonth: input.commodities?.find((c) => c.commodity === commodity)?.marketVolumePerMonth ?? null,
        marketLocalMicros: local === null ? null : parseExactText(local.lastMedianMicros),
        marketLocalChange: local?.change === null || local === null ? null : parseExactText(local.change),
      };
    }),
  }).map((recommendation) => ({ ...recommendation, investigation: investigationFor(recommendation, input.investigations) }));

  // The country's cost: Σ servings × cost of each meal, and the cost of the average meal.
  const servings = input.meals.reduce((total, meal) => total + meal.servingsPerMonth, 0);
  let low: Fraction | null = frac(0n);
  let high: Fraction | null = frac(0n);
  let basis: "PAID" | "QUOTE" | "UNKNOWN" = "PAID";
  for (const meal of input.meals) {
    const cost = recipeCost(meal.recipe, costs);
    if (cost.low === null || cost.high === null || low === null || high === null) {
      low = null;
      high = null;
      basis = "UNKNOWN";
      break;
    }
    const n = fromSafeInteger(meal.servingsPerMonth, "servings");
    low = add(low, mul(cost.low, n));
    high = add(high, mul(cost.high, n));
    if (cost.basis === "QUOTE") basis = "QUOTE";
  }
  const perMeal = (value: Fraction | null) => (value === null || servings === 0 ? null : div(value, fromSafeInteger(servings, "servings")));
  let worst: { readonly nutrient: Nutrient; readonly coverage: Fraction; readonly mealId: string } | null = null;
  for (const meal of input.meals) {
    for (const n of recipeNutrition(meal.recipe, groupOf(meal.group))) {
      if (worst === null || compare(n.coverage, worst.coverage) < 0) worst = { nutrient: n.nutrient, coverage: n.coverage, mealId: meal.mealId };
    }
  }
  const activityIds = [...new Set(input.meals.map((meal) => meal.activity ?? "SCHOOL_MEALS"))];
  const activities = activityIds.map((activity) => {
    const rations = input.meals.filter((meal) => (meal.activity ?? "SCHOOL_MEALS") === activity);
    const people = Math.max(0, ...rations.map((meal) => meal.beneficiaries ?? (activity === "SCHOOL_MEALS" ? input.country.students : 0)));
    let aLow: Fraction | null = frac(0n);
    let aHigh: Fraction | null = frac(0n);
    for (const meal of rations) {
      const cost = recipeCost(meal.recipe, costs);
      if (cost.low === null || cost.high === null || aLow === null || aHigh === null) {
        aLow = null;
        aHigh = null;
        break;
      }
      const n = fromSafeInteger(meal.servingsPerMonth, "servings");
      aLow = add(aLow, mul(cost.low, n));
      aHigh = add(aHigh, mul(cost.high, n));
    }
    return {
      activity,
      name: ACTIVITY_NAME[activity] ?? activity,
      beneficiaries: people,
      rationsPerMonth: rations.reduce((total, meal) => total + meal.servingsPerMonth, 0),
      monthlyCost: { low: ex(aLow), high: ex(aHigh) },
    };
  });
  const people = activities.reduce((total, a) => total + a.beneficiaries, 0);
  // A new program has delivered nothing yet: its caseload is a plan, and it has reached no one.
  const started = input.country.status !== "NEW";
  // P13: where each food stands in the sourcing workflow, and what needs a person next (P14).
  const pipeline = ingredients.map((ingredient) => ({
    ...foodStep({
      commodity: ingredient.commodity,
      foodName: FOOD_NAME[ingredient.commodity] ?? ingredient.commodity.toLowerCase(),
      suppliers: ingredient.suppliers,
      baselineCentsPerUnit: ingredient.baseline?.centsPerUnit ?? null,
      planNet: ingredient.sourcing.netTotalPerMonth,
      needPerMonth: ingredient.needPerMonth,
      safeLocalPerMonth: ingredient.sourcing.safeLocalPerMonth,
      baselineKind: ingredient.baseline?.kind ?? null,
      investigations: input.investigations,
    }),
    needPerMonth: ingredient.needPerMonth,
    hasSupplier: ingredient.suppliers.some((s) => s.role === "CURRENT"),
  }));
  const steps = countrySteps({
    steps: pipeline,
    foodNames: FOOD_NAME,
    offersToReview: (input.bids ?? []).filter((bid) => bid.status === "SUBMITTED").length,
    investigations: input.investigations,
    costPerRation: ex(perMeal(low)),
    recommendations: recs,
  });
  const perPerson = (value: Fraction | null) => (value === null || people === 0 ? null : div(value, fromSafeInteger(people, "people")));
  const count = (severity: string) => recs.filter((r) => r.severity === severity).length;
  const current = new Set(input.lines.filter((line) => line.batchCount > 0).map((line) => line.supplierLogicalId));
  const leads = new Set(input.lines.filter((line) => line.batchCount === 0).map((line) => line.supplierLogicalId));

  return {
    country: input.country,
    evidenceRevision: input.evidenceRevision,
    summary: {
      started,
      peopleReached: started ? people : 0,
      peoplePlanned: people,
      activities,
      costPerPersonMonth: { low: ex(perPerson(low)), high: ex(perPerson(high)), basis },
      mealsPerMonth: servings,
      costPerMeal: { low: ex(perMeal(low)), high: ex(perMeal(high)), basis },
      monthlyCost: { low: ex(low), high: ex(high), basis },
      worstNutrition: worst === null ? null : { nutrient: worst.nutrient, coverage: exactText(worst.coverage), mealId: worst.mealId },
      recommendations: { HIGH: count("HIGH"), MEDIUM: count("MEDIUM"), LOW: count("LOW") },
      topRecommendation: recs[0]?.title ?? null,
      investigations: {
        open: input.investigations.filter((i) => i.status === "OPEN").length,
        scheduled: input.investigations.filter((i) => i.status === "SCHEDULED").length,
      },
      currentSuppliers: current.size,
      leads: leads.size,
      foods: foods.length,
      foodsSourced: pipeline.filter((step) => step.hasSupplier).length,
      /** P17: the recommended actions of the program; the map is colored by their count. */
      steps: steps.length,
      topStep: steps[0]?.title ?? null,
      bidsToReview: (input.bids ?? []).filter((bid) => bid.status === "SUBMITTED").length,
    },
    meals,
    ingredients,
    pipeline,
    steps,
    /** The order of the step groups: a program that delivers nothing leads with what starts the meals. */
    stepGroups: started ? STEP_GROUPS : (["MEALS", "COST", "SUPPLIERS"] as const),
    recommendations: recs,
    investigations: input.investigations,
    /** Offers from the supplier site that wait for a person (P10). */
    bidsToReview: (input.bids ?? []).filter((bid) => bid.status === "SUBMITTED").map((bid) => ({ ...bid, preview: previews.get(bid.bidId) ?? null })),
  };
}

export type CountryView = ReturnType<typeof countryView>;

/** P16: 1 food of the country view, as the visit brief and the booking recommendation read it. */
export function foodForAi(ingredient: CountryView["ingredients"][number]): FoodForAi {
  const { market, sourcing } = ingredient;
  return {
    commodity: ingredient.commodity,
    unit: ingredient.commodity === "OIL" ? "L" : "kg",
    needPerMonth: ingredient.needPerMonth,
    marketVolumePerMonth: sourcing.marketVolumePerMonth,
    safeLocalPerMonth: sourcing.safeLocalPerMonth,
    shareIfAllLocal: sourcing.shareIfAllLocal,
    localMedian: market.local === null ? null : { centsPerUnit: exactText(centsPerUnitFromMicros(market.local.lastMedianMicros)), change: market.local.change, lastMonth: market.local.lastMonth },
    importMedian: market.import === null ? null : { centsPerUnit: exactText(centsPerUnitFromMicros(market.import.lastMedianMicros)), lastMonth: market.import.lastMonth },
    baseline: ingredient.baseline,
    suppliers: ingredient.suppliers,
  };
}

/** P18: the program in 1 or 2 sentences for the AI analysis, with the same figures the page shows. */
export function analysisFacts(view: CountryView): string {
  const s = view.summary;
  const people = s.started ? `${s.peopleReached.toLocaleString("en-US")} people reached` : `a new program: 0 people reached, ${s.peoplePlanned.toLocaleString("en-US")} planned, nothing delivered yet`;
  const cost = s.monthlyCost.low === null ? "" : `; food costs ${usdWhole(parseExactText(s.monthlyCost.low))} a month${s.monthlyCost.basis === "QUOTE" ? " (from quotes, nothing is bought yet)" : ""}`;
  const more = view.steps.find((step) => step.id === "MORE_RATIONS");
  return `${view.country.name} (${view.country.region}): ${people}; ${s.foodsSourced} of ${s.foods} foods have a supplier${cost}.${more === undefined ? "" : ` ${more.title}: ${more.detail}`}`;
}
