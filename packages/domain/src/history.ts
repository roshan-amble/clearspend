import { add, compare, div, exactText, frac, parseExactText, type Fraction } from "./fraction.js";
import { monthlyMedians } from "./market.js";
import { activeRecords, buildSnapshot, type SnapshotInput } from "./snapshot.js";

/**
 * UI5 A (Roshan, 2026-09-30): the monthly series behind the price screens, computed on the server from the same
 * stored evidence as the snapshot. The browser only formats them (D2). Every value is an integer or exact text.
 * Only reconciled purchases count toward spend and volume, as in the cost model (C2).
 */
export interface PriceMonth {
  readonly month: string;
  /** Payments on reconciled orders recorded this month. */
  readonly paidCents: number;
  /** Payments on orders that are not reconciled, kept apart (C2). */
  readonly unreconciledCents: number;
  /** Base units that passed the receipt test and were not lost later, by delivery month. */
  readonly acceptedBase: number;
  readonly failedSupplierBase: number;
  readonly failedOtherBase: number;
  readonly failedUnconfirmedBase: number;
}

export interface CommodityHistory {
  readonly commodity: string;
  readonly baseUnit: string;
  readonly months: readonly PriceMonth[];
  readonly purchases: readonly {
    readonly orderLogicalId: string;
    readonly supplierLogicalId: string;
    readonly recordedAt: string;
    readonly unitPriceCentsPer1000: number;
    readonly reconciled: boolean;
  }[];
  readonly quotes: readonly { readonly supplierLogicalId: string; readonly submittedAt: string; readonly quotedCentsPer1000: number }[];
  /** WFP monthly medians, micro-dollars per kilogram or litre, as exact text. */
  readonly market: readonly { readonly series: string; readonly route: "LOCAL" | "IMPORT"; readonly points: readonly { readonly month: string; readonly medianMicros: string }[] }[];
  /** UI4 A: a declared budget, cents per 1,000 base units. Display only: it never enters the cost model. */
  readonly targetCentsPer1000: number | null;
  /**
   * P17: the 1 simple chart of an ingredient: for each month, the price we paid (the mean of that month's purchase
   * prices) and the lowest price on the market (the lower of WFP's local and import medians). Cents per 1,000 base
   * units, as exact text; null where there is no purchase or no market price that month.
   */
  readonly chart: readonly { readonly month: string; readonly ours: string | null; readonly lowest: string | null }[];
}

/** WFP medians are micro-dollars per kg or L: 10,000 micro-dollars = 1 cent, so ÷ 10,000 gives cents per 1,000 base units. */
const centsPer1000FromMicros = (micros: string): Fraction => div(parseExactText(micros), frac(10_000n));

export function priceChart(
  purchases: readonly { readonly recordedAt: string; readonly unitPriceCentsPer1000: number }[],
  market: readonly { readonly points: readonly { readonly month: string; readonly medianMicros: string }[] }[],
): CommodityHistory["chart"] {
  const months = [...new Set([...purchases.map((p) => p.recordedAt.slice(0, 7)), ...market.flatMap((s) => s.points.map((point) => point.month))])].sort();
  return months.map((month) => {
    const paid = purchases.filter((p) => p.recordedAt.slice(0, 7) === month);
    const ours = paid.length === 0 ? null : div(paid.reduce((total, p) => add(total, frac(BigInt(p.unitPriceCentsPer1000))), frac(0n)), frac(BigInt(paid.length)));
    const medians = market.flatMap((s) => s.points.filter((point) => point.month === month).map((point) => centsPer1000FromMicros(point.medianMicros)));
    const lowest = medians.reduce<Fraction | null>((best, value) => (best === null || compare(value, best) < 0 ? value : best), null);
    return { month, ours: ours === null ? null : exactText(ours), lowest: lowest === null ? null : exactText(lowest) };
  });
}

export interface PriceHistory {
  readonly commodities: readonly CommodityHistory[];
}

const monthOf = (iso: string): string => iso.slice(0, 7);

type Totals = { -readonly [K in Exclude<keyof PriceMonth, "month">]: number };

function bucket(map: Map<string, Totals>, month: string): Totals {
  const existing = map.get(month);
  if (existing !== undefined) return existing;
  const fresh = { paidCents: 0, unreconciledCents: 0, acceptedBase: 0, failedSupplierBase: 0, failedOtherBase: 0, failedUnconfirmedBase: 0 };
  map.set(month, fresh);
  return fresh;
}

export function priceHistory(input: SnapshotInput & { readonly targets?: ReadonlyMap<string, number> }): PriceHistory {
  const snapshot = buildSnapshot(input);
  const reconciled = new Set(snapshot.purchases.filter((p) => p.result.status === "RECONCILED").map((p) => p.orderLogicalId));
  const orders = activeRecords(input.orders).map(({ record }) => record);
  const orderById = new Map(orders.map((order) => [order.logicalId, order] as const));
  const causeOf = new Map(snapshot.incidents.map((incident) => [incident.incidentLogicalId, incident.effectiveCause] as const));
  const deliveries = activeRecords(input.deliveries).map(({ record }) => record);
  const incidents = activeRecords(input.incidents).map(({ record }) => record);
  const payments = activeRecords(input.payments).map(({ record }) => record);

  const commodities: CommodityHistory[] = input.commodities
    .map((commodity) => {
      const months = new Map<string, Totals>();
      const own = orders.filter((order) => order.props.commodity === commodity.commodity);
      const ownIds = new Set(own.map((order) => order.logicalId));
      for (const payment of payments.filter((p) => ownIds.has(p.props.orderLogicalId))) {
        const order = orderById.get(payment.props.orderLogicalId);
        if (order === undefined) continue;
        const b = bucket(months, monthOf(order.props.recordedAt));
        if (reconciled.has(order.logicalId)) b.paidCents += payment.props.amountCents;
        else b.unreconciledCents += payment.props.amountCents;
      }
      // The delivery month of each reconciled order, where its later losses are counted.
      const deliveryMonth = new Map<string, string>();
      for (const delivery of deliveries.filter((d) => reconciled.has(d.props.orderLogicalId) && ownIds.has(d.props.orderLogicalId))) {
        const month = monthOf(delivery.props.receivedAt);
        const b = bucket(months, month);
        if (delivery.props.acceptanceResult === "PASS") {
          b.acceptedBase += delivery.props.quantityReceived;
          if (!deliveryMonth.has(delivery.props.orderLogicalId)) deliveryMonth.set(delivery.props.orderLogicalId, month);
        } else {
          b.failedSupplierBase += delivery.props.quantityReceived;
        }
      }
      for (const incident of incidents.filter((i) => deliveryMonth.has(i.props.orderLogicalId))) {
        const b = bucket(months, deliveryMonth.get(incident.props.orderLogicalId) as string);
        const cause = causeOf.get(incident.logicalId) ?? null;
        b.acceptedBase -= incident.props.affectedQuantity;
        if (cause === null) b.failedUnconfirmedBase += incident.props.affectedQuantity;
        else if (cause === "SUPPLIER") b.failedSupplierBase += incident.props.affectedQuantity;
        else b.failedOtherBase += incident.props.affectedQuantity;
      }
      const market = (
        [
          [commodity.marketSeriesLocal, "LOCAL"],
          [commodity.marketSeriesImport, "IMPORT"],
        ] as const
      )
        .filter(([series], index, all) => all.findIndex(([other]) => other === series) === index)
        .map(([series, route]) => ({
          series,
          route,
          points: [...monthlyMedians(input.marketPrices, series)].map(([month, value]) => ({ month, medianMicros: exactText(value) })),
        }));
      const purchases = own
        .map((order) => ({
          orderLogicalId: order.logicalId,
          supplierLogicalId: order.props.supplierLogicalId,
          recordedAt: order.props.recordedAt,
          unitPriceCentsPer1000: order.props.unitPriceCentsPer1000,
          reconciled: reconciled.has(order.logicalId),
        }))
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.orderLogicalId.localeCompare(b.orderLogicalId));
      return {
        commodity: commodity.commodity,
        baseUnit: commodity.baseUnit,
        months: [...months.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, totals]) => ({ month, ...totals })),
        purchases,
        quotes: activeRecords(input.profiles ?? [])
          .map(({ record }) => record)
          .filter((profile) => profile.props.commodity === commodity.commodity)
          .map((profile) => ({
            supplierLogicalId: profile.props.supplierLogicalId,
            submittedAt: profile.props.submittedAt,
            quotedCentsPer1000: profile.props.quotedCentsPer1000,
          }))
          .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.supplierLogicalId.localeCompare(b.supplierLogicalId)),
        market,
        targetCentsPer1000: input.targets?.get(commodity.commodity) ?? null,
        chart: priceChart(purchases, market),
      };
    })
    .sort((a, b) => a.commodity.localeCompare(b.commodity));
  return { commodities };
}
