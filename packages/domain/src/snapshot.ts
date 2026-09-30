import { classifyByRule, resolveIncidentCause, type CauseConfirmation, type CauseStatus } from "./causes.js";
import { computeCostLine, costPurchaseFrom, type CostIncident, type CostLine, type CostPurchase } from "./cost.js";
import {
  heads,
  type CommodityProps,
  type DeliveryProps,
  type IncidentProps,
  type InvoiceProps,
  type OrderProps,
  type PaymentProps,
  type StoredVersion,
} from "./evidence.js";
import { exactText, type Fraction } from "./fraction.js";
import { marketPressure, monthlyMedians, relativeChange, type MarketPrice, type MarketPressure } from "./market.js";
import { reconcilePurchase, type PurchaseEvidence, type ReconciliationResult } from "./reconcile.js";
import type { Cause, Route } from "./types.js";

/** 1 stored version of an evidence record, as the Action loads it from the Ontology. */
export interface StoredRecord<P> extends StoredVersion {
  readonly logicalId: string;
  /** ISO 8601 UTC. Orders conflicting heads, earliest first. */
  readonly importedAt: string;
  readonly props: P;
}

export interface ActiveRecord<P> {
  readonly record: StoredRecord<P>;
  /** D4: 2 or more versions that no version supersedes. The record cannot reconcile until a person resolves it. */
  readonly conflicting: boolean;
}

/** D4 active set: 1 record for each logical ID. A superseded version never counts, so a correction is not added. */
export function activeRecords<P>(records: readonly StoredRecord<P>[]): ActiveRecord<P>[] {
  const byLogicalId = new Map<string, StoredRecord<P>[]>();
  for (const record of records) byLogicalId.set(record.logicalId, [...(byLogicalId.get(record.logicalId) ?? []), record]);
  return [...byLogicalId.values()].map((versions) => {
    const headIds = new Set(heads(versions).map((version) => version.versionId));
    const current = versions
      .filter((version) => headIds.has(version.versionId))
      .sort((a, b) => a.importedAt.localeCompare(b.importedAt) || a.versionId.localeCompare(b.versionId));
    return { record: current[0] as StoredRecord<P>, conflicting: current.length > 1 };
  });
}

export interface SnapshotInput {
  readonly suppliers: readonly { readonly logicalId: string; readonly route: Route }[];
  readonly commodities: readonly CommodityProps[];
  readonly orders: readonly StoredRecord<OrderProps>[];
  readonly payments: readonly StoredRecord<PaymentProps>[];
  readonly invoices: readonly StoredRecord<InvoiceProps>[];
  readonly deliveries: readonly StoredRecord<DeliveryProps>[];
  readonly incidents: readonly StoredRecord<IncidentProps>[];
  /** CONFIRM_CAUSE decisions, by incident logical ID. */
  readonly confirmations: ReadonlyMap<string, readonly CauseConfirmation[]>;
  readonly marketPrices: readonly MarketPrice[];
}

export interface SeriesChange {
  readonly series: string;
  readonly route: Route;
  readonly firstMonth: string;
  readonly lastMonth: string;
  /** Null when the series has no price in the first month. The change is then unknown, never guessed. */
  readonly firstMedianMicros: Fraction | null;
  readonly lastMedianMicros: Fraction;
  readonly change: Fraction | null;
}

export interface CommodityMarket {
  readonly commodity: string;
  readonly pressure: MarketPressure;
  readonly series: readonly SeriesChange[];
}

export interface Snapshot {
  readonly purchases: readonly { readonly orderLogicalId: string; readonly result: ReconciliationResult }[];
  readonly incidents: readonly {
    readonly incidentLogicalId: string;
    readonly versionId: string;
    readonly orderLogicalId: string;
    readonly status: CauseStatus;
    readonly effectiveCause: Cause | null;
  }[];
  readonly lines: readonly { readonly supplierLogicalId: string; readonly route: Route; readonly commodity: string; readonly line: CostLine }[];
  readonly market: readonly CommodityMarket[];
  /** I8: the latest market month that the snapshot used. */
  readonly marketDataAsOf: string | null;
}

/** "2026-08" minus 11 months is "2025-09". */
export function addMonths(month: string, count: number): string {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (monthNumber - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** D11 C8: the 12-month change of the real median, from the month 11 months before the latest month. */
function seriesChange(prices: readonly MarketPrice[], series: string, route: Route): SeriesChange | null {
  const medians = monthlyMedians(prices, series);
  const lastMonth = [...medians.keys()].at(-1);
  if (lastMonth === undefined) return null;
  const firstMonth = addMonths(lastMonth, -11);
  const first = medians.get(firstMonth) ?? null;
  const last = medians.get(lastMonth) as Fraction;
  return {
    series,
    route,
    firstMonth,
    lastMonth,
    firstMedianMicros: first,
    lastMedianMicros: last,
    change: first === null ? null : relativeChange(first, last),
  };
}

/**
 * D6.2: everything a CsCostSnapshot holds, from the stored evidence of 1 expansion. Pure: the Action loads the
 * objects, calls this, and writes the result. The same code runs in the tests against the story fixtures.
 */
export function buildSnapshot(input: SnapshotInput): Snapshot {
  const routeOf = new Map(input.suppliers.map((supplier) => [supplier.logicalId, supplier.route] as const));
  const payments = activeRecords(input.payments);
  const invoices = activeRecords(input.invoices);
  const deliveries = activeRecords(input.deliveries);

  const evidenceByOrder = new Map<string, PurchaseEvidence>();
  const purchases: { orderLogicalId: string; result: ReconciliationResult }[] = [];
  const costPurchases: CostPurchase[] = [];
  for (const { record: order, conflicting } of activeRecords(input.orders)) {
    const id = order.logicalId;
    const evidence: PurchaseEvidence = {
      order: {
        id,
        commodity: order.props.commodity,
        quantity: order.props.quantity,
        unitPriceCentsPer1000: order.props.unitPriceCentsPer1000,
        totalCents: order.props.totalCents,
        currency: order.props.currency,
        hasConflictingVersion: conflicting,
      },
      payments: payments
        .filter((payment) => payment.record.props.orderLogicalId === id)
        .map((payment) => ({
          id: payment.record.logicalId,
          amountCents: payment.record.props.amountCents,
          currency: payment.record.props.currency,
          hasConflictingVersion: payment.conflicting,
        })),
      invoices: invoices
        .filter((invoice) => invoice.record.props.orderLogicalId === id)
        .map((invoice) => ({
          id: invoice.record.logicalId,
          commodity: invoice.record.props.commodity,
          quantity: invoice.record.props.quantity,
          totalCents: invoice.record.props.totalCents,
          currency: invoice.record.props.currency,
          hasConflictingVersion: invoice.conflicting,
        })),
      deliveries: deliveries
        .filter((delivery) => delivery.record.props.orderLogicalId === id)
        .map((delivery) => ({
          id: delivery.record.logicalId,
          quantityReceived: delivery.record.props.quantityReceived,
          acceptance: delivery.record.props.acceptanceResult,
        })),
    };
    const result = reconcilePurchase(evidence);
    const replacesOrder = order.props.replacesOrderLogicalId;
    const replacesIncident = order.props.replacesIncidentLogicalId;
    const replaces =
      replacesOrder === null
        ? undefined
        : replacesIncident === null
          ? { orderId: replacesOrder }
          : { orderId: replacesOrder, incidentId: replacesIncident };
    evidenceByOrder.set(id, evidence);
    purchases.push({ orderLogicalId: id, result });
    costPurchases.push(costPurchaseFrom(evidence, result, order.props.supplierLogicalId, replaces));
  }

  const incidents = activeRecords(input.incidents).map(({ record }) => {
    const ruleCause = classifyByRule(evidenceByOrder.get(record.props.orderLogicalId)?.deliveries ?? []);
    const resolved = resolveIncidentCause({
      ruleCause,
      aiProposals: [],
      confirmations: input.confirmations.get(record.logicalId) ?? [],
    });
    return {
      incidentLogicalId: record.logicalId,
      versionId: record.versionId,
      orderLogicalId: record.props.orderLogicalId,
      status: resolved.status,
      effectiveCause: resolved.effectiveCause,
      affectedQuantity: record.props.affectedQuantity,
    };
  });
  const costIncidents: CostIncident[] = incidents.map((incident) => ({
    incidentId: incident.incidentLogicalId,
    orderId: incident.orderLogicalId,
    affectedQuantity: incident.affectedQuantity,
    cause: incident.effectiveCause,
  }));

  const pairs = new Map<string, { supplierLogicalId: string; commodity: string }>();
  for (const purchase of costPurchases) {
    pairs.set(`${purchase.supplierId}|${purchase.commodity}`, { supplierLogicalId: purchase.supplierId, commodity: purchase.commodity });
  }
  // Sorted, so the same evidence always gives the same snapshot, whatever order the Ontology returns objects in.
  const sortedPairs = [...pairs.values()].sort(
    (a, b) => a.commodity.localeCompare(b.commodity) || a.supplierLogicalId.localeCompare(b.supplierLogicalId),
  );
  const lines = sortedPairs.flatMap(({ supplierLogicalId, commodity }) => {
    const route = routeOf.get(supplierLogicalId);
    if (route === undefined) return [];
    const line = computeCostLine({ supplierId: supplierLogicalId, commodity, purchases: costPurchases, incidents: costIncidents });
    return [{ supplierLogicalId, route, commodity, line }];
  });

  const market = [...input.commodities].sort((a, b) => a.commodity.localeCompare(b.commodity)).map((commodity) => {
    const seriesByRoute: [string, Route][] = [
      [commodity.marketSeriesLocal, "LOCAL"],
      [commodity.marketSeriesImport, "IMPORT"],
    ];
    return {
      commodity: commodity.commodity,
      pressure: marketPressure({
        plannedPerMonth: commodity.plannedPerMonth,
        marketVolumeEstimatePerMonth: commodity.marketVolumeEstimatePerMonth,
      }),
      series: seriesByRoute.flatMap(([series, route]) => {
        const change = seriesChange(input.marketPrices, series, route);
        return change === null ? [] : [change];
      }),
    };
  });
  const months = input.marketPrices.map((price) => price.month).sort();

  return {
    purchases: purchases.sort((a, b) => a.orderLogicalId.localeCompare(b.orderLogicalId)),
    incidents: incidents
      .map(({ affectedQuantity: _unused, ...incident }) => incident)
      .sort((a, b) => a.incidentLogicalId.localeCompare(b.incidentLogicalId)),
    lines,
    market,
    marketDataAsOf: months.at(-1) ?? null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Storage records. Property names are the Ontology API names (scripts/lib/ontology.ts).

export interface CostSnapshotProps {
  readonly snapshotId: string;
  readonly expansionId: string;
  readonly evidenceRevision: number;
  readonly rulesVersion: string;
  readonly createdAt: string;
  readonly marketIndicatorsJson: string;
  readonly marketDataAsOf: string | null;
}

export interface CostLineProps {
  readonly costLineId: string;
  readonly snapshotId: string;
  readonly expansionId: string;
  readonly supplierLogicalId: string;
  readonly route: Route;
  readonly commodity: string;
  readonly nominalExact: string | null;
  readonly supplierLowExact: string | null;
  readonly supplierHighExact: string | null;
  readonly routeLowExact: string | null;
  readonly routeHighExact: string | null;
  readonly batchCount: number;
  readonly supplierFailures: number;
  readonly otherFailures: number;
  readonly unconfirmedFailures: number;
  readonly failureRisk: "KNOWN" | "UNKNOWN";
  readonly quotedCentsPer1000: number | null;
  /** Phase 2 has no field verifications yet (CsFieldVerification is Phase 4), so eligibility is not assessed. */
  readonly eligibility: string;
  readonly excludedJson: string;
  readonly ambiguousReplacements: readonly string[];
}

const exactOrNull = (value: Fraction | null | undefined): string | null => (value === null || value === undefined ? null : exactText(value));

/** The objects that 1 snapshot writes: 1 CsCostSnapshot and 1 CsCostLine for each supplier and commodity. */
export function snapshotRecords(
  snapshot: Snapshot,
  meta: { readonly expansionId: string; readonly evidenceRevision: number; readonly rulesVersion: string; readonly createdAt: string },
): { readonly snapshot: CostSnapshotProps; readonly lines: readonly CostLineProps[] } {
  const snapshotId = `${meta.expansionId}@${meta.evidenceRevision}`;
  const market = snapshot.market.map((entry) => ({
    commodity: entry.commodity,
    pressureShare: exactText(entry.pressure.share),
    pressureFlagged: entry.pressure.flagged,
    series: entry.series.map((series) => ({
      series: series.series,
      route: series.route,
      firstMonth: series.firstMonth,
      lastMonth: series.lastMonth,
      firstMedianMicros: exactOrNull(series.firstMedianMicros),
      lastMedianMicros: exactText(series.lastMedianMicros),
      change: exactOrNull(series.change),
    })),
  }));
  return {
    snapshot: {
      snapshotId,
      expansionId: meta.expansionId,
      evidenceRevision: meta.evidenceRevision,
      rulesVersion: meta.rulesVersion,
      createdAt: meta.createdAt,
      marketIndicatorsJson: JSON.stringify(market),
      marketDataAsOf: snapshot.marketDataAsOf,
    },
    lines: snapshot.lines.map(({ supplierLogicalId, route, commodity, line }) => ({
      costLineId: `${snapshotId}:${supplierLogicalId}:${commodity}`,
      snapshotId,
      expansionId: meta.expansionId,
      supplierLogicalId,
      route,
      commodity,
      nominalExact: exactOrNull(line.nominal),
      supplierLowExact: exactOrNull(line.supplier?.low),
      supplierHighExact: exactOrNull(line.supplier?.high),
      routeLowExact: exactOrNull(line.route?.low),
      routeHighExact: exactOrNull(line.route?.high),
      batchCount: line.batches,
      supplierFailures: line.failures.supplier,
      otherFailures: line.failures.other,
      unconfirmedFailures: line.failures.unconfirmed,
      failureRisk: line.failureRisk,
      quotedCentsPer1000: null,
      eligibility: "NOT_ASSESSED",
      excludedJson: JSON.stringify(line.excluded),
      ambiguousReplacements: line.ambiguousReplacements,
    })),
  };
}
