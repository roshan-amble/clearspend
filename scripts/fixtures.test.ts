import {
  compare,
  computeCostLine,
  div,
  formatFixed,
  frac,
  marketPressure,
  mealCost,
  median,
  mul,
  parseDecimalScaled,
  quotedCentsPerUnit,
  relativeChange,
  type Cause,
  type Fraction,
  type IngredientPrice,
  type Range,
  type RationItem,
} from "@clearspend/domain";
import { describe, expect, it } from "vitest";
import { field, intField, readCsv } from "./lib/csv.js";
import { costIncidents, costPurchases, loadFixtures } from "./lib/fixtures.js";
import { MARKET_REGION } from "./lib/market-series.js";
import { HDX_SOURCE_FILE } from "./lib/paths.js";

const set = loadFixtures();
const market = readCsv(HDX_SOURCE_FILE).filter((row) => row.admin1 === MARKET_REGION && row.pricetype === "Retail");

/** 1 US cent is 10,000 micro-dollars. */
const MICROS_PER_CENT = 10_000n;

function medianMicros(series: string, month: string): Fraction {
  const values = market
    .filter((row) => row.commodity === series && (row.date ?? "").startsWith(month))
    .map((row) => parseDecimalScaled(field(row, "usdprice", "HDX"), 6));
  return median(values);
}

function marketSeriesFor(supplierId: string, commodity: string): string {
  const supplier = set.suppliers.find((row) => row.supplier_id === supplierId);
  const item = set.commodities.find((row) => row.commodity === commodity);
  if (supplier === undefined || item === undefined) throw new Error(`Unknown ${supplierId} or ${commodity}.`);
  const column = supplier.route === "IMPORT" ? "market_series_import" : "market_series_local";
  return field(item, column, "expansion-commodities.csv");
}

/** D11 calibration rule: 60% ≤ synthetic price ÷ real retail median ≤ 100%, for the same series and month. */
function calibrationShare(centsPerUnit: number, series: string, month: string): Fraction {
  return div(frac(BigInt(centsPerUnit) * MICROS_PER_CENT), medianMicros(series, month));
}

const RATION: RationItem[] = set.commodities.map((row) => ({
  commodity: field(row, "commodity", "expansion-commodities.csv"),
  unit: field(row, "unit", "expansion-commodities.csv") === "ml" ? "ml" : "g",
  quantityPerMeal: intField(row, "quantity_per_meal", "expansion-commodities.csv"),
}));

function line(supplierId: string, commodity: string, confirmed: Readonly<Record<string, Cause>>) {
  return computeCostLine({
    supplierId,
    commodity,
    purchases: costPurchases(set),
    incidents: costIncidents(set, confirmed),
  });
}

function perMeal(centsPerUnit: Fraction, commodity: string): string {
  const item = RATION.find((candidate) => candidate.commodity === commodity);
  if (item === undefined) throw new Error(`No ration item ${commodity}.`);
  return formatFixed(mul(centsPerUnit, frac(BigInt(item.quantityPerMeal))), 1);
}

function perMealRange(range: Range | null, commodity: string): string {
  if (range === null) throw new Error("expected a range");
  return `${perMeal(range.low, commodity)}–${perMeal(range.high, commodity)}`;
}

describe("fixtures: referential integrity", () => {
  const orderIds = new Set(set.orders.map((row) => row.order_id));
  const supplierIds = new Set(set.suppliers.map((row) => row.supplier_id));
  const incidentIds = new Set(set.incidents.map((incident) => incident.incident_id));

  it("every payment, invoice, delivery, and incident refers to an existing order", () => {
    const refs = [...set.payments, ...set.invoices, ...set.deliveries].map((row) => row.order_id);
    expect(refs.filter((id) => !orderIds.has(id ?? ""))).toEqual([]);
    expect(set.incidents.filter((incident) => !orderIds.has(incident.order_id))).toEqual([]);
  });

  it("every order, profile, and field verification refers to an existing supplier", () => {
    const refs = [
      ...set.orders.map((row) => row.supplier_id),
      ...set.profiles.map((profile) => profile.supplier_id),
      ...set.verificationsInitial.map((row) => row.supplier_id),
      ...set.verificationsLater.map((row) => row.supplier_id),
    ];
    expect(refs.filter((id) => !supplierIds.has(id ?? ""))).toEqual([]);
  });

  it("every supplier profile text states the same price as its quote field, in English or French format", () => {
    const drift = set.profiles.filter((profile) => {
      const dollars = (profile.quoted_price_cents_per_kg / 100).toFixed(2);
      return !profile.text.includes(dollars) && !profile.text.includes(dollars.replace(".", ","));
    });
    expect(drift.map((profile) => profile.supplier_id)).toEqual([]);
  });

  it("every replacement names an existing order, and an existing incident when it names one", () => {
    for (const order of set.orders.filter((row) => row.replaces_order_id !== "")) {
      expect(orderIds.has(order.replaces_order_id ?? "")).toBe(true);
      if (order.replaces_incident_id !== "") expect(incidentIds.has(order.replaces_incident_id ?? "")).toBe(true);
    }
  });
});

describe("fixtures: the D11 calibration rule against real Androy prices", () => {
  const low = frac(6n, 10n);
  const high = frac(1n);

  it.each(set.orders.map((row) => [row.order_id, row] as const))("order %s is 60% to 100% of the retail median", (_, row) => {
    const share = calibrationShare(
      intField(row, "unit_price_cents", "orders.csv"),
      marketSeriesFor(field(row, "supplier_id", "orders.csv"), field(row, "commodity", "orders.csv")),
      field(row, "recorded_at", "orders.csv").slice(0, 7),
    );
    expect(compare(share, low)).toBeGreaterThanOrEqual(0);
    expect(compare(share, high)).toBeLessThanOrEqual(0);
  });

  it.each(set.profiles.map((profile) => [profile.supplier_id, profile] as const))(
    "quote of %s is 60% to 100% of the retail median",
    (_, profile) => {
      const share = calibrationShare(
        profile.quoted_price_cents_per_kg,
        marketSeriesFor(profile.supplier_id, profile.commodity),
        profile.submitted_at.slice(0, 7),
      );
      expect(compare(share, low)).toBeGreaterThanOrEqual(0);
      expect(compare(share, high)).toBeLessThanOrEqual(0);
    },
  );
});

describe("fixtures: the demo story numbers (brief section 4, recalibrated)", () => {
  it("while INC-A4 is unconfirmed: rice nominal 4.4, supplier 5.5–5.7, route 5.7 cents for each meal", () => {
    const rice = line("SUP-A", "RICE", {});

    expect(perMeal(rice.nominal as Fraction, "RICE")).toBe("4.4");
    expect(perMealRange(rice.supplier, "RICE")).toBe("5.5–5.7");
    expect(perMealRange(rice.route, "RICE")).toBe("5.7–5.7");
    expect(rice.excluded).toEqual([{ orderId: "PO-A5", status: "INCOMPLETE" }]);
    expect(rice.batches).toBe(6);
  });

  it("confirmed as transport after handover: supplier 5.5, route 5.7", () => {
    const rice = line("SUP-A", "RICE", { "INC-A4": "TRANSPORT_AFTER_HANDOVER" });

    expect(perMealRange(rice.supplier, "RICE")).toBe("5.5–5.5");
    expect(perMealRange(rice.route, "RICE")).toBe("5.7–5.7");
  });

  it("the full meal costs 8.8 cents in the supplier view and 9.1 in the route view, split by ingredient", () => {
    const confirmed = { "INC-A4": "TRANSPORT_AFTER_HANDOVER" } as const;
    const lines = { RICE: line("SUP-A", "RICE", confirmed), BEANS: line("SUP-B", "BEANS", confirmed), OIL: line("SUP-O", "OIL", confirmed) };
    const view = (pick: "supplier" | "route") =>
      new Map<string, IngredientPrice>(
        Object.entries(lines).map(([commodity, costLine]) => {
          const range = costLine[pick];
          if (range === null) throw new Error(`No ${pick} cost for ${commodity}.`);
          return [commodity, { unit: commodity === "OIL" ? "ml" : "g", centsPerUnit: range }] as const;
        }),
      );

    const supplierMeal = mealCost(RATION, view("supplier"));
    const routeMeal = mealCost(RATION, view("route"));

    expect(formatFixed(supplierMeal.total.low, 1)).toBe("8.8");
    expect(formatFixed(routeMeal.total.low, 1)).toBe("9.1");
    expect(supplierMeal.byIngredient.map((item) => [item.commodity, formatFixed(item.cents.low, 2)])).toEqual([
      ["RICE", "5.50"],
      ["BEANS", "1.44"],
      ["OIL", "1.90"],
    ]);
  });

  it("the best local lead, SUP-L1, quotes 5.1 cents of rice for each meal, with 0 batches of history", () => {
    const l1 = set.profiles.find((profile) => profile.supplier_id === "SUP-L1");

    expect(perMeal(quotedCentsPerUnit(l1?.quoted_price_cents_per_kg ?? -1), "RICE")).toBe("5.1");
    expect(line("SUP-L1", "RICE", {}).failureRisk).toBe("UNKNOWN");
  });

  it("market pressure is 2.5% for rice and 5% for beans and oil, all below the 10% flag", () => {
    const shares = set.commodities.map((row) =>
      marketPressure({
        plannedPerMonth: intField(row, "planned_per_month", "expansion-commodities.csv"),
        marketVolumeEstimatePerMonth: intField(row, "market_volume_estimate_per_month", "expansion-commodities.csv"),
      }),
    );

    expect(shares.map((share) => [formatFixed(mul(share.share, frac(100n)), 1), share.flagged])).toEqual([
      ["2.5", false],
      ["5.0", false],
      ["5.0", false],
    ]);
  });

  it("real Androy local rice rose 14.1% from 2025-09 to 2026-08", () => {
    const change = relativeChange(medianMicros("Rice (local)", "2025-09"), medianMicros("Rice (local)", "2026-08"));

    expect(formatFixed(mul(change, frac(100n)), 1)).toBe("14.1");
  });
});
