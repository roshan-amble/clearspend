import { priceChart, priceHistory } from "@clearspend/domain";
import { describe, expect, it } from "vitest";
import { fixtureSnapshotInput } from "./lib/expected-snapshot.js";

// UI5 A: the monthly series behind the price screens, on the story fixtures.
describe("price history (UI5)", () => {
  const history = priceHistory({ ...fixtureSnapshotInput({}, null, { leads: true }), targets: new Map([["RICE", 500]]) });
  const rice = history.commodities.find((c) => c.commodity === "RICE")!;
  const month = (m: string) => rice.months.find((x) => x.month === m)!;

  it("counts accepted and failed rice by delivery month: INC-A3 failed at receipt, INC-A4 unconfirmed", () => {
    expect(month("2026-03").acceptedBase).toBe(10_000_000);
    expect(month("2026-05")).toMatchObject({ acceptedBase: 10_000_000, failedSupplierBase: 10_000_000 });
    expect(month("2026-06")).toMatchObject({ acceptedBase: 10_000_000, failedUnconfirmedBase: 2_000_000, failedOtherBase: 0 });
  });

  it("keeps the unreconciled purchase apart from paid spend (C2)", () => {
    expect(month("2026-07")).toMatchObject({ paidCents: 0, unreconciledCents: 440_000, acceptedBase: 0 });
    expect(rice.purchases.find((p) => p.orderLogicalId === "harbor-erp:PO-A5")?.reconciled).toBe(false);
  });

  it("moves INC-A4's loss to other causes once a person confirms transport", () => {
    const confirmed = priceHistory(fixtureSnapshotInput({ "INC-A4": "TRANSPORT_AFTER_HANDOVER" }, null));
    const june = confirmed.commodities.find((c) => c.commodity === "RICE")!.months.find((m) => m.month === "2026-06")!;
    expect(june).toMatchObject({ failedUnconfirmedBase: 0, failedOtherBase: 2_000_000 });
  });

  it("returns quotes, WFP medians as exact text, and the declared target, display only", () => {
    expect(rice.quotes).toHaveLength(6);
    expect(rice.market.map((m) => m.route)).toEqual(["LOCAL", "IMPORT"]);
    expect(rice.market[0]!.points.at(-1)).toEqual({ month: "2026-08", medianMicros: "810000/1" });
    expect(rice.targetCentsPer1000).toBe(500);
    expect(history.commodities.find((c) => c.commodity === "BEANS")!.targetCentsPer1000).toBeNull();
  });
});

// P17: the 1 simple chart of an ingredient: what we paid against the lowest market price, month by month.
describe("priceChart", () => {
  it("takes the mean of a month's purchases and the lower of the local and import medians", () => {
    const chart = priceChart(
      [
        { recordedAt: "2026-03-10T00:00:00Z", unitPriceCentsPer1000: 600 },
        { recordedAt: "2026-03-20T00:00:00Z", unitPriceCentsPer1000: 700 },
        { recordedAt: "2026-05-01T00:00:00Z", unitPriceCentsPer1000: 650 },
      ],
      [
        // 5,000,000 micro-dollars per kg = 5.00 $/kg = 500 cents per 1,000 g.
        { points: [{ month: "2026-03", medianMicros: "5000000/1" }, { month: "2026-04", medianMicros: "5200000/1" }] },
        { points: [{ month: "2026-03", medianMicros: "4800000/1" }] },
      ],
    );
    expect(chart).toEqual([
      { month: "2026-03", ours: "650/1", lowest: "480/1" },
      { month: "2026-04", ours: null, lowest: "520/1" },
      { month: "2026-05", ours: "650/1", lowest: null },
    ]);
  });
});
