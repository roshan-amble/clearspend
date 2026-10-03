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
  planImport,
  versionIdOf,
  type Cause,
  type EvidenceKind,
  type EvidenceRow,
  type Json,
  type MarketPrice,
  type FieldVerificationRef,
  type Snapshot,
  type SnapshotInput,
  type StoredRecord,
} from "@clearspend/domain";
import { readCsv } from "./csv.js";
import { KIND_FILES, LATER_FILES } from "./kinds.js";
import { namespaceRow } from "./namespace.js";
import { FIXTURE_DIR, MARKET_PRICES_FILE } from "./paths.js";

export function fixtureRows<K extends EvidenceKind>(kind: K, namespace: string | null = null, file: string = KIND_FILES[kind].file): EvidenceRow<K>[] {
  const path = join(FIXTURE_DIR, file);
  const raw: Record<string, unknown>[] = file.endsWith(".json")
    ? (JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>[])
    : readCsv(path);
  return parseEvidenceRows(kind, raw.map((row) => namespaceRow(row, namespace))) as unknown as EvidenceRow<K>[];
}

const digestOf = (row: EvidenceRow): string => createHash("sha256").update(canonicalJson(row.props as unknown as Json)).digest("hex");

/**
 * The stored records of 1 kind after the main file, and after the later batches of scenario 5 when `later` is set.
 * The later rows go through planImport, the same D4 rules as the Action, so a replay adds nothing, a correction
 * supersedes, and a changed payment conflicts.
 */
function stored<K extends EvidenceKind>(kind: K, namespace: string | null, later = false): StoredRecord<EvidenceRow<K>["props"]>[] {
  const records: StoredRecord<EvidenceRow<K>["props"]>[] = fixtureRows(kind, namespace).map((row) => {
    const digest = digestOf(row);
    return {
      versionId: versionIdOf(row.logicalId, digest),
      contentDigest: digest,
      supersedesVersionId: null,
      logicalId: row.logicalId,
      importedAt: "2026-09-29T00:00:00Z",
      props: row.props,
    };
  });
  if (!later) return records;
  for (const batch of LATER_FILES.filter((entry) => entry.kind === kind)) {
    const rows = fixtureRows(kind, namespace, batch.file);
    const byLogicalId = new Map<string, StoredRecord<EvidenceRow<K>["props"]>[]>();
    for (const record of records) byLogicalId.set(record.logicalId, [...(byLogicalId.get(record.logicalId) ?? []), record]);
    const everything = new Set([...records.map((record) => record.logicalId)]);
    const plan = planImport({
      rows: rows as never,
      digests: rows.map(digestOf),
      stored: byLogicalId,
      // The later batches name only records that the main files stored.
      known: { expansion: new Set([namespace === null ? "EXP-ANDROY-2026" : `EXP-ANDROY-2026-${namespace.toUpperCase()}`]), suppliers: everything, orders: new Set(fixtureRows("orders", namespace).map((row) => row.logicalId)) },
    });
    for (const planned of plan.rows) {
      const { outcome } = planned;
      const storesRow = outcome.result === "ACCEPTED" || outcome.result === "VERSIONED" || (outcome.result === "CONFLICTING" && outcome.stored);
      if (!storesRow) continue;
      records.push({
        versionId: planned.versionId,
        contentDigest: planned.digest,
        supersedesVersionId: outcome.result === "VERSIONED" ? outcome.supersedesVersionId : null,
        logicalId: planned.row.logicalId,
        importedAt: "2026-09-30T00:00:00Z",
        props: planned.row.props as EvidenceRow<K>["props"],
      });
    }
  }
  return records;
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
export interface FixtureOptions {
  readonly reverse?: boolean;
  readonly later?: boolean;
  /** Phase 4: include the lead profiles, and these field verification files, for example "field-verifications-initial.csv". */
  readonly leads?: boolean;
  readonly verificationFiles?: readonly string[];
}

/** The snapshot input that the Action would load from Foundry after importing the fixtures. */
export function fixtureSnapshotInput(confirmed: Readonly<Record<string, Cause>>, namespace: string | null = null, options: FixtureOptions = {}): SnapshotInput {
  const prefix = namespace === null ? "harbor-erp" : `${namespace}/harbor-erp`;
  const order = <T>(items: T[]): T[] => (options.reverse === true ? [...items].reverse() : items);
  return {
    suppliers: order(fixtureRows("suppliers", namespace).map((row) => ({ logicalId: row.logicalId, route: row.props.route }))),
    commodities: order(fixtureRows("expansion-commodities", namespace).map((row) => row.props)),
    orders: order(stored("orders", namespace)),
    payments: order(stored("payments", namespace, options.later === true)),
    invoices: order(stored("invoices", namespace)),
    deliveries: order(stored("deliveries", namespace, options.later === true)),
    incidents: order(stored("incidents", namespace)),
    confirmations: new Map(
      Object.entries(confirmed).map(([incident, cause]) => [
        `${prefix}:${incident}`,
        [{ decisionId: `D-${incident}`, chosenCause: cause, createdAt: "2026-09-29T00:00:00Z" }],
      ]),
    ),
    marketPrices: order([...MARKET_PRICES]),
    ...(options.leads === true ? { profiles: order(stored("supplier-profiles", namespace)) } : {}),
    verifications: verificationsOf(options.verificationFiles ?? [], namespace),
    rationVersion: 1,
  };
}

export function expectedSnapshot(confirmed: Readonly<Record<string, Cause>>, namespace: string | null = null, options: FixtureOptions = {}): Snapshot {
  return buildSnapshot(fixtureSnapshotInput(confirmed, namespace, options));
}

/**
 * Field verification fixtures name a supplier by its bare ID. The import script resolves it by exact ID match
 * against suppliers.csv, never by fuzzy matching (brief section 7). This does the same.
 */
export function verificationsOf(files: readonly string[], namespace: string | null): Map<string, FieldVerificationRef[]> {
  const suppliers = fixtureRows("suppliers", namespace);
  const byExternalId = new Map(suppliers.map((row) => [row.externalId, row.logicalId] as const));
  const result = new Map<string, FieldVerificationRef[]>();
  for (const file of files) {
    for (const row of readCsv(join(FIXTURE_DIR, file))) {
      const logicalId = byExternalId.get(row.supplier_id ?? "");
      if (logicalId === undefined) throw new Error(`${file}: unknown supplier ${row.supplier_id}.`);
      const result_ = row.result === "PASS" ? "PASS" : "FAIL";
      result.set(logicalId, [...(result.get(logicalId) ?? []), { rationVersion: Number(row.ration_version), result: result_, visitedAt: row.visited_at ?? "" }]);
    }
  }
  return result;
}

