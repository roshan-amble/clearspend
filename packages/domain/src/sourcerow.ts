import type { DeliveryProps, IncidentProps, InvoiceProps, OrderProps, PaymentProps, ProfileProps } from "./evidence.js";

/**
 * UI3 A: the data studio edits a stored record by writing its source row again, so a correction goes through the
 * same import Action and D4 rules as a file. This is the inverse of `parseEvidenceRows` for the kinds the studio
 * edits. An unchanged record gives a row that parses back to the same props, so its import is a REPLAYED no-op.
 */
export type EditableKind = "orders" | "payments" | "invoices" | "deliveries" | "incidents" | "supplier-profiles";

export const EDITABLE_KINDS: readonly EditableKind[] = ["orders", "payments", "invoices", "deliveries", "incidents", "supplier-profiles"];

type Row = Record<string, unknown>;

/** The part of a logical ID after "sourceSystem:", which is the source's own ID. */
const externalOf = (logicalId: string): string => logicalId.slice(logicalId.lastIndexOf(":") + 1);
const sourceOf = (logicalId: string): string => logicalId.slice(0, logicalId.lastIndexOf(":"));

export function sourceRowOf(kind: "orders", logicalId: string, props: OrderProps): Row;
export function sourceRowOf(kind: "payments", logicalId: string, props: PaymentProps): Row;
export function sourceRowOf(kind: "invoices", logicalId: string, props: InvoiceProps): Row;
export function sourceRowOf(kind: "deliveries", logicalId: string, props: DeliveryProps): Row;
export function sourceRowOf(kind: "incidents", logicalId: string, props: IncidentProps): Row;
export function sourceRowOf(kind: "supplier-profiles", logicalId: string, props: ProfileProps): Row;
export function sourceRowOf(kind: EditableKind, logicalId: string, props: unknown): Row {
  const source_system = sourceOf(logicalId);
  switch (kind) {
    case "orders": {
      const p = props as OrderProps;
      return {
        source_system,
        order_id: externalOf(logicalId),
        expansion_id: p.expansionId,
        supplier_id: externalOf(p.supplierLogicalId),
        commodity: p.commodity,
        unit: p.sourceUnit,
        quantity: p.sourceQuantity,
        unit_price_cents: p.unitPriceCentsPer1000,
        total_cents: p.totalCents,
        currency: p.currency,
        replaces_order_id: p.replacesOrderLogicalId === null ? "" : externalOf(p.replacesOrderLogicalId),
        replaces_incident_id: p.replacesIncidentLogicalId === null ? "" : externalOf(p.replacesIncidentLogicalId),
        recorded_at: p.recordedAt,
      };
    }
    case "payments": {
      const p = props as PaymentProps;
      return { source_system, payment_id: externalOf(logicalId), order_id: externalOf(p.orderLogicalId), amount_cents: p.amountCents, currency: p.currency, paid_at: p.paidAt };
    }
    case "invoices": {
      const p = props as InvoiceProps;
      return {
        source_system,
        invoice_id: externalOf(logicalId),
        order_id: externalOf(p.orderLogicalId),
        commodity: p.commodity,
        unit: p.sourceUnit,
        quantity: p.sourceQuantity,
        unit_price_cents: p.unitPriceCentsPer1000,
        total_cents: p.totalCents,
        currency: p.currency,
        recorded_at: p.recordedAt,
      };
    }
    case "deliveries": {
      const p = props as DeliveryProps;
      return {
        source_system,
        receipt_id: externalOf(logicalId),
        order_id: externalOf(p.orderLogicalId),
        commodity: p.commodity,
        unit: p.sourceUnit,
        quantity_received: p.sourceQuantityReceived,
        received_at: p.receivedAt,
        handover_at: p.handoverAt,
        moisture_permille: p.moisturePermille === null ? "" : p.moisturePermille,
        acceptance_result: p.acceptanceResult,
      };
    }
    case "incidents": {
      const p = props as IncidentProps;
      return {
        source_system,
        incident_id: externalOf(logicalId),
        order_id: externalOf(p.orderLogicalId),
        reported_at: p.reportedAt,
        affected_quantity_kg: p.sourceAffectedQuantity,
        documents: p.documents.map((d) => ({ document_id: d.documentId, author_role: d.authorRole, recorded_at: d.recordedAt, text: d.text })),
      };
    }
    case "supplier-profiles": {
      const p = props as ProfileProps;
      return {
        source_system,
        supplier_id: externalOf(p.supplierLogicalId),
        commodity: p.commodity,
        language: p.language,
        quoted_price_cents_per_kg: p.quotedCentsPer1000,
        claimed_capacity_kg_per_month: p.sourceClaimedCapacityPerMonth,
        submitted_at: p.submittedAt,
        text: p.text,
      };
    }
  }
}
