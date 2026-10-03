import { describe, expect, it } from "vitest";
import { exactText, formatFixed, frac, mul } from "./fraction.js";
import { localSourcingPlan, parseRecipe, recipeCost, recipeNutrition, recommendations, unitCosts, type PortfolioLine } from "./portfolio.js";

const ANDROY = [
  { commodity: "RICE", quantity: 100 },
  { commodity: "BEANS", quantity: 30 },
  { commodity: "OIL", quantity: 10 },
];

const line = (over: Partial<PortfolioLine>): PortfolioLine => ({
  supplierLogicalId: "x:SUP",
  commodity: "RICE",
  supplierLowExact: null,
  supplierHighExact: null,
  batchCount: 0,
  unconfirmedFailures: 0,
  quotedCentsPer1000: null,
  eligibility: "LEAD",
  ...over,
});

describe("recipeNutrition", () => {
  it("adds each food's nutrients and compares them with 30% of the daily reference", () => {
    const result = recipeNutrition(ANDROY);
    const by = Object.fromEntries(result.map((r) => [r.nutrient, r]));
    // Energy: 365 + 337 × 0.3 + 813 × 0.1 = 547.4 kcal against 1,750 × 30% = 525 kcal.
    expect(exactText(by.ENERGY!.amount)).toBe("2737/5");
    expect(exactText(by.ENERGY!.target)).toBe("525/1");
    // Vitamin A comes only from the fortified oil: 55 µg against 150 µg.
    expect(formatFixed(mul(by.VITAMIN_A!.coverage, frac(100n)), 1)).toBe("36.7");
  });

  it("measures a general ration against the whole-population reference, at 100%", () => {
    // Maize 420 g, beans 60 g, oil 25 ml, Super Cereal 50 g: 1,520.4 + 202.2 + 203.25 + 190 = 2,115.85 kcal of 2,100.
    const energy = recipeNutrition(
      [
        { commodity: "MAIZE", quantity: 420 },
        { commodity: "BEANS", quantity: 60 },
        { commodity: "OIL", quantity: 25 },
        { commodity: "CSB", quantity: 50 },
      ],
      "GENERAL_POPULATION",
    ).find((n) => n.nutrient === "ENERGY")!;
    expect(formatFixed(energy.amount, 2)).toBe("2115.85");
    expect(exactText(energy.target)).toBe("2100/1");
    // Super Cereal 100 g for a young child: 380 kcal against 50% of 800 kcal.
    expect(formatFixed(recipeNutrition([{ commodity: "CSB", quantity: 100 }], "YOUNG_CHILD")[0]!.coverage, 2)).toBe("0.95");
  });

  it("refuses an unknown food or a fractional quantity", () => {
    expect(() => parseRecipe('[{"commodity":"CAKE","quantity":10}]')).toThrow("unknown food");
    expect(() => parseRecipe('[{"commodity":"RICE","quantity":1.5}]')).toThrow("whole quantity");
    expect(parseRecipe('[{"commodity":"RICE","quantity":100}]')).toEqual([{ commodity: "RICE", quantity: 100 }]);
  });
});

describe("unitCosts and recipeCost", () => {
  it("uses the supplier with the most batches, and the lowest quote only when nothing is paid", () => {
    const costs = unitCosts([
      line({ supplierLogicalId: "x:SUP-A", supplierLowExact: "11/250", supplierHighExact: "143/2500", batchCount: 6 }),
      line({ supplierLogicalId: "x:SUP-Z", supplierLowExact: "1/10", supplierHighExact: "1/10", batchCount: 1 }),
      line({ supplierLogicalId: "x:SUP-L1", quotedCentsPer1000: 51 }),
      line({ supplierLogicalId: "x:SUP-B1", commodity: "BEANS", quotedCentsPer1000: 60 }),
      line({ supplierLogicalId: "x:SUP-B2", commodity: "BEANS", quotedCentsPer1000: 55 }),
    ]);
    expect(costs.get("RICE")).toMatchObject({ basis: "PAID", supplierLogicalId: "x:SUP-A" });
    expect(costs.get("BEANS")).toMatchObject({ basis: "QUOTE", supplierLogicalId: "x:SUP-B2" });
    expect(exactText(costs.get("BEANS")!.low)).toBe("11/200");
  });

  it("sums grams × cents per gram, and says which foods have no cost", () => {
    const costs = unitCosts([line({ supplierLowExact: "11/250", supplierHighExact: "143/2500", batchCount: 6 }), line({ commodity: "BEANS", quotedCentsPer1000: 50 })]);
    const cost = recipeCost(ANDROY.slice(0, 2), costs);
    // Rice 100 g × 0.044 = 4.4 to 5.72 cents; beans 30 g × 0.05 = 1.5 cents (quoted).
    expect(formatFixed(cost.low!, 2)).toBe("5.90");
    expect(formatFixed(cost.high!, 2)).toBe("7.22");
    expect(cost.basis).toBe("QUOTE");
    expect(recipeCost(ANDROY, costs)).toMatchObject({ basis: "UNKNOWN", missing: ["OIL"] });
  });
});

describe("recommendations", () => {
  it("flags a price above the local market, a cheaper lead, a single supplier, and an unconfirmed failure", () => {
    const recs = recommendations({
      meals: [{ mealId: "M1", name: "Rice with beans", recipe: ANDROY }],
      ingredients: [
        {
          commodity: "RICE",
          // 0.60 $/kg paid against a 0.50 $/kg market: 20% above.
          lines: [line({ supplierLogicalId: "x:SUP-A", supplierLowExact: "3/50", supplierHighExact: "3/50", batchCount: 4, unconfirmedFailures: 1 }), line({ supplierLogicalId: "x:SUP-L1", quotedCentsPer1000: 50 })],
          marketLocalMicros: frac(500_000n),
          marketLocalChange: frac(14n, 100n),
        },
      ],
    });
    const kinds = recs.map((r) => r.kind);
    expect(kinds).toEqual(expect.arrayContaining(["PRICE_ABOVE_MARKET", "CHEAPER_LEAD", "SINGLE_SUPPLIER", "UNCONFIRMED_FAILURE", "MARKET_RISING", "NUTRITION_GAP"]));
    const price = recs.find((r) => r.kind === "PRICE_ABOVE_MARKET")!;
    expect(price.title).toBe("Rice costs 20% more than the local market");
    expect(price.severity).toBe("MEDIUM");
    expect(recs.find((r) => r.kind === "CHEAPER_LEAD")!.title).toBe("SUP-L1 quotes 17% below what we pay for rice");
    // The fortified oil is the densest vitamin A source: 95 µg missing ÷ 5.5 µg per ml = 17.3, so 18 ml.
    const vitaminA = recs.find((r) => r.id === "NUTRITION_GAP:VITAMIN_A")!;
    expect(vitaminA.title).toBe("Vitamin A below target in 1 of 1 ration");
    expect(vitaminA.detail).toBe("Lowest: Rice with beans at 37% of 150.0 µg. Adding 18 ml of vegetable oil would meet it.");
  });

  it("suggests no single food when closing the gap would take more than a normal serving", () => {
    const recs = recommendations({
      meals: [{ mealId: "G1", name: "General ration", group: "GENERAL_POPULATION", recipe: [{ commodity: "RICE", quantity: 400 }, { commodity: "BEANS", quantity: 60 }, { commodity: "OIL", quantity: 25 }, { commodity: "CSB", quantity: 50 }] }],
      ingredients: [],
    });
    // Iron: 3.2 + 4.02 + 3.25 = 10.47 mg of 32 mg. Beans would need 322 g, lentils and Super Cereal 332 g: all past 100 g.
    expect(recs.find((r) => r.id === "NUTRITION_GAP:IRON")!.detail).toBe(
      "Lowest: General ration at 33% of 32.0 mg. No single food closes it in a normal serving; a fortified food or micronutrient powder is the usual fix.",
    );
    // Zinc: 4.4 + 1.68 + 2.5 = 8.58 mg of 12.4 mg. Super Cereal is the densest source: 3.82 ÷ 0.05 = 76.4, so 77 g.
    expect(recs.find((r) => r.id === "NUTRITION_GAP:ZINC")!.detail).toBe("Lowest: General ration at 69% of 12.4 mg. Adding 77 g of Super Cereal would meet it.");
  });

  it("asks for a supplier where nothing is paid, pointing at the cheapest lead that claims enough", () => {
    const recs = recommendations({
      meals: [],
      ingredients: [
        {
          commodity: "RICE",
          needPerMonth: 10_000_000,
          lines: [line({ supplierLogicalId: "m:SUP-L3", quotedCentsPer1000: 49, claimedCapacityPerMonth: 2_000_000 }), line({ supplierLogicalId: "m:SUP-L2", quotedCentsPer1000: 50, claimedCapacityPerMonth: 20_000_000 })],
          marketLocalMicros: null,
          marketLocalChange: null,
        },
      ],
    });
    expect(recs[0]).toMatchObject({ kind: "NO_SUPPLIER", action: { supplierLogicalId: "m:SUP-L2" } });
    expect(recs[0]!.detail).toBe("2 leads quoted, 0 passed a field visit. Lowest unchecked quote with enough capacity: SUP-L2 at 0.50 $/kg. It claims 20,000 kg a month against a need of 10,000.");
  });

  it("asks for a supplier where nothing is paid, pointing at the lowest unchecked quote", () => {
    const recs = recommendations({
      meals: [],
      ingredients: [{ commodity: "BEANS", lines: [line({ supplierLogicalId: "m:SUP-B1", commodity: "BEANS", quotedCentsPer1000: 62 }), line({ supplierLogicalId: "m:SUP-B2", commodity: "BEANS", quotedCentsPer1000: 58 })], marketLocalMicros: null, marketLocalChange: null }],
    });
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ kind: "NO_SUPPLIER", severity: "HIGH", action: { type: "INVESTIGATE_SUPPLIER", supplierLogicalId: "m:SUP-B2" } });
    expect(recs[0]!.detail).toBe("2 leads quoted, 0 passed a field visit. Lowest unchecked quote: SUP-B2 at 0.58 $/kg.");
  });

  it("stays quiet within the thresholds", () => {
    const recs = recommendations({
      meals: [],
      ingredients: [{ commodity: "RICE", lines: [line({ supplierLowExact: "1/20", supplierHighExact: "1/20", batchCount: 3 }), line({ supplierLogicalId: "x:B", supplierLowExact: "1/20", supplierHighExact: "1/20", batchCount: 2 })], marketLocalMicros: frac(480_000n), marketLocalChange: frac(5n, 100n) }],
    });
    expect(recs).toEqual([]);
  });
});

describe("localSourcingPlan", () => {
  it("fills the safe local volume (10% of the market) cheapest first, each up to its capacity, and imports the rest", () => {
    const plan = localSourcingPlan({
      needPerMonth: 3_120_000,
      marketVolumePerMonth: 22_000_000,
      candidates: [
        { supplierLogicalId: "m:SUP-L9", route: "LOCAL", centsPerUnit: frac(111n, 1000n), capacityPerMonth: 5_000_000 },
        { supplierLogicalId: "m:SUP-L8", route: "LOCAL", centsPerUnit: frac(96n, 1000n), capacityPerMonth: 1_500_000 },
        { supplierLogicalId: "m:SUP-I1", route: "IMPORT", centsPerUnit: frac(80n, 1000n), capacityPerMonth: null },
      ],
    });
    // Safe: 2,200,000 g. SUP-L8 (cheapest local) gives its 1,500,000; SUP-L9 the remaining 700,000; import 920,000.
    expect(plan.safeLocalPerMonth).toBe(2_200_000);
    expect(plan.allocations).toEqual([
      { supplierLogicalId: "m:SUP-L8", volume: 1_500_000 },
      { supplierLogicalId: "m:SUP-L9", volume: 700_000 },
    ]);
    expect(plan).toMatchObject({ localTotal: 2_200_000, importNeeded: 920_000 });
    expect(exactText(plan.shareIfAllLocal!)).toBe("39/275");
  });

  it("buys everything locally when the need is small next to the market", () => {
    const plan = localSourcingPlan({ needPerMonth: 1000, marketVolumePerMonth: 1_000_000, candidates: [{ supplierLogicalId: "x", route: "LOCAL", centsPerUnit: frac(1n), capacityPerMonth: null }] });
    expect(plan).toMatchObject({ localTotal: 1000, importNeeded: 0, safeLocalPerMonth: 100_000 });
  });

  it("recommends a limit when buying all of a food locally would pass the 10% line", () => {
    const recs = recommendations({
      meals: [{ mealId: "M1", name: "Beans", recipe: [{ commodity: "BEANS", quantity: 30 }], servingsPerMonth: 104_000 }],
      ingredients: [{ commodity: "BEANS", lines: [], marketLocalMicros: null, marketLocalChange: null, needPerMonth: 3_120_000, marketVolumePerMonth: 22_000_000 }],
    });
    const limit = recs.find((r) => r.kind === "LOCAL_MARKET_LIMIT")!;
    expect(limit.title).toBe("Buying all the beans locally would be 14% of the local market");
    expect(limit.detail).toBe("Above the 10% line, our buying would push local prices up. Up to about 2,200 kg a month locally; import the other 920 kg.");
  });
});
