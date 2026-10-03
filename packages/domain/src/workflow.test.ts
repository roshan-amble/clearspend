import { describe, expect, it } from "vitest";
import { frac } from "./fraction.js";
import { countrySteps, foodStep, usdWhole, type StepInput, type StepSupplier } from "./workflow.js";

const supplier = (over: Partial<StepSupplier>): StepSupplier => ({ supplierLogicalId: "k:SUP-L2", name: "New Produce Cooperative", role: "LEAD", eligibility: "LEAD", price: "41/500", netPerMonth: "-985100/1", ...over });
const current = supplier({ supplierLogicalId: "k:SUP-B", name: "Turkana Produce Traders", role: "CURRENT", eligibility: "ELIGIBLE", price: "1/10", netPerMonth: "0/1" });
const beans = (over: Partial<StepInput>): StepInput => ({ commodity: "BEANS", foodName: "beans", suppliers: [], baselineCentsPerUnit: "1/10", planNet: null, baselineKind: "IMPORT", investigations: [], ...over });

describe("foodStep", () => {
  it("walks a food without a supplier through find, compare, verify, and decide", () => {
    expect(foodStep(beans({})).stage).toBe("FIND_SUPPLIERS");
    expect(foodStep(beans({})).next).toEqual({ kind: "SURVEY", label: "Survey the market", investigationId: null });
    const compare = foodStep(beans({ suppliers: [supplier({})], planNet: "-578000/1" }));
    expect([compare.stage, compare.bestOption, compare.next.label]).toEqual(["COMPARE_OFFERS", "the cheapest offers save $5,780 a month against WFP's import price", "Compare offers"]);
    expect(foodStep(beans({ suppliers: [supplier({})], planNet: "8600/1" })).bestOption).toBe("the cheapest offers cost $86 a month more than WFP's import price");
    // The supplier to check next is the biggest saving nobody has verified or is verifying.
    expect(compare.check).toMatchObject({ supplierLogicalId: "k:SUP-L2", reason: "the biggest saving on record ($9,851 a month); its price and capacity are not checked on the ground" });
    const open = { investigationId: "i1", subjectType: "SUPPLIER", subjectId: "k:SUP-L2", commodity: "BEANS", status: "OPEN", onGroundStart: null };
    expect(foodStep(beans({ suppliers: [supplier({})], investigations: [open] })).next).toEqual({ kind: "BOOK", label: "Book investigator", investigationId: "i1" });
    expect(foodStep(beans({ suppliers: [supplier({})], investigations: [open] })).check).toBeNull();
    const booked = foodStep(beans({ suppliers: [supplier({})], investigations: [{ ...open, status: "SCHEDULED", onGroundStart: "2026-10-07" }] }));
    expect([booked.stage, booked.next.kind, booked.next.label]).toEqual(["BEING_VERIFIED", "WAIT", "On the ground 2026-10-07"]);
    expect(foodStep(beans({ suppliers: [supplier({ eligibility: "VERIFIED_PASS" })] })).next.kind).toBe("DECIDE");
    // An investigation of another food, or a cancelled one, does not move this food.
    expect(foodStep(beans({ suppliers: [supplier({})], investigations: [{ ...open, commodity: "RICE" }, { ...open, status: "CANCELLED" }] })).stage).toBe("COMPARE_OFFERS");
  });

  it("starts the pipeline again for a delivered food only when a candidate is at least 10% cheaper", () => {
    // 0.82 $/kg against 1.00 paid: 18% below.
    const step = foodStep(beans({ suppliers: [current, supplier({})] }));
    expect(step.stage).toBe("DELIVERING");
    expect(step.alternative).toEqual({ stage: "COMPARE_OFFERS", supplierLogicalId: "k:SUP-L2", name: "New Produce Cooperative", netPerMonth: "-985100/1" });
    expect([step.bestOption, step.next.label]).toEqual(["SUP-L2 would save $9,851 a month", "Compare with SUP-L2"]);
    // 0.95 $/kg is 5% below: not worth a visit.
    const close = foodStep(beans({ suppliers: [current, supplier({ price: "19/200", netPerMonth: "-1000/1" })] }));
    expect([close.alternative, close.bestOption, close.next.kind]).toEqual([null, "no cheaper option on record", "NONE"]);
  });
});

describe("the recommended steps", () => {
  const base = { foodNames: { BEANS: "beans", MAIZE: "maize meal" }, offersToReview: 0, investigations: [], costPerRation: "10/1", recommendations: [] };

  it("puts a cheaper candidate under cost, what it buys under meals, and a failed delivery under supplier problems", () => {
    const steps = countrySteps({
      ...base,
      steps: [foodStep(beans({ suppliers: [current, supplier({})] }))],
      offersToReview: 2,
      investigations: [{ investigationId: "i9", subjectType: "MARKET", subjectId: "MAIZE", commodity: "MAIZE", status: "OPEN", onGroundStart: null }],
      recommendations: [
        { id: "UNCONFIRMED_FAILURE:MAIZE", kind: "UNCONFIRMED_FAILURE", severity: "MEDIUM", title: "A failed maize meal delivery has no confirmed cause", detail: "1 batch.", action: { type: "CONFIRM_CAUSE", commodity: "MAIZE" } },
        { id: "NUTRITION_GAP:IRON", kind: "NUTRITION_GAP", severity: "MEDIUM", title: "Iron below target in 1 of 4 rations", detail: "x", action: { type: "REVIEW_MEAL" } },
        { id: "NUTRITION_GAP:ZINC", kind: "NUTRITION_GAP", severity: "LOW", title: "Zinc below target", detail: "x", action: { type: "REVIEW_MEAL" } },
      ],
    });
    // 985,100 cents a month at 10 cents a ration is 98,510 rations.
    expect(steps.map((s) => [s.group, s.title, s.link.type])).toEqual([
      ["COST", "Beans: check SUP-L2 (local), it would save $9,851 a month", "SUPPLIERS"],
      ["COST", "2 supplier offers to review", "SUPPLIERS"],
      ["COST", "Maize meal market survey: book an investigator", "INVESTIGATIONS"],
      ["MEALS", "The savings on record would pay for 98,510 more rations a month", "INGREDIENTS"],
      ["MEALS", "Iron below target in 1 of 4 rations", "INGREDIENTS"],
      ["SUPPLIERS", "A failed maize meal delivery has no confirmed cause", "INCIDENTS"],
    ]);
  });

  it("makes choosing a supplier a meals step when nothing is delivered yet, the most money first", () => {
    const steps = countrySteps({
      ...base,
      steps: [
        foodStep(beans({ suppliers: [supplier({ netPerMonth: "8600/1" })], planNet: "8600/1" })),
        foodStep(beans({ commodity: "MAIZE", foodName: "maize meal", suppliers: [supplier({})], planNet: "-578000/1" })),
      ],
    });
    expect(steps.map((s) => [s.group, s.title, s.detail])).toEqual([
      ["MEALS", "Maize meal: choose a supplier, check SUP-L2 first", "No supplier yet, so nothing is delivered: the cheapest offers save $5,780 a month against WFP's import price."],
      ["MEALS", "Beans: choose a supplier", "No supplier yet, so nothing is delivered: the cheapest offers cost $86 a month more than WFP's import price."],
    ]);
  });

  it("splits a food that the 10% rule keeps out of the local market into a local and an international step", () => {
    const intl = supplier({ supplierLogicalId: "k:SUP-I1", name: "Indian Ocean Grain Traders", route: "IMPORT", price: "31/500", netPerMonth: "-900000/1" });
    const step = foodStep(beans({ suppliers: [supplier({ route: "LOCAL", netPerMonth: "-300000/1" }), intl], planNet: "-1200000/1", needPerMonth: 491_960_000, safeLocalPerMonth: 40_000_000 }));
    expect([step.check?.supplierLogicalId, step.checks.LOCAL?.supplierLogicalId, step.checks.IMPORT?.supplierLogicalId, step.beyondLocalPerMonth]).toEqual(["k:SUP-I1", "k:SUP-L2", "k:SUP-I1", 451_960_000]);
    expect(step.checks.IMPORT?.reason).toBe("the biggest international saving on record ($9,000 a month); its price, delivery terms, and capacity are not checked on the ground");
    const steps = countrySteps({ ...base, steps: [step] });
    expect(steps.map((s) => [s.id, s.title])).toEqual([
      ["SOURCE_IMPORT:BEANS", "Beans: choose an international supplier for 451,960 kg a month, check SUP-I1 first"],
      ["SOURCE_LOCAL:BEANS", "Beans: choose local suppliers within the 10% rule, check SUP-L2 first"],
    ]);
    expect(steps.map((s) => s.detail)).toEqual([
      "The 10% rule keeps 451,960 kg a month out of the local market. No supplier yet: the cheapest offers save $12,000 a month against WFP's import price, local and international together.",
      "Up to 40,000 kg a month can be bought locally without pushing local prices up.",
    ]);
  });

  it("writes whole dollars without the sign", () => {
    expect([usdWhole(frac(-578000n)), usdWhole(frac(8600n)), usdWhole(frac(123456789n))]).toEqual(["$5,780", "$86", "$1,234,568"]);
  });
});
