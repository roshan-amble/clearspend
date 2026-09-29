import { describe, expect, it } from "vitest";
import { HERO, KG, ricePurchase } from "./__fixtures__/hero.js";
import { computeCostLine, costPurchaseFrom, quotedCentsPerUnit, type CostIncident, type CostPurchase } from "./cost.js";
import { formatFixed, frac, mul, type Fraction } from "./fraction.js";
import { reconcilePurchase, type PurchaseEvidence } from "./reconcile.js";
import type { Range } from "./range.js";
import type { Cause } from "./types.js";

function toCostPurchases(evidence: readonly PurchaseEvidence[]): CostPurchase[] {
  return evidence.map((item) =>
    costPurchaseFrom(item, reconcilePurchase(item), HERO.supplierId, HERO.replaces[item.order.id]),
  );
}

const heroPurchases = toCostPurchases(Object.values(HERO.purchases));

function heroLine(causeOfA4: Cause | null) {
  const incidents: CostIncident[] = [{ ...HERO.incidentA4, cause: causeOfA4 }];
  return computeCostLine({ supplierId: HERO.supplierId, commodity: "RICE", purchases: heroPurchases, incidents });
}

/** Cents for 1 meal of 100 g rice, formatted like the app: rounded half-even to 0.1 cent. */
function perMeal(centsPerGram: Fraction): string {
  return formatFixed(mul(centsPerGram, frac(BigInt(HERO.ricePerMeal))), 1);
}

function perMealRange(range: Range | null): string {
  if (range === null) throw new Error("expected a range");
  return `${perMeal(range.low)}–${perMeal(range.high)}`;
}

describe("computeCostLine — the brief's hero story (section 4)", () => {
  it("while INC-A4 is unconfirmed: nominal 8.0, supplier 10.0–10.4, route 10.4, and PO-A5 excluded", () => {
    const line = heroLine(null);

    expect(line.nominal).not.toBeNull();
    expect(perMeal(line.nominal as Fraction)).toBe("8.0");
    expect(perMealRange(line.supplier)).toBe("10.0–10.4");
    expect(perMealRange(line.route)).toBe("10.4–10.4");
    expect(line.excluded).toEqual([{ orderId: "PO-A5", status: "INCOMPLETE" }]);
    expect(line.batches).toBe(6);
    expect(line.failures).toEqual({ supplier: 1, other: 0, unconfirmed: 1 });
    expect(line.failureRisk).toBe("KNOWN");
  });

  it("confirmed as transport after handover: the supplier cost drops to 10.0, the route cost stays 10.4", () => {
    const line = heroLine("TRANSPORT_AFTER_HANDOVER");

    expect(perMealRange(line.supplier)).toBe("10.0–10.0");
    expect(perMealRange(line.route)).toBe("10.4–10.4");
    expect(line.failures).toEqual({ supplier: 1, other: 1, unconfirmed: 0 });
  });

  it("confirmed as a supplier failure: the supplier cost rises to the route cost, 10.4", () => {
    const line = heroLine("SUPPLIER");

    expect(perMealRange(line.supplier)).toBe("10.4–10.4");
    expect(line.failures).toEqual({ supplier: 2, other: 0, unconfirmed: 0 });
  });

  it("a confirmed UNKNOWN cause still gives a range, never a guess (C5)", () => {
    expect(perMealRange(heroLine("UNKNOWN").supplier)).toBe("10.0–10.4");
  });

  it("the costs are exact fractions: 4,000,000 cents ÷ 40,000 kg, and 4,160,000 ÷ 40,000 kg", () => {
    const line = heroLine("TRANSPORT_AFTER_HANDOVER");

    expect(line.supplier?.low).toEqual(frac(4_000_000n, BigInt(40_000 * KG)));
    expect(line.route?.low).toEqual(frac(4_160_000n, BigInt(40_000 * KG)));
  });
});

describe("computeCostLine — replacements and unknown risk", () => {
  it("resolves a replacement without an incident ID when the replaced order has exactly 1 incident", () => {
    const withoutIncidentId = heroPurchases.map((purchase) =>
      purchase.orderId === "PO-A4R" ? { ...purchase, replaces: { orderId: "PO-A4" } } : purchase,
    );
    const line = computeCostLine({
      supplierId: HERO.supplierId,
      commodity: "RICE",
      purchases: withoutIncidentId,
      incidents: [{ ...HERO.incidentA4, cause: null }],
    });

    expect(line.ambiguousReplacements).toEqual([]);
    expect(perMealRange(line.route)).toBe("10.4–10.4");
  });

  it("leaves out a replacement whose loss is ambiguous, and never guesses which loss it replaces", () => {
    const withoutIncidentId = heroPurchases.map((purchase) =>
      purchase.orderId === "PO-A4R" ? { ...purchase, replaces: { orderId: "PO-A4" } } : purchase,
    );
    const line = computeCostLine({
      supplierId: HERO.supplierId,
      commodity: "RICE",
      purchases: withoutIncidentId,
      incidents: [
        { ...HERO.incidentA4, cause: null },
        { incidentId: "INC-A4-B", orderId: "PO-A4", affectedQuantity: 500 * KG, cause: null },
      ],
    });

    expect(line.ambiguousReplacements).toEqual(["PO-A4R"]);
    expect(line.batches).toBe(5);
  });

  it("a supplier with 0 batches has UNKNOWN failure risk and no cost (C6)", () => {
    const line = computeCostLine({ supplierId: "SUP-L1", commodity: "RICE", purchases: heroPurchases, incidents: [] });

    expect(line.batches).toBe(0);
    expect(line.failureRisk).toBe("UNKNOWN");
    expect(line.nominal).toBeNull();
    expect(line.supplier).toBeNull();
    expect(line.route).toBeNull();
  });

  it("only counts reconciled purchases (C2): a payment mismatch removes the purchase", () => {
    const mismatch = toCostPurchases([ricePurchase("PO-X", 1_000, 80, { paidCents: 80_001 })]);
    const line = computeCostLine({ supplierId: HERO.supplierId, commodity: "RICE", purchases: mismatch, incidents: [] });

    expect(line.excluded).toEqual([{ orderId: "PO-X", status: "DISCREPANCY" }]);
    expect(line.batches).toBe(0);
  });
});

describe("quotedCentsPerUnit (C7)", () => {
  it("converts 62 cents for each kilogram into an exact price for each gram", () => {
    expect(quotedCentsPerUnit(62)).toEqual(frac(62n, 1000n));
    expect(perMeal(quotedCentsPerUnit(62))).toBe("6.2");
  });

  it("rejects a negative quote", () => {
    expect(() => quotedCentsPerUnit(-1)).toThrowError(/negative/);
  });
});
