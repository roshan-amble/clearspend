import type { Osdk } from "@osdk/client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { client } from "../client";
import { describe } from "../command";
import {
  CsAiRun,
  CsCauseProposal,
  CsCostLine,
  CsCostSnapshot,
  CsDecision,
  CsDelivery,
  CsExpansion,
  CsExpansionCommodity,
  CsFieldVerification,
  CsImportBatch,
  CsIncident,
  CsOutreachMessage,
  CsPurchaseOrder,
  CsSupplier,
  CsSupplierProfileVersion,
  csPriceHistory,
} from "../sdk";
import { incidentViews, purchaseViews, type IncidentView, type PurchaseView } from "../view";


/**
 * Everything the screens of 1 expansion show, loaded once and reloaded after each write (D2 decision 5).
 * Every number is stored in Foundry or computed by a ClearSpend function; the browser only formats (D2).
 */
export interface ExpansionData {
  readonly expansion: Osdk.Instance<CsExpansion>;
  readonly snapshot: Osdk.Instance<CsCostSnapshot>;
  readonly lines: readonly Osdk.Instance<CsCostLine>[];
  /** Every snapshot, oldest first, with its lines: the metric history (I1). */
  readonly history: readonly { readonly snapshot: Osdk.Instance<CsCostSnapshot>; readonly lines: readonly Osdk.Instance<CsCostLine>[] }[];
  readonly commodities: ReadonlyMap<string, Osdk.Instance<CsExpansionCommodity>>;
  readonly suppliers: ReadonlyMap<string, Osdk.Instance<CsSupplier>>;
  readonly orders: ReadonlyMap<string, Osdk.Instance<CsPurchaseOrder>>;
  readonly deliveries: readonly Osdk.Instance<CsDelivery>[];
  readonly incidentObjects: ReadonlyMap<string, Osdk.Instance<CsIncident>>;
  readonly purchases: readonly PurchaseView[];
  readonly incidents: readonly IncidentView[];
  readonly decisions: readonly Osdk.Instance<CsDecision>[];
  readonly aiRuns: readonly Osdk.Instance<CsAiRun>[];
  readonly causeProposals: readonly Osdk.Instance<CsCauseProposal>[];
  readonly verifications: readonly Osdk.Instance<CsFieldVerification>[];
  readonly imports: readonly Osdk.Instance<CsImportBatch>[];
  readonly outreach: readonly Osdk.Instance<CsOutreachMessage>[];
  /** The latest profile version of each lead, by supplier logical ID. */
  readonly profiles: ReadonlyMap<string, Osdk.Instance<CsSupplierProfileVersion>>;
  /** csPriceHistory (UI5), or null when the query failed. Then `priceHistoryError` says why, and the price charts show it. */
  readonly priceHistory: PriceHistoryJson | null;
  readonly priceHistoryError: string | null;
}

export interface PriceHistoryJson {
  readonly evidenceRevision: number;
  readonly commodities: readonly {
    readonly commodity: string;
    readonly baseUnit: string;
    readonly months: readonly { readonly month: string; readonly paidCents: number; readonly unreconciledCents: number; readonly acceptedBase: number; readonly failedSupplierBase: number; readonly failedOtherBase: number; readonly failedUnconfirmedBase: number }[];
    readonly purchases: readonly { readonly orderLogicalId: string; readonly supplierLogicalId: string; readonly recordedAt: string; readonly unitPriceCentsPer1000: number; readonly reconciled: boolean }[];
    readonly quotes: readonly { readonly supplierLogicalId: string; readonly submittedAt: string; readonly quotedCentsPer1000: number }[];
    readonly market: readonly { readonly series: string; readonly route: string; readonly points: readonly { readonly month: string; readonly medianMicros: string }[] }[];
    readonly targetCentsPer1000: number | null;
  }[];
}

async function all<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

const byTime =
  <T,>(time: (item: T) => string | undefined) =>
  (a: T, b: T): number =>
    (time(a) ?? "").localeCompare(time(b) ?? "");

/** UI5: the monthly series, computed by the query function on the server. The browser only formats them (D2). */
async function loadPriceHistory(expansionId: string): Promise<PriceHistoryJson> {
  return JSON.parse(await client(csPriceHistory).executeFunction({ expansionId })) as PriceHistoryJson;
}

async function load(expansionId: string): Promise<ExpansionData> {
  const expansion = await client(CsExpansion).fetchOne(expansionId);
  const snapshotId = expansion.currentSnapshotId;
  if (snapshotId === undefined) throw new Error(`${expansionId} has no cost snapshot yet. Import its evidence in the data studio or with npm run import.`);
  const [snapshots, allLines, commodities, orders, decisions, aiRuns, causeProposals, verifications, imports, profileMatches, outreach, priceHistory] = await Promise.all([
    all(client(CsCostSnapshot).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    all(client(CsCostLine).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    all(client(CsExpansionCommodity).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    all(client(CsPurchaseOrder).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    all(client(CsDecision).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    all(client(CsAiRun).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    all(client(CsCauseProposal).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    all(client(CsFieldVerification).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    all(client(CsImportBatch).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    all(client(CsSupplierProfileVersion).where({ importBatchId: { $startsWith: `${expansionId}:` } }).asyncIter()),
    all(client(CsOutreachMessage).where({ expansionId: { $eq: expansionId } }).asyncIter()),
    loadPriceHistory(expansionId).then(
      (value) => ({ value, error: null }),
      (error: unknown) => ({ value: null, error: describe(error) }),
    ),
  ]);
  const snapshot = snapshots.find((s) => s.snapshotId === snapshotId);
  if (snapshot === undefined) throw new Error(`Snapshot ${snapshotId} is not stored.`);
  const lines = allLines.filter((line) => line.snapshotId === snapshotId).sort((a, b) => (a.costLineId ?? "").localeCompare(b.costLineId ?? ""));
  const orderIds = orders.map((o) => o.logicalId ?? "").filter((id) => id !== "");
  const incidents = incidentViews(snapshot.incidentsJson);
  const versionIds = incidents.map((i) => i.versionId);
  const supplierIds = [...new Set([...lines.map((l) => l.supplierLogicalId ?? ""), ...orders.map((o) => o.supplierLogicalId ?? "")])].filter((id) => id !== "");
  const [deliveries, incidentObjects, suppliers] = await Promise.all([
    orderIds.length === 0 ? [] : all(client(CsDelivery).where({ orderLogicalId: { $in: orderIds } }).asyncIter()),
    versionIds.length === 0 ? [] : all(client(CsIncident).where({ versionId: { $in: versionIds } }).asyncIter()),
    supplierIds.length === 0 ? [] : all(client(CsSupplier).where({ logicalId: { $in: supplierIds } }).asyncIter()),
  ]);
  // `$startsWith` matches words, not characters ("EXP-ANDROY-2026:" also matches "EXP-ANDROY-2026-T1:…").
  const profiles = new Map<string, Osdk.Instance<CsSupplierProfileVersion>>();
  for (const profile of profileMatches.filter((p) => (p.importBatchId ?? "").startsWith(`${expansionId}:`)).sort(byTime((p) => p.importedAt))) {
    profiles.set(profile.supplierLogicalId ?? "", profile);
  }
  const rev = (s: Osdk.Instance<CsCostSnapshot>) => Number(s.evidenceRevision ?? 0);
  return {
    expansion,
    snapshot,
    lines,
    history: [...snapshots].sort((a, b) => rev(a) - rev(b)).map((s) => ({ snapshot: s, lines: allLines.filter((l) => l.snapshotId === s.snapshotId) })),
    commodities: new Map(commodities.map((c) => [c.commodity ?? "", c] as const)),
    suppliers: new Map(suppliers.map((s) => [s.logicalId ?? "", s] as const)),
    orders: new Map(orders.map((o) => [o.logicalId ?? "", o] as const)),
    deliveries,
    incidentObjects: new Map(incidentObjects.map((i) => [i.versionId ?? "", i] as const)),
    purchases: purchaseViews(snapshot.purchasesJson),
    incidents,
    decisions: [...decisions].sort(byTime((d) => d.createdAt)),
    aiRuns: [...aiRuns].sort(byTime((r) => r.startedAt)),
    causeProposals: [...causeProposals].sort(byTime((p) => p.createdAt)),
    verifications: [...verifications].sort(byTime((v) => v.createdAt)),
    imports: [...imports].sort(byTime((i) => i.importedAt)),
    outreach: [...outreach].sort(byTime((m) => m.createdAt)),
    profiles,
    priceHistory: priceHistory.value,
    priceHistoryError: priceHistory.error,
  };
}

type State = { readonly kind: "loading" } | { readonly kind: "error"; readonly message: string } | { readonly kind: "ready"; readonly data: ExpansionData };

const Context = createContext<{ readonly state: State; readonly reload: () => void; readonly expansionId: string } | null>(null);

export function ExpansionProvider({ expansionId, children }: { readonly expansionId: string; readonly children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let current = true;
    if (generation === 0) setState({ kind: "loading" });
    load(expansionId)
      .then((data) => current && setState({ kind: "ready", data }))
      .catch((error: unknown) => current && setState({ kind: "error", message: error instanceof Error ? error.message : String(error) }));
    return () => {
      current = false;
    };
  }, [expansionId, generation]);
  const reload = useCallback(() => setGeneration((value) => value + 1), []);
  return <Context.Provider value={{ state, reload, expansionId }}>{children}</Context.Provider>;
}

export function useExpansion() {
  const value = useContext(Context);
  if (value === null) throw new Error("useExpansion needs an ExpansionProvider.");
  return value;
}

/** The counters of the view the person sees, for the D6 guard. */
export function expectedOf(data: ExpansionData) {
  return {
    expansionId: data.expansion.expansionId ?? "",
    expectedEvidenceRevision: Number(data.expansion.evidenceRevision),
    expectedStateVersion: Number(data.expansion.stateVersion),
  };
}

export function latestDecision(data: ExpansionData, type: string, subjectId?: string) {
  return data.decisions.filter((d) => d.decisionType === type && (subjectId === undefined || d.subjectId === subjectId)).at(-1);
}

export function latestRun(data: ExpansionData, job: string, subjectId: string) {
  return data.aiRuns.filter((r) => r.job === job && r.subjectId === subjectId).at(-1);
}
