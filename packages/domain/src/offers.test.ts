import { describe, expect, it } from "vitest";
import { checkBid, type BidCommand } from "./offers.js";

const bid: BidCommand = {
  countryIso3: "MDG",
  commodity: "BEANS",
  businessName: "Ambovombe Pulses",
  contact: "+261 34 00 000 00",
  deliveryArea: "Ambovombe",
  priceCentsPer1000: 55,
  quantityPerMonth: 2_000,
  earliestStart: "2026-11-01",
  note: null,
};

describe("checkBid", () => {
  it("stores kg as grams, and L of oil as millilitres", () => {
    expect(checkBid(bid, "2026-10-01")).toEqual({ sourceUnit: "kg", baseUnit: "g", quantityPerMonthBase: 2_000_000 });
    expect(checkBid({ ...bid, commodity: "OIL", quantityPerMonth: 300 }, "2026-10-01")).toEqual({ sourceUnit: "L", baseUnit: "ml", quantityPerMonthBase: 300_000 });
  });

  it("refuses a food we do not buy, a price of 0, a fractional quantity, and a start in the past", () => {
    expect(() => checkBid({ ...bid, commodity: "CAVIAR" }, "2026-10-01")).toThrow("CAVIAR is not a food we buy.");
    expect(() => checkBid({ ...bid, priceCentsPer1000: 0 }, "2026-10-01")).toThrow("The price must be between");
    expect(() => checkBid({ ...bid, quantityPerMonth: 2.5 }, "2026-10-01")).toThrow("whole number");
    expect(() => checkBid({ ...bid, earliestStart: "2026-09-30" }, "2026-10-01")).toThrow("from today on");
    expect(() => checkBid({ ...bid, businessName: " " }, "2026-10-01")).toThrow("The business name must be 2 to 120 characters.");
  });
});
