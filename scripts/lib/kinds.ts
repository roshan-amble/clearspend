import type { EvidenceKind } from "@clearspend/domain";

/** Later evidence batches (scenario 5), applied after the main files. See data/fixtures/later/README.md. */
export const LATER_FILES: readonly { readonly kind: EvidenceKind; readonly file: string }[] = [
  { kind: "payments", file: "later/payments-replay.csv" },
  { kind: "deliveries", file: "later/deliveries-correction.csv" },
];

/** The fixture file and the Cs object type for each import kind (D4). */
export const KIND_FILES: Readonly<Record<EvidenceKind, { readonly file: string; readonly objectType: string }>> = {
  expansion: { file: "expansion.csv", objectType: "CsExpansion" },
  "expansion-commodities": { file: "expansion-commodities.csv", objectType: "CsExpansionCommodity" },
  suppliers: { file: "suppliers.csv", objectType: "CsSupplier" },
  "supplier-profiles": { file: "supplier-profiles.json", objectType: "CsSupplierProfileVersion" },
  orders: { file: "orders.csv", objectType: "CsPurchaseOrder" },
  payments: { file: "payments.csv", objectType: "CsPayment" },
  invoices: { file: "invoices.csv", objectType: "CsInvoice" },
  deliveries: { file: "deliveries.csv", objectType: "CsDelivery" },
  incidents: { file: "incidents.json", objectType: "CsIncident" },
};
