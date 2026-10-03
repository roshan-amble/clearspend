import { describe, expect, it } from "vitest";
import { countryView, type CountryInput } from "./portfolio-view.js";

const input: CountryInput = {
  country: { iso3: "MDG", name: "Madagascar", flag: "🇲🇬", status: "NEW", region: "Androy", expansionId: "EXP-MDG-2026", schools: 84, students: 25000, hub: "JNB", synthetic: true },
  evidenceRevision: 4,
  lines: [
    { supplierLogicalId: "m:SUP-L1", commodity: "RICE", route: "LOCAL", supplierLowExact: null, supplierHighExact: null, batchCount: 0, unconfirmedFailures: 0, quotedCentsPer1000: 50, eligibility: "LEAD" },
    { supplierLogicalId: "m:SUP-L7", commodity: "BEANS", route: "LOCAL", supplierLowExact: null, supplierHighExact: null, batchCount: 0, unconfirmedFailures: 0, quotedCentsPer1000: 100, eligibility: "LEAD" },
  ],
  supplierNames: { "m:SUP-L1": "Cooperative Tsimoka Riz (fictional)" },
  market: [],
  meals: [
    { mealId: "MDG-M1", name: "Rice and beans", daysServed: "Mon", servingsPerMonth: 1000, recipe: [{ commodity: "RICE", quantity: 100 }, { commodity: "BEANS", quantity: 30 }] },
    { mealId: "MDG-M2", name: "Plain rice", daysServed: "Fri", servingsPerMonth: 3000, recipe: [{ commodity: "RICE", quantity: 100 }] },
  ],
  investigations: [
    { investigationId: "i1", subjectType: "SUPPLIER", subjectId: "m:SUP-L1", commodity: "RICE", status: "SCHEDULED", reason: "visit", investigatorId: "INV-1", onGroundStart: "2026-10-07", onGroundEnd: "2026-10-08", createdAt: "2026-10-01T00:00:00Z" },
  ],
};

describe("countryView", () => {
  it("costs each meal from quotes when nothing is paid, and the menu by servings", () => {
    const view = countryView(input);
    // Rice and beans: 100 g × 0.05 + 30 g × 0.1 = 8 cents; plain rice: 5 cents.
    expect(view.meals.map((m) => [m.mealId, m.cost.low, m.cost.basis])).toEqual([
      ["MDG-M1", "8/1", "QUOTE"],
      ["MDG-M2", "5/1", "QUOTE"],
    ]);
    // 1,000 × 8 + 3,000 × 5 = 23,000 cents a month for 4,000 meals: 5.75 cents a meal.
    expect(view.summary.monthlyCost).toEqual({ low: "23000/1", high: "23000/1", basis: "QUOTE" });
    expect(view.summary.costPerMeal.low).toBe("23/4");
    expect(view.ingredients.find((i) => i.commodity === "RICE")?.needPerMonth).toBe(400_000);
  });

  it("counts people by activity, so rations of 1 activity do not count the same people twice", () => {
    const view = countryView({
      ...input,
      meals: [
        { ...input.meals[0]!, activity: "SCHOOL_MEALS", group: "SCHOOL_CHILD", beneficiaries: 6000 },
        { ...input.meals[1]!, activity: "SCHOOL_MEALS", group: "SCHOOL_CHILD", beneficiaries: 6000 },
        { mealId: "MDG-G1", name: "General ration", daysServed: "Every day", servingsPerMonth: 30_000, recipe: [{ commodity: "RICE", quantity: 400 }], activity: "GENERAL_DISTRIBUTION", group: "GENERAL_POPULATION", beneficiaries: 1000 },
      ],
    });
    // A new program plans for 7,000 people and has reached none; once it is active, the same people are reached.
    expect([view.summary.started, view.summary.peoplePlanned, view.summary.peopleReached]).toEqual([false, 7000, 0]);
    const active = countryView({ ...input, country: { ...input.country, status: "ACTIVE" }, meals: [{ ...input.meals[0]!, activity: "SCHOOL_MEALS", group: "SCHOOL_CHILD", beneficiaries: 6000 }] });
    expect([active.summary.started, active.summary.peoplePlanned, active.summary.peopleReached]).toEqual([true, 6000, 6000]);
    expect(view.summary.activities.map((a) => [a.activity, a.beneficiaries, a.rationsPerMonth])).toEqual([
      ["SCHOOL_MEALS", 6000, 4000],
      ["GENERAL_DISTRIBUTION", 1000, 30_000],
    ]);
    // 23,000 cents of school meals + 30,000 × 400 g × 0.05 = 600,000 cents of general rations, for 7,000 people: 89 cents a person.
    expect(view.summary.costPerPersonMonth.low).toBe("89/1");
    expect(view.meals[2]?.groupLabel).toBe("Everyone, all ages (Sphere planning figures)");
  });

  it("lists each supplier with what it could reasonably supply and its net cost against importing", () => {
    const view = countryView({
      ...input,
      lines: [{ ...input.lines[1]!, claimedCapacityPerMonth: 50_000 }],
      // Beans: 1,000 servings × 30 g = 30,000 g a month; 10% of a 200,000 g market is 20,000 g.
      commodities: [{ commodity: "BEANS", marketVolumePerMonth: 200_000 }],
      // 1.20 $/kg imported = 0.12 cents a gram.
      market: [{ commodity: "BEANS", pressureShare: "3/20", pressureFlagged: true, series: [{ series: "Beans (imported)", route: "IMPORT", lastMonth: "2026-08", lastMedianMicros: "1200000/1", change: null }] }],
      bids: [
        { bidId: "B1", commodity: "BEANS", businessName: "Ambovombe Pulses", contact: "+261", deliveryArea: "Ambovombe", priceCentsPer1000: 80, quantityPerMonth: 12_000, earliestStart: "2026-11-01", note: null, status: "ACCEPTED", submittedAt: "2026-10-01T00:00:00Z" },
        { bidId: "B2", commodity: "BEANS", businessName: "Not yet reviewed", contact: "x", deliveryArea: "Tsihombe", priceCentsPer1000: 60, quantityPerMonth: 5_000, earliestStart: "2026-11-01", note: null, status: "SUBMITTED", submittedAt: "2026-10-01T00:00:00Z" },
      ],
    });
    const beans = view.ingredients.find((i) => i.commodity === "BEANS")!;
    expect(beans.baseline).toEqual({ kind: "IMPORT", centsPerUnit: "3/25", supplierLogicalId: null });
    // B1: 12,000 g at 0.08 against 0.12 = −480 cents. SUP-L7: min(50,000, 30,000, 20,000) = 20,000 g at 0.10 = −400.
    expect(beans.suppliers.map((s) => [s.supplierLogicalId, s.role, s.reasonableVolume, s.netPerMonth])).toEqual([
      ["bid:B1", "BID", 12_000, "-480/1"],
      ["m:SUP-L7", "LEAD", 20_000, "-400/1"],
    ]);
    // The cheapest-first plan: B1 12,000 g, then SUP-L7 the other 8,000 g of the safe 20,000: −480 − 160.
    expect(beans.sourcing.netPerMonth).toBe("-640/1");
    // Every net cost compares with 1 price, here importing at 0.12: the whole need costs 3,600 at it. The local plan
    // (12,000 g at 0.08 + 8,000 g at 0.10 = 1,760 cents) saves 640 against it.
    expect(beans.comparison).toEqual({
      compared: { kind: "IMPORT", centsPerUnit: "3/25", supplierLogicalId: null, cost: "3600/1" },
      local: { count: 2, bestPrice: "2/25", plannedVolume: 20_000, plannedCost: "1760/1", net: "-640/1" },
      // No international offer on record: the other 10,000 g stay at the compared price.
      international: { count: 0, price: "3/25", basis: "WFP_IMPORT_MEDIAN", supplierLogicalId: null, isCompared: true, net: null, plannedVolume: 0, plannedNet: "0/1" },
    });
    // B2 waits for review: 5,000 g at 0.06 against 0.12 imported would save 300 cents a month.
    expect(view.bidsToReview.map((b) => [b.bidId, b.preview?.reasonableVolume, b.preview?.netPerMonth])).toEqual([["B2", 5_000, "-300/1"]]);
    expect([beans.sourcing.importAllocations, beans.sourcing.uncoveredPerMonth, beans.sourcing.netTotalPerMonth]).toEqual([[], 10_000, "-640/1"]);
    expect(view.summary.bidsToReview).toBe(1);
  });

  it("compares with what we pay when a supplier is paid, and puts a supplier of unknown capacity last", () => {
    const view = countryView({
      ...input,
      lines: [
        { ...input.lines[0]!, supplierLogicalId: "m:SUP-A", supplierLowExact: "3/25", supplierHighExact: "3/25", batchCount: 3, quotedCentsPer1000: null, eligibility: "ELIGIBLE", claimedCapacityPerMonth: null },
        { ...input.lines[0]!, claimedCapacityPerMonth: 100_000 },
      ],
      // 0.90 $/kg imported = 0.09 cents a gram: a reference price, with no international supplier on record.
      market: [{ commodity: "RICE", pressureShare: "1/20", pressureFlagged: false, series: [{ series: "Rice (imported)", route: "IMPORT", lastMonth: "2026-08", lastMedianMicros: "900000/1", change: null }] }],
    });
    const rice = view.ingredients.find((i) => i.commodity === "RICE")!;
    // 1 compared price on the screen: what we pay SUP-A, 0.12, so 400,000 g cost 48,000. The local lead saves 7,000
    // on its 100,000 g; buying everything at the international reference would save 12,000.
    expect(rice.comparison.compared).toEqual({ kind: "PAID", centsPerUnit: "3/25", supplierLogicalId: "m:SUP-A", cost: "48000/1" });
    // The lowest price on record is SUP-L1's quote, 0.05: we pay 0.12, so 140% over it.
    expect([rice.ideal, rice.gapShare]).toEqual([{ centsPerUnit: "1/20", source: "OFFER", supplierLogicalId: "m:SUP-L1" }, "7/5"]);
    expect([rice.comparison.local.count, rice.comparison.local.net]).toEqual([1, "-7000/1"]);
    expect(rice.comparison.international).toMatchObject({ basis: "WFP_IMPORT_MEDIAN", isCompared: false, net: "-12000/1" });
    expect(rice.baseline).toEqual({ kind: "PAID", centsPerUnit: "3/25", supplierLogicalId: "m:SUP-A" });
    // SUP-L1: 100,000 g of the 400,000 g need, at 0.05 against 0.12 paid: −7,000 cents a month.
    expect(rice.suppliers.map((s) => [s.supplierLogicalId, s.reasonableVolume, s.netPerMonth])).toEqual([
      ["m:SUP-L1", 100_000, "-7000/1"],
      ["m:SUP-A", null, null],
    ]);
  });

  it("links a recommendation to the investigation that already answers it", () => {
    const view = countryView(input);
    // The pipeline of a new program: beans has 1 offer to compare; rice is being verified, and its visit is booked.
    expect(view.pipeline.map((step) => [step.commodity, step.stage, step.next.kind, step.next.label, step.hasSupplier])).toEqual([
      ["BEANS", "COMPARE_OFFERS", "COMPARE", "Compare offers", false],
      ["RICE", "BEING_VERIFIED", "WAIT", "On the ground 2026-10-07", false],
    ]);
    // The recommended steps: beans needs a supplier chosen; rice is waiting for its booked visit, so it is not a step.
    // Its 2 nutrition gaps below 60% of the target are steps too.
    expect(view.steps.map((step) => [step.group, step.title])).toEqual([
      ["MEALS", "Beans: choose a supplier"],
      ["MEALS", "Iron below target in 1 of 2 rations"],
      ["MEALS", "Vitamin A below target in 2 of 2 rations"],
    ]);
    expect([view.summary.foodsSourced, view.summary.steps, view.summary.topStep, view.stepGroups[0]]).toEqual([0, 3, "Beans: choose a supplier", "MEALS"]);
    const rice = view.recommendations.find((r) => r.id === "NO_SUPPLIER:RICE");
    expect(rice?.investigation?.investigationId).toBe("i1");
    expect(view.recommendations.find((r) => r.id === "NO_SUPPLIER:BEANS")?.investigation).toBeNull();
    expect(view.summary).toMatchObject({ currentSuppliers: 0, leads: 2, investigations: { open: 0, scheduled: 1 } });
  });
});
