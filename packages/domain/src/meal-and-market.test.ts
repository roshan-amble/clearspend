import { describe, expect, it } from "vitest";
import { formatFixed, frac } from "./fraction.js";
import { marketPressure, median, monthlyMedians, relativeChange } from "./market.js";
import { mealCost, type IngredientPrice, type RationItem } from "./meal.js";
import { between, point } from "./range.js";

const RATION: readonly RationItem[] = [
  { commodity: "RICE", unit: "g", quantityPerMeal: 100 },
  { commodity: "BEANS", unit: "g", quantityPerMeal: 30 },
  { commodity: "OIL", unit: "ml", quantityPerMeal: 10 },
];

describe("mealCost (D11, breakdown by ingredient)", () => {
  const prices = new Map<string, IngredientPrice>([
    ["RICE", { unit: "g", centsPerUnit: between(frac(1n, 10n), frac(104n, 1000n)) }],
    ["BEANS", { unit: "g", centsPerUnit: point(frac(1n, 5n)) }],
    ["OIL", { unit: "ml", centsPerUnit: point(frac(3n, 20n)) }],
  ]);

  it("sums each ingredient's share, and keeps a range where a cost is a range", () => {
    const cost = mealCost(RATION, prices);

    expect(formatFixed(cost.total.low, 1)).toBe("17.5");
    expect(formatFixed(cost.total.high, 1)).toBe("17.9");
    expect(cost.byIngredient.map((item) => [item.commodity, formatFixed(item.cents.low, 2)])).toEqual([
      ["RICE", "10.00"],
      ["BEANS", "6.00"],
      ["OIL", "1.50"],
    ]);
  });

  it("refuses to mix units: oil priced for grams is an error, not a conversion", () => {
    const wrongUnit = new Map(prices).set("OIL", { unit: "g", centsPerUnit: point(frac(3n, 20n)) });

    expect(() => mealCost(RATION, wrongUnit)).toThrowError(/measured in ml/);
  });

  it("refuses a missing price instead of treating it as free", () => {
    const missing = new Map(prices);
    missing.delete("BEANS");

    expect(() => mealCost(RATION, missing)).toThrowError(/No price for BEANS/);
  });
});

describe("market indicator (C8)", () => {
  it("takes the exact median across markets, including an even count", () => {
    expect(median([3n, 1n, 2n])).toEqual(frac(2n));
    expect(median([4n, 1n, 3n, 2n])).toEqual(frac(5n, 2n));
    expect(() => median([])).toThrowError(/median of no values/);
  });

  it("groups by month in time order, for 1 series only", () => {
    const medians = monthlyMedians(
      [
        { market: "M1", series: "Rice (local)", month: "2026-08", usdMicros: 810_000n },
        { market: "M1", series: "Rice (local)", month: "2025-09", usdMicros: 700_000n },
        { market: "M2", series: "Rice (local)", month: "2025-09", usdMicros: 720_000n },
        { market: "M1", series: "Rice (imported)", month: "2025-09", usdMicros: 1n },
      ],
      "Rice (local)",
    );

    expect([...medians.keys()]).toEqual(["2025-09", "2026-08"]);
    expect(medians.get("2025-09")).toEqual(frac(710_000n));
  });

  it("measures the Androy local rice change, 0.71 to 0.81, as +14.1%", () => {
    const change = relativeChange(frac(710_000n), frac(810_000n));

    expect(formatFixed(change, 3)).toBe("0.141");
  });

  it("gives 2.5% for the brief's example, below the 10% threshold, and flags at exactly 10%", () => {
    const low = marketPressure({ plannedPerMonth: 10_000, marketVolumeEstimatePerMonth: 400_000 });
    const atThreshold = marketPressure({ plannedPerMonth: 40_000, marketVolumeEstimatePerMonth: 400_000 });

    expect(low).toEqual({ share: frac(1n, 40n), flagged: false });
    expect(atThreshold.flagged).toBe(true);
    expect(() => marketPressure({ plannedPerMonth: 1, marketVolumeEstimatePerMonth: 0 })).toThrowError(
      /must be positive/,
    );
  });
});
