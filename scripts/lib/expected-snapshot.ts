/**
 * The snapshot that Foundry must hold after a full fixture import, computed locally with the same domain code.
 * Used by scripts/snapshot.test.ts (parity with the fixture pipeline) and scripts/verify-snapshot.ts (parity
 * with the objects that the Action wrote).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildSnapshot,
  canonicalJson,
  parseEvidenceRows,
  versionIdOf,
  type Cause,
  type EvidenceKind,
  type EvidenceRow,
  type Json,
  type MarketPrice,
  type Snapshot,
  type StoredRecord,
} from "@clearspend/domain";
import { readCsv } from "./csv.js";
import { KIND_FILES } from "./kinds.js";
import { namespaceRow } from "./namespace.js";
import { FIXTURE_DIR, MARKET_PRICES_FILE } from "./paths.js";

export function fixtureRows<K extends EvidenceKind>(kind: K, namespace: string | null = null): EvidenceRow<K>[] {
  const { file } = KIND_FILES[kind];
  const path = join(FIXTURE_DIR, file);
  const raw: Record<string, unknown>[] = file.endsWith(".json")
    ? (JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>[])
    : readCsv(path);
  return parseEvidenceRows(kind, raw.map((row) => namespaceRow(row, namespace))) as unknown as EvidenceRow<K>[];
}

function stored<K extends EvidenceKind>(kind: K, namespace: string | null): StoredRecord<EvidenceRow<K>["props"]>[] {
  return fixtureRows(kind, namespace).map((row) => {
    const digest = createHash("sha256").update(canonicalJson(row.props as unknown as Json)).digest("hex");
    return {
      versionId: versionIdOf(row.logicalId, digest),
      contentDigest: digest,
      supersedesVersionId: null,
      logicalId: row.logicalId,
      importedAt: "2026-09-29T00:00:00Z",
      props: row.props,
    };
  });
}

export const MARKET_PRICES: readonly MarketPrice[] = readCsv(MARKET_PRICES_FILE).map((row) => ({
  market: row.market_id ?? "",
  series: row.commodity ?? "",
  month: (row.date ?? "").slice(0, 7),
  usdMicros: BigInt(row.usd_price_micros ?? "0"),
}));

/**
 * `confirmed` maps an incident's external ID, for example INC-A4, to the cause a person confirmed.
 * `reverse` feeds every list backwards, as a stand-in for the Ontology returning objects in another order.
 */
export function expectedSnapshot(
  confirmed: Readonly<Record<string, Cause>>,
  namespace: string | null = null,
  options: { readonly reverse?: boolean } = {},
): Snapshot {
  const prefix = namespace === null ? "harbor-erp" : `${namespace}/harbor-erp`;
  const order = <T>(items: T[]): T[] => (options.reverse === true ? [...items].reverse() : items);
  return buildSnapshot({
    suppliers: order(fixtureRows("suppliers", namespace).map((row) => ({ logicalId: row.logicalId, route: row.props.route }))),
    commodities: order(fixtureRows("expansion-commodities", namespace).map((row) => row.props)),
    orders: order(stored("orders", namespace)),
    payments: order(stored("payments", namespace)),
    invoices: order(stored("invoices", namespace)),
    deliveries: order(stored("deliveries", namespace)),
    incidents: order(stored("incidents", namespace)),
    confirmations: new Map(
      Object.entries(confirmed).map(([incident, cause]) => [
        `${prefix}:${incident}`,
        [{ decisionId: `D-${incident}`, chosenCause: cause, createdAt: "2026-09-29T00:00:00Z" }],
      ]),
    ),
    marketPrices: order([...MARKET_PRICES]),
  });
}
