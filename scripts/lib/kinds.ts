import type { EvidenceKind } from "@clearspend/domain";

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
