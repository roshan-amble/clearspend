import { DomainError } from "./errors.js";
import { div, frac, fromSafeInteger, type Fraction } from "./fraction.js";
import { between, type Range } from "./range.js";
import type { PurchaseEvidence, ReconciliationResult, ReconciliationStatus } from "./reconcile.js";
import type { Cause } from "./types.js";

/** What 1 purchase contributes to the cost model. Built from reconciled evidence by `costPurchaseFrom`. */
export interface CostPurchase {
  readonly orderId: string;
  readonly supplierId: string;
  readonly commodity: string;
  readonly reconciliation: ReconciliationStatus;
  readonly orderedQuantity: number;
  readonly totalCents: number;
  readonly paidCents: number;
  /** Units that passed the acceptance test at receipt. */
  readonly acceptedQuantity: number;
  readonly failedAtReceipt: boolean;
  /** Set on a replacement purchase. `incidentId` names the loss that it replaces, when the order has several. */
  readonly replaces?: { readonly orderId: string; readonly incidentId?: string };
}

/** A loss after handover, for example damage in transport or storage. */
export interface CostIncident {
  readonly incidentId: string;
  readonly orderId: string;
  readonly affectedQuantity: number;
  /** From `resolveIncidentCause(...).effectiveCause`. Null means unconfirmed. */
  readonly cause: Cause | null;
}

export interface CostLine {
  readonly supplierId: string;
  readonly commodity: string;
  /** Cents for each base unit (gram or millilitre). Null when no reconciled purchase exists. */
  readonly nominal: Fraction | null;
  /** C3: supplier failures count, other failures do not. A range while a cause is unconfirmed (C5). */
  readonly supplier: Range | null;
  /** C4: every failure counts. It is still real spend. */
  readonly route: Range | null;
  /** C6: the number of reconciled batches, including replacements. */
  readonly batches: number;
  readonly failures: { readonly supplier: number; readonly other: number; readonly unconfirmed: number };
  /** C6: with 0 batches, the failure risk is unknown, never 0%. */
  readonly failureRisk: "KNOWN" | "UNKNOWN";
  /** C2: purchases left out of every paid cost, with their status. */
  readonly excluded: readonly { readonly orderId: string; readonly status: ReconciliationStatus }[];
  /** Replacements whose loss cannot be identified. They are left out, never guessed. */
  readonly ambiguousReplacements: readonly string[];
}

type View = "SUPPLIER" | "ROUTE";
type UnconfirmedMode = "EXCLUDE" | "INCLUDE";

interface Loss {
  readonly cause: Cause | null;
}

const RECEIPT_FAILURE: Loss = { cause: "SUPPLIER" };

/** Builds the cost-model input for 1 purchase from its evidence and its reconciliation result. */
export function costPurchaseFrom(
  evidence: PurchaseEvidence,
  result: ReconciliationResult,
  supplierId: string,
  replaces?: CostPurchase["replaces"],
): CostPurchase {
  const accepted = evidence.deliveries
    .filter((delivery) => delivery.acceptance === "PASS")
    .reduce((total, delivery) => total + delivery.quantityReceived, 0);
  const base = {
    orderId: evidence.order.id,
    supplierId,
    commodity: evidence.order.commodity,
    reconciliation: result.status,
    orderedQuantity: evidence.order.quantity,
    totalCents: evidence.order.totalCents,
    paidCents: evidence.payments.reduce((total, payment) => total + payment.amountCents, 0),
    acceptedQuantity: accepted,
    failedAtReceipt: evidence.deliveries.some((delivery) => delivery.acceptance === "FAIL"),
  };
  return replaces === undefined ? base : { ...base, replaces };
}

function included(loss: Loss, view: View, mode: UnconfirmedMode): boolean {
  if (view === "ROUTE") return true;
  if (loss.cause === "SUPPLIER") return true;
  if (loss.cause === null || loss.cause === "UNKNOWN") return mode === "INCLUDE";
  return false;
}

function resolveLoss(
  replacement: CostPurchase,
  purchasesById: ReadonlyMap<string, CostPurchase>,
  postHandover: readonly CostIncident[],
): Loss | null {
  const target = replacement.replaces;
  if (target === undefined) return null;
  if (target.incidentId !== undefined) {
    return postHandover.find((incident) => incident.incidentId === target.incidentId) ?? null;
  }
  if (purchasesById.get(target.orderId)?.failedAtReceipt === true) return RECEIPT_FAILURE;
  const onOrder = postHandover.filter((incident) => incident.orderId === target.orderId);
  return onOrder.length === 1 ? (onOrder[0] ?? null) : null;
}

function costFor(
  view: View,
  mode: UnconfirmedMode,
  purchases: readonly CostPurchase[],
  losses: ReadonlyMap<string, Loss>,
  postHandover: readonly CostIncident[],
): Fraction | null {
  let paid = 0n;
  let quantity = 0n;
  for (const purchase of purchases) {
    if (purchase.replaces !== undefined) {
      const loss = losses.get(purchase.orderId);
      if (loss === undefined || !included(loss, view, mode)) continue;
    }
    paid += BigInt(purchase.paidCents);
    quantity += BigInt(purchase.acceptedQuantity);
  }
  for (const incident of postHandover) {
    if (included(incident, view, mode)) quantity -= BigInt(incident.affectedQuantity);
  }
  return quantity > 0n ? frac(paid, quantity) : null;
}

function rangeFor(
  view: View,
  purchases: readonly CostPurchase[],
  losses: ReadonlyMap<string, Loss>,
  postHandover: readonly CostIncident[],
): Range | null {
  const low = costFor(view, "EXCLUDE", purchases, losses, postHandover);
  const high = costFor(view, "INCLUDE", purchases, losses, postHandover);
  // No usable quantity in a bound means no cost can be stated. Report nothing rather than a guess.
  if (low === null || high === null) return null;
  return between(low, high);
}

function nominalFor(purchases: readonly CostPurchase[]): Fraction | null {
  const originals = purchases.filter((purchase) => purchase.replaces === undefined);
  const total = originals.reduce((sum, purchase) => sum + BigInt(purchase.totalCents), 0n);
  const quantity = originals.reduce((sum, purchase) => sum + BigInt(purchase.orderedQuantity), 0n);
  return quantity > 0n ? frac(total, quantity) : null;
}

/**
 * D11: the cost line for 1 supplier and 1 commodity.
 * Only reconciled purchases count (C2). The supplier view and the route view differ only in which losses count.
 */
export function computeCostLine(input: {
  readonly supplierId: string;
  readonly commodity: string;
  readonly purchases: readonly CostPurchase[];
  readonly incidents: readonly CostIncident[];
}): CostLine {
  const mine = input.purchases.filter(
    (purchase) => purchase.supplierId === input.supplierId && purchase.commodity === input.commodity,
  );
  const reconciled = mine.filter((purchase) => purchase.reconciliation === "RECONCILED");
  const excluded = mine
    .filter((purchase) => purchase.reconciliation !== "RECONCILED")
    .map((purchase) => ({ orderId: purchase.orderId, status: purchase.reconciliation }));

  const byId = new Map(reconciled.map((purchase) => [purchase.orderId, purchase] as const));
  const postHandover = input.incidents.filter((incident) => {
    const purchase = byId.get(incident.orderId);
    return purchase !== undefined && !purchase.failedAtReceipt;
  });

  const losses = new Map<string, Loss>();
  const ambiguousReplacements: string[] = [];
  for (const purchase of reconciled.filter((candidate) => candidate.replaces !== undefined)) {
    const loss = resolveLoss(purchase, byId, postHandover);
    if (loss === null) ambiguousReplacements.push(purchase.orderId);
    else losses.set(purchase.orderId, loss);
  }
  const counted = reconciled.filter((purchase) => !ambiguousReplacements.includes(purchase.orderId));

  const receiptFailures = reconciled.filter((purchase) => purchase.failedAtReceipt).length;
  const failures = postHandover.reduce(
    (tally, incident) => {
      if (incident.cause === "SUPPLIER") return { ...tally, supplier: tally.supplier + 1 };
      if (incident.cause === null || incident.cause === "UNKNOWN") {
        return { ...tally, unconfirmed: tally.unconfirmed + 1 };
      }
      return { ...tally, other: tally.other + 1 };
    },
    { supplier: receiptFailures, other: 0, unconfirmed: 0 },
  );

  return {
    supplierId: input.supplierId,
    commodity: input.commodity,
    nominal: nominalFor(counted),
    supplier: rangeFor("SUPPLIER", counted, losses, postHandover),
    route: rangeFor("ROUTE", counted, losses, postHandover),
    batches: counted.length,
    failures,
    failureRisk: counted.length === 0 ? "UNKNOWN" : "KNOWN",
    excluded,
    ambiguousReplacements,
  };
}

/** C7: a quoted price, as cents for each base unit. It is always a quote, never a paid cost. */
export function quotedCentsPerUnit(quotedCentsPer1000: number): Fraction {
  if (quotedCentsPer1000 < 0) {
    throw new DomainError("NEGATIVE_QUOTE", "A quoted price cannot be negative.");
  }
  return div(fromSafeInteger(quotedCentsPer1000, "quotedCentsPer1000"), frac(1000n));
}
