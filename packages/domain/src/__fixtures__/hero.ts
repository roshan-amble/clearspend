import type { PurchaseEvidence } from "../reconcile.js";
import type { AcceptanceResult } from "../types.js";

/** 1 kilogram in the base unit, grams. */
export const KG = 1000;

interface PurchaseOptions {
  readonly acceptance?: AcceptanceResult;
  readonly withInvoice?: boolean;
  readonly paidCents?: number;
  readonly currency?: string;
}

/** Builds consistent evidence for 1 rice purchase. Options create the brief's failure cases. */
export function ricePurchase(id: string, kilograms: number, centsPerKg: number, options: PurchaseOptions = {}): PurchaseEvidence {
  const quantity = kilograms * KG;
  const totalCents = kilograms * centsPerKg;
  const currency = options.currency ?? "USD";
  return {
    order: { id, commodity: "RICE", quantity, unitPriceCentsPer1000: centsPerKg, totalCents, currency },
    payments: [{ id: `PAY-${id}`, amountCents: options.paidCents ?? totalCents, currency, hasConflictingVersion: false }],
    invoices:
      options.withInvoice === false
        ? []
        : [{ id: `INV-${id}`, commodity: "RICE", quantity, totalCents, currency }],
    deliveries: [{ id: `DEL-${id}`, quantityReceived: quantity, acceptance: options.acceptance ?? "PASS" }],
  };
}

/** Brief section 4: the import route history of supplier SUP-A at 80 cents for each kilogram. */
export const HERO = {
  supplierId: "SUP-A",
  purchases: {
    A1: ricePurchase("PO-A1", 10_000, 80),
    A2: ricePurchase("PO-A2", 10_000, 80),
    A3: ricePurchase("PO-A3", 10_000, 80, { acceptance: "FAIL" }),
    A3R: ricePurchase("PO-A3R", 10_000, 80),
    A4: ricePurchase("PO-A4", 10_000, 80),
    A4R: ricePurchase("PO-A4R", 2_000, 80),
    A5: ricePurchase("PO-A5", 10_000, 80, { withInvoice: false }),
  },
  replaces: {
    "PO-A3R": { orderId: "PO-A3" },
    "PO-A4R": { orderId: "PO-A4", incidentId: "INC-A4" },
  } as Readonly<Record<string, { orderId: string; incidentId?: string }>>,
  /** INC-A4: 2,000 kg damaged after handover. Its cause is the open question of the demo. */
  incidentA4: { incidentId: "INC-A4", orderId: "PO-A4", affectedQuantity: 2_000 * KG },
  /** 1 meal contains 100 g of rice (D11). */
  ricePerMeal: 100,
} as const;
