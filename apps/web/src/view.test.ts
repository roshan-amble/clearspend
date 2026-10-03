import { describe, expect, it } from "vitest";
import { capacityText, comparisonText, evidenceLabel, perMealText, percentText, shortId, THRESHOLD_TEXT, userIdFromSub } from "./view.js";

describe("per-meal display (D2: format only)", () => {
  it("shows the unconfirmed supplier view as a range and the route view as a point", () => {
    const json = JSON.stringify({ quantityPerMeal: 100, nominal: "22/5", supplierLow: "11/2", supplierHigh: "143/25", routeLow: "143/25", routeHigh: "143/25" });

    expect(perMealText(json)).toEqual({ nominal: "4.4", supplier: "5.5 to 5.7", route: "5.7" });
  });

  it("says Unknown when no cost can be stated, never 0", () => {
    const json = JSON.stringify({ quantityPerMeal: 100, nominal: null, supplierLow: null, supplierHigh: null, routeLow: null, routeHigh: null });

    expect(perMealText(json)).toEqual({ nominal: "Unknown", supplier: "Unknown", route: "Unknown" });
  });

  it("shows no per-meal value for a snapshot written before function 0.1.1", () => {
    expect(perMealText(undefined)).toBeNull();
  });

  it("turns a token's base64 user ID into the UUID text that Actions use", () => {
    // 00112233-4455-6677-8899-aabbccddeeff as 16 bytes in base64.
    expect(userIdFromSub("ABEiM0RVZneImaq7zN3u/w==")).toBe("00112233-4455-6677-8899-aabbccddeeff");
  });

  it("shortens a logical ID to its external ID", () => {
    expect(shortId("t1/harbor-erp:PO-A3")).toBe("PO-A3");
  });
});

describe("Screen A comparison text", () => {
  it("keeps the paid cost and the quote apart, and reads meals per dollar as stored", () => {
    const paid = comparisonText(
      JSON.stringify({
        quantityPerMeal: 100,
        nominal: "22/5",
        supplierLow: "11/2",
        supplierHigh: "143/25",
        routeLow: "143/25",
        routeHigh: "143/25",
        quoted: null,
        mealsPerDollar: { nominal: "250/11", supplierLow: "2500/143", supplierHigh: "200/11", routeLow: "2500/143", routeHigh: "2500/143", quoted: null },
      }),
    );
    expect(paid).toEqual({ paidCents: "5.5 to 5.7", paidMealsPerDollar: "17.5 to 18.2", quotedCents: null, quotedMealsPerDollar: null });
    const lead = comparisonText(JSON.stringify({ quantityPerMeal: 100, quoted: "51/10", mealsPerDollar: { quoted: "1000/51" } }));
    expect(lead).toEqual({ paidCents: null, paidMealsPerDollar: null, quotedCents: "5.1", quotedMealsPerDollar: "19.6" });
  });

  it("formats a stored share as a percent, and never calls a claim confirmed", () => {
    expect(percentText("1/40")).toBe("2.5%");
    expect(THRESHOLD_TEXT).toBe("10%");
    expect(capacityText(10_000_000, undefined, 12_000_000)).toBe("Claims to meet");
    expect(capacityText(10_000_000, 11_000_000, 12_000_000)).toBe("Meets (confirmed on a visit)");
    expect(capacityText(10_000_000, undefined, undefined)).toBe("Unknown");
  });
});

describe("AI citation labels", () => {
  it("names the supplier and food of a cost line, and the short ID of evidence", () => {
    expect(evidenceLabel("EXP-ANDROY-2026-T2@15:t2/harbor-erp:SUP-A:RICE")).toBe("SUP-A RICE");
    expect(evidenceLabel("EXP-ANDROY-2026-T2@15:market")).toBe("market");
    expect(evidenceLabel("t2/harbor-erp:DEL-A4")).toBe("DEL-A4");
    expect(evidenceLabel("DOC-A4-WAREHOUSE")).toBe("DOC-A4-WAREHOUSE");
  });
});

describe("price screen formatting (UI1)", () => {
  it("rounds stored exact values for display only", async () => {
    const { usdPerUnit, usdFromMicros, usdFromCents, thousands, plot } = await import("./view.js");
    expect(usdPerUnit(51)).toBe("0.51");
    expect(usdFromMicros("810000/1")).toBe("0.81");
    expect(usdFromCents(440000)).toBe("4,400.00");
    expect(thousands(10_000_000)).toBe("10,000");
    expect(plot("143/25")).toBe(5.72);
    expect(plot(null)).toBeNull();
    const { centsFromUsd } = await import("./view.js");
    expect(centsFromUsd("0.5")).toBe(50);
    expect(centsFromUsd("0.50")).toBe(50);
    expect(centsFromUsd("2")).toBe(200);
    expect(centsFromUsd("0.505")).toBeNull();
    expect(centsFromUsd("abc")).toBeNull();
  });
});
