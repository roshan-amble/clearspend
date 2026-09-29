import { SUPPORTED_CURRENCY, type AcceptanceResult, type Currency } from "./types.js";

export type ReconciliationStatus = "RECONCILED" | "DISCREPANCY" | "INCOMPLETE" | "UNSUPPORTED";

export type FindingCode =
  | "MISSING_PAYMENT"
  | "MISSING_INVOICE"
  | "MISSING_DELIVERY_EVIDENCE"
  | "ORDER_TOTAL_MISMATCH"
  | "ORDER_INVOICE_MISMATCH"
  | "PAYMENT_INVOICE_MISMATCH"
  | "DELIVERY_QUANTITY_GAP"
  | "DELIVERY_EXCESS"
  | "CONFLICTING_EVIDENCE"
  | "UNSUPPORTED_CASE";

export interface Finding {
  readonly code: FindingCode;
  readonly evidenceIds: readonly string[];
  readonly detail: string;
}

export interface OrderRecord {
  readonly id: string;
  readonly commodity: string;
  /** Whole grams or millilitres. */
  readonly quantity: number;
  /** Cents for each kilogram or litre, that is, for each 1,000 base units. */
  readonly unitPriceCentsPer1000: number;
  readonly totalCents: number;
  readonly currency: Currency;
}

export interface PaymentRecord {
  readonly id: string;
  readonly amountCents: number;
  readonly currency: Currency;
  /** True when a newer version of the same logical payment has different content (D4). */
  readonly hasConflictingVersion: boolean;
}

export interface InvoiceRecord {
  readonly id: string;
  readonly commodity: string;
  readonly quantity: number;
  readonly totalCents: number;
  readonly currency: Currency;
}

export interface DeliveryRecord {
  readonly id: string;
  readonly quantityReceived: number;
  readonly acceptance: AcceptanceResult;
}

/** The active evidence for 1 purchase. Replaced versions are already removed (D4). */
export interface PurchaseEvidence {
  readonly order: OrderRecord;
  readonly payments: readonly PaymentRecord[];
  readonly invoices: readonly InvoiceRecord[];
  readonly deliveries: readonly DeliveryRecord[];
}

export interface ReconciliationResult {
  readonly orderId: string;
  readonly status: ReconciliationStatus;
  /** Every finding. The status never hides a second finding (brief section 8). */
  readonly findings: readonly Finding[];
}

const INCOMPLETE_CODES: ReadonlySet<FindingCode> = new Set([
  "MISSING_PAYMENT",
  "MISSING_INVOICE",
  "MISSING_DELIVERY_EVIDENCE",
  "CONFLICTING_EVIDENCE",
]);

/** Display precedence from the brief: unsupported, then incomplete, then discrepancy, then reconciled. */
function statusFor(findings: readonly Finding[]): ReconciliationStatus {
  if (findings.some((finding) => finding.code === "UNSUPPORTED_CASE")) return "UNSUPPORTED";
  if (findings.some((finding) => INCOMPLETE_CODES.has(finding.code))) return "INCOMPLETE";
  if (findings.length > 0) return "DISCREPANCY";
  return "RECONCILED";
}

function currencyFindings(evidence: PurchaseEvidence): Finding[] {
  const records = [
    { id: evidence.order.id, currency: evidence.order.currency },
    ...evidence.payments.map((payment) => ({ id: payment.id, currency: payment.currency })),
    ...evidence.invoices.map((invoice) => ({ id: invoice.id, currency: invoice.currency })),
  ];
  return records
    .filter((record) => record.currency !== SUPPORTED_CURRENCY)
    .map((record) => ({
      code: "UNSUPPORTED_CASE" as const,
      evidenceIds: [record.id],
      detail: `Currency ${record.currency} is not supported. Only ${SUPPORTED_CURRENCY} is.`,
    }));
}

function orderFindings(order: OrderRecord): Finding[] {
  const expectedTotalTimes1000 = BigInt(order.quantity) * BigInt(order.unitPriceCentsPer1000);
  if (expectedTotalTimes1000 === BigInt(order.totalCents) * 1000n) return [];
  return [
    {
      code: "ORDER_TOTAL_MISMATCH",
      evidenceIds: [order.id],
      detail: `Quantity × unit price is not exactly the order total of ${order.totalCents} cents.`,
    },
  ];
}

function paymentFindings(evidence: PurchaseEvidence): Finding[] {
  const { payments } = evidence;
  if (payments.length === 0) {
    return [{ code: "MISSING_PAYMENT", evidenceIds: [evidence.order.id], detail: "No payment is recorded." }];
  }
  const findings: Finding[] = [];
  if (payments.length > 1) {
    findings.push({
      code: "UNSUPPORTED_CASE",
      evidenceIds: payments.map((payment) => payment.id),
      detail: "The v1 core supports 1 payment for each purchase.",
    });
  }
  for (const payment of payments.filter((candidate) => candidate.hasConflictingVersion)) {
    findings.push({
      code: "CONFLICTING_EVIDENCE",
      evidenceIds: [payment.id],
      detail: "A newer version of this payment has different content. A person must resolve it (D4).",
    });
  }
  return findings;
}

function invoiceFindings(evidence: PurchaseEvidence): Finding[] {
  const { order, invoices, payments } = evidence;
  if (invoices.length === 0) {
    return [{ code: "MISSING_INVOICE", evidenceIds: [order.id], detail: "No invoice is recorded." }];
  }
  if (invoices.length > 1) {
    return [
      {
        code: "UNSUPPORTED_CASE",
        evidenceIds: invoices.map((invoice) => invoice.id),
        detail: "The v1 core supports 1 invoice for each purchase.",
      },
    ];
  }
  const [invoice] = invoices;
  if (invoice === undefined) return [];
  const findings: Finding[] = [];
  if (
    invoice.commodity !== order.commodity ||
    invoice.quantity !== order.quantity ||
    invoice.totalCents !== order.totalCents
  ) {
    findings.push({
      code: "ORDER_INVOICE_MISMATCH",
      evidenceIds: [order.id, invoice.id],
      detail: "The invoice commodity, quantity, or total differs from the order.",
    });
  }
  const [payment] = payments;
  if (payments.length === 1 && payment !== undefined && payment.amountCents !== invoice.totalCents) {
    findings.push({
      code: "PAYMENT_INVOICE_MISMATCH",
      evidenceIds: [payment.id, invoice.id],
      detail: `Paid ${payment.amountCents} cents, but the invoice total is ${invoice.totalCents} cents.`,
    });
  }
  return findings;
}

function deliveryFindings(evidence: PurchaseEvidence): Finding[] {
  const { order, deliveries } = evidence;
  if (deliveries.length === 0) {
    return [
      {
        code: "MISSING_DELIVERY_EVIDENCE",
        evidenceIds: [order.id],
        detail: "No delivery is recorded. That is unknown, not zero delivered.",
      },
    ];
  }
  const received = deliveries.reduce((total, delivery) => total + BigInt(delivery.quantityReceived), 0n);
  const ordered = BigInt(order.quantity);
  const ids = deliveries.map((delivery) => delivery.id);
  if (received < ordered) {
    return [
      {
        code: "DELIVERY_QUANTITY_GAP",
        evidenceIds: ids,
        detail: `Received ${received} of ${ordered} ordered units.`,
      },
    ];
  }
  if (received > ordered) {
    return [
      { code: "DELIVERY_EXCESS", evidenceIds: ids, detail: `Received ${received}, more than ${ordered} ordered.` },
    ];
  }
  return [];
}

/** Brief section 8: pure, no network, no clock, no model. Returns every applicable finding. */
export function reconcilePurchase(evidence: PurchaseEvidence): ReconciliationResult {
  const findings = [
    ...currencyFindings(evidence),
    ...orderFindings(evidence.order),
    ...paymentFindings(evidence),
    ...invoiceFindings(evidence),
    ...deliveryFindings(evidence),
  ];
  return { orderId: evidence.order.id, status: statusFor(findings), findings };
}
