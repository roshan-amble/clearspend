import { describe, expect, it } from "vitest";
import { ricePurchase } from "./__fixtures__/hero.js";
import { reconcilePurchase, type PurchaseEvidence } from "./reconcile.js";

function codes(evidence: PurchaseEvidence): string[] {
  return reconcilePurchase(evidence).findings.map((finding) => finding.code);
}

describe("reconcilePurchase", () => {
  it("reconciles a complete, consistent purchase with no findings", () => {
    const result = reconcilePurchase(ricePurchase("PO-1", 10_000, 80));

    expect(result).toEqual({ orderId: "PO-1", status: "RECONCILED", findings: [] });
  });

  it("marks a missing invoice INCOMPLETE, and does not invent a payment mismatch", () => {
    const result = reconcilePurchase(ricePurchase("PO-A5", 10_000, 80, { withInvoice: false }));

    expect(result.status).toBe("INCOMPLETE");
    expect(result.findings.map((finding) => finding.code)).toEqual(["MISSING_INVOICE"]);
  });

  it("finds a 1-cent payment mismatch exactly, with no rounding into a match", () => {
    const result = reconcilePurchase(ricePurchase("PO-2", 10_000, 80, { paidCents: 800_001 }));

    expect(result.status).toBe("DISCREPANCY");
    expect(codes(ricePurchase("PO-2", 10_000, 80, { paidCents: 800_001 }))).toEqual(["PAYMENT_INVOICE_MISMATCH"]);
  });

  it("keeps a changed payment version as a conflict that blocks reconciliation (D4)", () => {
    const base = ricePurchase("PO-3", 1_000, 80);
    const conflicted: PurchaseEvidence = {
      ...base,
      payments: base.payments.map((payment) => ({ ...payment, hasConflictingVersion: true })),
    };

    expect(reconcilePurchase(conflicted).status).toBe("INCOMPLETE");
    expect(codes(conflicted)).toEqual(["CONFLICTING_EVIDENCE"]);
  });

  it("marks another currency UNSUPPORTED, and keeps every other finding too", () => {
    const evidence = ricePurchase("PO-4", 1_000, 80, { currency: "MGA", withInvoice: false });
    const result = reconcilePurchase(evidence);

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.findings.map((finding) => finding.code)).toEqual([
      "UNSUPPORTED_CASE",
      "UNSUPPORTED_CASE",
      "MISSING_INVOICE",
    ]);
  });

  it("treats no delivery record as missing evidence, not as zero delivered", () => {
    const evidence: PurchaseEvidence = { ...ricePurchase("PO-5", 1_000, 80), deliveries: [] };

    expect(reconcilePurchase(evidence).status).toBe("INCOMPLETE");
    expect(codes(evidence)).toEqual(["MISSING_DELIVERY_EVIDENCE"]);
  });

  it("finds a delivery gap and a delivery excess", () => {
    const base = ricePurchase("PO-6", 1_000, 80);
    const short: PurchaseEvidence = {
      ...base,
      deliveries: [{ id: "DEL-6", quantityReceived: 800_000, acceptance: "PASS" }],
    };
    const over: PurchaseEvidence = {
      ...base,
      deliveries: [{ id: "DEL-6", quantityReceived: 1_200_000, acceptance: "PASS" }],
    };

    expect(codes(short)).toEqual(["DELIVERY_QUANTITY_GAP"]);
    expect(codes(over)).toEqual(["DELIVERY_EXCESS"]);
  });

  it("finds an order whose total is not exactly quantity × unit price", () => {
    const base = ricePurchase("PO-7", 1_000, 80);
    const wrongTotal: PurchaseEvidence = { ...base, order: { ...base.order, totalCents: 80_001 } };

    expect(codes(wrongTotal)).toContain("ORDER_TOTAL_MISMATCH");
  });
});
