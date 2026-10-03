import { classifyByRule, resolveIncidentCause, type CauseConfirmation, type CauseStatus } from "./causes.js";
import { computeCostLine, costPurchaseFrom, quotedCentsPerUnit, type CostIncident, type CostLine, type CostPurchase } from "./cost.js";
import {
  heads,
  type CommodityProps,
  type DeliveryProps,
  type IncidentProps,
  type InvoiceProps,
  type OrderProps,
  type PaymentProps,
  type ProfileProps,
  type StoredVersion,
} from "./evidence.js";
import { div, exactText, fromSafeInteger, mul, type Fraction } from "./fraction.js";
import { marketPressure, monthlyMedians, relativeChange, type MarketPrice, type MarketPressure } from "./market.js";
import { reconcilePurchase, type PurchaseEvidence, type ReconciliationResult } from "./reconcile.js";
import { supplierEligibility, type EligibilityStatus, type FieldVerificationRef } from "./transitions.js";
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
  // Sorted by logical ID, so findings list evidence in the same order whatever order the Ontology returns objects in.
  return [...byLogicalId.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, versions]) => {
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
  /** Local lead profiles of the expansion (Phase 4). A lead with no purchase gets a line with its quote only. */
  readonly profiles?: readonly StoredRecord<ProfileProps>[];
  /** Field verifications, by supplier logical ID (C9). */
  readonly verifications?: ReadonlyMap<string, readonly FieldVerificationRef[]>;
  /** The expansion's current ration version. A verification against another version does not count (C9). */
  readonly rationVersion?: number;
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
  readonly lines: readonly {
    readonly supplierLogicalId: string;
    readonly route: Route;
    readonly commodity: string;
    readonly line: CostLine;
    /** Base units in 1 meal of this commodity (D11), or null when the expansion has no ration for it. */
    readonly quantityPerMeal: number | null;
    /** C7: a lead's quoted cents for each kilogram or litre. Always a quote, never a paid cost. */
    readonly quotedCentsPer1000: number | null;
    /** D5 and C9. Derived from field verifications only. Selection for a visit is shown from decisions. */
    readonly eligibility: EligibilityStatus;
  }[];
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
  // Lines are sorted below, so the same evidence always gives the same snapshot, whatever the Ontology's order.
  // Leads: a local supplier with a profile and no purchase gets a line too (C6: 0 batches, unknown failure risk).
  const quotes = new Map<string, number>();
  for (const { record } of activeRecords(input.profiles ?? [])) {
    const key = `${record.props.supplierLogicalId}|${record.props.commodity}`;
    quotes.set(key, record.props.quotedCentsPer1000);
    if (!pairs.has(key)) pairs.set(key, { supplierLogicalId: record.props.supplierLogicalId, commodity: record.props.commodity });
  }
  const eligibilityOf = (supplierLogicalId: string): EligibilityStatus =>
    supplierEligibility({
      currentRationVersion: input.rationVersion ?? 1,
      verifications: input.verifications?.get(supplierLogicalId) ?? [],
      selectedForVisit: false,
    });
  const perMealOf = new Map(input.commodities.map((item) => [item.commodity, item.quantityPerMeal] as const));
  const lines = [...pairs.values()]
    .sort((a, b) => a.commodity.localeCompare(b.commodity) || a.supplierLogicalId.localeCompare(b.supplierLogicalId))
    .flatMap(({ supplierLogicalId, commodity }) => {
      const route = routeOf.get(supplierLogicalId);
      if (route === undefined) return [];
      const line = computeCostLine({ supplierId: supplierLogicalId, commodity, purchases: costPurchases, incidents: costIncidents });
      return [
        {
          supplierLogicalId,
          route,
          commodity,
          line,
          quantityPerMeal: perMealOf.get(commodity) ?? null,
          quotedCentsPer1000: quotes.get(`${supplierLogicalId}|${commodity}`) ?? null,
          eligibility: eligibilityOf(supplierLogicalId),
        },
      ];
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
  /** Screen B: each purchase's reconciliation status and every finding (brief section 8). */
  readonly purchasesJson: string;
  /** Screen B: each incident's cause status and the cause the cost model used. */
  readonly incidentsJson: string;
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
  /** LEAD, VERIFIED_PASS, or VERIFIED_FAIL, from field verifications against the current ration version (C9). */
  readonly eligibility: EligibilityStatus;
  readonly excludedJson: string;
  readonly ambiguousReplacements: readonly string[];
  /** D11: exact cents for 1 meal. The browser only formats them (brief section 7: round only at presentation). */
  readonly perMealJson: string;
}

const exactOrNull = (value: Fraction | null | undefined): string | null => (value === null || value === undefined ? null : exactText(value));

/** D11: cents for 1 meal = cents for each base unit × base units in 1 meal. Exact, as text. */
function perMeal(line: CostLine, quantityPerMeal: number | null, quotedCentsPer1000: number | null) {
  if (quantityPerMeal === null) return { quantityPerMeal: null };
  const quantity = fromSafeInteger(quantityPerMeal, "quantityPerMeal");
  const perMealOf = (value: Fraction | null | undefined): Fraction | null => (value === null || value === undefined ? null : mul(value, quantity));
  // Brief section 5: meals for 1 US dollar, 100 cents divided by the cents for 1 meal. A higher cost gives fewer
  // meals, so the low end of a meals range comes from the high end of the cost range.
  const perDollarOf = (cents: Fraction | null): string | null =>
    cents === null || cents.num === 0n ? null : exactText(div(fromSafeInteger(100, "cents"), cents));
  const nominal = perMealOf(line.nominal);
  const supplierLow = perMealOf(line.supplier?.low);
  const supplierHigh = perMealOf(line.supplier?.high);
  const routeLow = perMealOf(line.route?.low);
  const routeHigh = perMealOf(line.route?.high);
  // C7: kept apart from every paid cost, so no screen can show a quote as a paid cost or a saving.
  const quoted = quotedCentsPer1000 === null ? null : perMealOf(quotedCentsPerUnit(quotedCentsPer1000));
  return {
    quantityPerMeal,
    nominal: exactOrNull(nominal),
    supplierLow: exactOrNull(supplierLow),
    supplierHigh: exactOrNull(supplierHigh),
    routeLow: exactOrNull(routeLow),
    routeHigh: exactOrNull(routeHigh),
    quoted: exactOrNull(quoted),
    mealsPerDollar: {
      nominal: perDollarOf(nominal),
      supplierLow: perDollarOf(supplierHigh),
      supplierHigh: perDollarOf(supplierLow),
      routeLow: perDollarOf(routeHigh),
      routeHigh: perDollarOf(routeLow),
      quoted: perDollarOf(quoted),
    },
  };
}

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
      purchasesJson: JSON.stringify(
        snapshot.purchases.map(({ orderLogicalId, result }) => ({ orderLogicalId, status: result.status, findings: result.findings })),
      ),
      incidentsJson: JSON.stringify(snapshot.incidents),
    },
    lines: snapshot.lines.map(({ supplierLogicalId, route, commodity, line, quantityPerMeal, quotedCentsPer1000, eligibility }) => ({
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
      quotedCentsPer1000,
      eligibility,
      excludedJson: JSON.stringify(line.excluded),
      ambiguousReplacements: line.ambiguousReplacements,
      perMealJson: JSON.stringify(perMeal(line, quantityPerMeal, quotedCentsPer1000)),
    })),
  };
}
