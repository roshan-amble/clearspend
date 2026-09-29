import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyByRule,
  costPurchaseFrom,
  reconcilePurchase,
  type Cause,
  type CostIncident,
  type CostPurchase,
  type PurchaseEvidence,
} from "@clearspend/domain";
import { field, intField, readCsv, type CsvRow } from "./csv.js";
import { FIXTURE_DIR } from "./paths.js";

/** Kilograms and litres in the files become grams and millilitres in the domain (D3, D11). */
const BASE_UNITS_PER_UNIT: Readonly<Record<string, number>> = { kg: 1000, L: 1000 };

function toBaseUnits(quantity: number, unit: string, context: string): number {
  const factor = BASE_UNITS_PER_UNIT[unit];
  if (factor === undefined) {
    throw new Error(`${context}: unsupported unit "${unit}". Only kg and L are supported.`);
  }
  return quantity * factor;
}

export interface IncidentDocument {
  readonly document_id: string;
  readonly author_role: string;
  readonly recorded_at: string;
  readonly text: string;
}

export interface IncidentFixture {
  readonly source_system: string;
  readonly incident_id: string;
  readonly order_id: string;
  readonly reported_at: string;
  readonly affected_quantity_kg: number;
  readonly documents: readonly IncidentDocument[];
}

export interface SupplierProfileFixture {
  readonly source_system: string;
  readonly supplier_id: string;
  readonly commodity: string;
  readonly language: string;
  readonly quoted_price_cents_per_kg: number;
  readonly claimed_capacity_kg_per_month: number;
  readonly submitted_at: string;
  readonly text: string;
}

export interface FixtureSet {
  readonly expansion: readonly CsvRow[];
  readonly commodities: readonly CsvRow[];
  readonly suppliers: readonly CsvRow[];
  readonly orders: readonly CsvRow[];
  readonly payments: readonly CsvRow[];
  readonly invoices: readonly CsvRow[];
  readonly deliveries: readonly CsvRow[];
  readonly incidents: readonly IncidentFixture[];
  readonly profiles: readonly SupplierProfileFixture[];
  readonly verificationsInitial: readonly CsvRow[];
  readonly verificationsLater: readonly CsvRow[];
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf-8")) as T;
}

export function loadFixtures(): FixtureSet {
  const csv = (name: string) => readCsv(join(FIXTURE_DIR, name));
  return {
    expansion: csv("expansion.csv"),
    commodities: csv("expansion-commodities.csv"),
    suppliers: csv("suppliers.csv"),
    orders: csv("orders.csv"),
    payments: csv("payments.csv"),
    invoices: csv("invoices.csv"),
    deliveries: csv("deliveries.csv"),
    incidents: readJson<IncidentFixture[]>("incidents.json"),
    profiles: readJson<SupplierProfileFixture[]>("supplier-profiles.json"),
    verificationsInitial: csv("field-verifications-initial.csv"),
    verificationsLater: csv("field-verifications-later.csv"),
  };
}

/** The active evidence for 1 order, in base units, ready for `reconcilePurchase`. */
export function purchaseEvidence(set: FixtureSet, orderId: string): PurchaseEvidence {
  const order = set.orders.find((row) => row.order_id === orderId);
  if (order === undefined) throw new Error(`No order ${orderId}.`);
  const ctx = `orders.csv ${orderId}`;
  const unit = field(order, "unit", ctx);
  return {
    order: {
      id: orderId,
      commodity: field(order, "commodity", ctx),
      quantity: toBaseUnits(intField(order, "quantity", ctx), unit, ctx),
      unitPriceCentsPer1000: intField(order, "unit_price_cents", ctx),
      totalCents: intField(order, "total_cents", ctx),
      currency: field(order, "currency", ctx),
    },
    payments: set.payments
      .filter((row) => row.order_id === orderId)
      .map((row) => ({
        id: field(row, "payment_id", "payments.csv"),
        amountCents: intField(row, "amount_cents", "payments.csv"),
        currency: field(row, "currency", "payments.csv"),
        hasConflictingVersion: false,
      })),
    invoices: set.invoices
      .filter((row) => row.order_id === orderId)
      .map((row) => ({
        id: field(row, "invoice_id", "invoices.csv"),
        commodity: field(row, "commodity", "invoices.csv"),
        quantity: toBaseUnits(intField(row, "quantity", "invoices.csv"), field(row, "unit", "invoices.csv"), "invoices.csv"),
        totalCents: intField(row, "total_cents", "invoices.csv"),
        currency: field(row, "currency", "invoices.csv"),
      })),
    deliveries: set.deliveries
      .filter((row) => row.order_id === orderId)
      .map((row) => {
        const acceptance = field(row, "acceptance_result", "deliveries.csv");
        if (acceptance !== "PASS" && acceptance !== "FAIL" && acceptance !== "NOT_TESTED") {
          throw new Error(`deliveries.csv: unknown acceptance_result "${acceptance}".`);
        }
        return {
          id: field(row, "receipt_id", "deliveries.csv"),
          quantityReceived: toBaseUnits(
            intField(row, "quantity_received", "deliveries.csv"),
            field(row, "unit", "deliveries.csv"),
            "deliveries.csv",
          ),
          acceptance,
        };
      }),
  };
}

/** The cost-model input for every order, with each order's reconciliation result. */
export function costPurchases(set: FixtureSet): CostPurchase[] {
  return set.orders.map((order) => {
    const orderId = field(order, "order_id", "orders.csv");
    const evidence = purchaseEvidence(set, orderId);
    const replacesOrder = field(order, "replaces_order_id", "orders.csv");
    const replacesIncident = field(order, "replaces_incident_id", "orders.csv");
    const replaces =
      replacesOrder === ""
        ? undefined
        : replacesIncident === ""
          ? { orderId: replacesOrder }
          : { orderId: replacesOrder, incidentId: replacesIncident };
    return costPurchaseFrom(evidence, reconcilePurchase(evidence), field(order, "supplier_id", "orders.csv"), replaces);
  });
}

/**
 * The incidents for the cost model. A rule result wins (D5). Otherwise the cause comes from `confirmed`,
 * which stands for a person's confirmation. A missing entry means unconfirmed.
 */
export function costIncidents(set: FixtureSet, confirmed: Readonly<Record<string, Cause>>): CostIncident[] {
  return set.incidents.map((incident) => {
    const deliveries = purchaseEvidence(set, incident.order_id).deliveries;
    const ruleCause = classifyByRule(deliveries);
    return {
      incidentId: incident.incident_id,
      orderId: incident.order_id,
      affectedQuantity: incident.affected_quantity_kg * 1000,
      cause: ruleCause ?? confirmed[incident.incident_id] ?? null,
    };
  });
}
