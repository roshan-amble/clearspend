/**
 * UI3 A: the data studio's plumbing. Development only. It writes nothing itself: every write is the import Action
 * or the field verification Action, as the signed-in user. Before a write it plans the batch in the browser with
 * the same D4 rules the Action runs (parseEvidenceRows, planImport), so the person sees each row's outcome first.
 */
import {
  canonicalJson,
  heads,
  parseEvidenceRows,
  planImport,
  type AnyEvidenceRow,
  type EditableKind,
  type EvidenceKind,
  type ImportPlan,
  type Json,
  type StoredVersion,
} from "@clearspend/domain";
import type { Osdk } from "@osdk/client";
import { client } from "./client";
import { describe } from "./command";
import { csImportEvidenceBatch, CsDelivery, CsExpansion, CsImportBatch, CsIncident, CsInvoice, CsPayment, CsPurchaseOrder, CsSupplier, CsSupplierProfileVersion } from "./sdk";

type Versioned = Osdk.Instance<CsPurchaseOrder> | Osdk.Instance<CsPayment> | Osdk.Instance<CsInvoice> | Osdk.Instance<CsDelivery> | Osdk.Instance<CsIncident> | Osdk.Instance<CsSupplierProfileVersion>;

export { inNamespace, kindOfColumns, namespaceOf, parseCsv, propsOf, readRows } from "./studio-rows";

// ---------------------------------------------------------------------------------------------------------------
// Digests and request IDs, the same as the scripts (scripts/import.ts, scripts/lib/request-id.ts).

export async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The script's stable request ID, so the studio and `npm run record:verifications` replay each other. */
export async function stableRequestId(key: string): Promise<string> {
  const hex = await sha256Hex(key);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** The repository's fixture files, bundled only into the development build (the studio route is DEV only). */
const FIXTURES = import.meta.glob("../../../data/fixtures/**/*.{csv,json}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export function fixture(file: string): string {
  const text = FIXTURES[`../../../data/fixtures/${file}`];
  if (text === undefined) throw new Error(`data/fixtures/${file} is not in this build.`);
  return text;
}

/** D4 order of a full import (scripts/lib/kinds.ts), then the later batches of scenario 5. */
export const MAIN_FILES: readonly { readonly kind: EvidenceKind; readonly file: string }[] = [
  { kind: "expansion", file: "expansion.csv" },
  { kind: "expansion-commodities", file: "expansion-commodities.csv" },
  { kind: "suppliers", file: "suppliers.csv" },
  { kind: "supplier-profiles", file: "supplier-profiles.json" },
  { kind: "orders", file: "orders.csv" },
  { kind: "payments", file: "payments.csv" },
  { kind: "invoices", file: "invoices.csv" },
  { kind: "deliveries", file: "deliveries.csv" },
  { kind: "incidents", file: "incidents.json" },
];
export const LATER_FILES: readonly { readonly kind: EvidenceKind; readonly file: string }[] = [
  { kind: "payments", file: "later/payments-replay.csv" },
  { kind: "deliveries", file: "later/deliveries-correction.csv" },
];

async function all<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

export interface StoredRecord {
  readonly kind: EditableKind;
  readonly logicalId: string;
  /** Every stored version, oldest first. */
  readonly versions: readonly Versioned[];
  /** The newest version that no other version supersedes. */
  readonly head: Versioned;
  /** More than 1 head: a conflict that a person resolves at the source (D4). */
  readonly conflict: boolean;
}

/** Every record of 1 kind in this expansion, grouped by logical ID. */
export async function loadRecords(kind: EditableKind, expansionId: string, orderIds: readonly string[]): Promise<StoredRecord[]> {
  const byOrder = <T extends Versioned>(objects: Promise<T[]>) => (orderIds.length === 0 ? Promise.resolve([] as T[]) : objects);
  const ids = [...orderIds];
  const objects: Versioned[] =
    kind === "orders"
      ? await all(client(CsPurchaseOrder).where({ expansionId: { $eq: expansionId } }).asyncIter())
      : kind === "payments"
        ? await byOrder(all(client(CsPayment).where({ orderLogicalId: { $in: ids } }).asyncIter()))
        : kind === "invoices"
          ? await byOrder(all(client(CsInvoice).where({ orderLogicalId: { $in: ids } }).asyncIter()))
          : kind === "deliveries"
            ? await byOrder(all(client(CsDelivery).where({ orderLogicalId: { $in: ids } }).asyncIter()))
            : kind === "incidents"
              ? await byOrder(all(client(CsIncident).where({ orderLogicalId: { $in: ids } }).asyncIter()))
              : // `$startsWith` matches words, so the exact prefix is checked here (platform facts).
                (await all(client(CsSupplierProfileVersion).where({ importBatchId: { $startsWith: `${expansionId}:` } }).asyncIter())).filter((p) =>
                  (p.importBatchId ?? "").startsWith(`${expansionId}:`),
                );
  const groups = new Map<string, Versioned[]>();
  for (const object of [...objects].sort((a, b) => (a.importedAt ?? "").localeCompare(b.importedAt ?? ""))) {
    const id = object.logicalId ?? "";
    groups.set(id, [...(groups.get(id) ?? []), object]);
  }
  return [...groups.entries()]
    .map(([logicalId, versions]) => {
      const current = heads(versions.map(storedOf));
      const head = versions.filter((v) => current.some((c) => c.versionId === v.versionId)).at(-1) ?? (versions.at(-1) as Versioned);
      return { kind, logicalId, versions, head, conflict: current.length > 1 };
    })
    .sort((a, b) => a.logicalId.localeCompare(b.logicalId));
}

const storedOf = (object: Versioned): StoredVersion => ({ versionId: object.versionId ?? "", contentDigest: object.contentDigest ?? "", supersedesVersionId: object.supersedesVersionId ?? null });

// ---------------------------------------------------------------------------------------------------------------
// The dry run: the Action's own plan, computed in the browser from stored state. It writes nothing.

export interface DryRun {
  readonly rows: readonly AnyEvidenceRow[];
  readonly plan: ImportPlan;
}

async function storedFor(kind: EvidenceKind, logicalIds: readonly string[]): Promise<Map<string, StoredVersion[]>> {
  const byId = new Map<string, StoredVersion[]>();
  if (logicalIds.length === 0) return byId;
  const ids = [...new Set(logicalIds)];
  const add = (objects: readonly Versioned[]) => {
    for (const object of objects) byId.set(object.logicalId ?? "", [...(byId.get(object.logicalId ?? "") ?? []), storedOf(object)]);
  };
  switch (kind) {
    case "orders":
      add(await all(client(CsPurchaseOrder).where({ logicalId: { $in: ids } }).asyncIter()));
      break;
    case "payments":
      add(await all(client(CsPayment).where({ logicalId: { $in: ids } }).asyncIter()));
      break;
    case "invoices":
      add(await all(client(CsInvoice).where({ logicalId: { $in: ids } }).asyncIter()));
      break;
    case "deliveries":
      add(await all(client(CsDelivery).where({ logicalId: { $in: ids } }).asyncIter()));
      break;
    case "incidents":
      add(await all(client(CsIncident).where({ logicalId: { $in: ids } }).asyncIter()));
      break;
    case "supplier-profiles":
      add(await all(client(CsSupplierProfileVersion).where({ logicalId: { $in: ids } }).asyncIter()));
      break;
    case "suppliers":
      for (const s of await all(client(CsSupplier).where({ logicalId: { $in: ids } }).asyncIter())) {
        byId.set(s.logicalId ?? "", [{ versionId: s.logicalId ?? "", contentDigest: s.contentDigest ?? "", supersedesVersionId: null }]);
      }
      break;
    default:
      throw new Error(`The studio does not plan ${kind} files. Use npm run import for setup files.`);
  }
  return byId;
}

export async function dryRun(kind: EvidenceKind, rawRows: readonly Record<string, unknown>[]): Promise<DryRun> {
  const rows = parseEvidenceRows(kind, rawRows);
  const named = (k: "expansion" | "suppliers" | "orders") => [...new Set(rows.flatMap((r) => r.references.filter((x) => x.kind === k).map((x) => x.logicalId)))];
  const [digests, stored, expansions, suppliers, orders] = await Promise.all([
    Promise.all(rows.map((row) => sha256Hex(canonicalJson(row.props as unknown as Json)))),
    storedFor(
      kind,
      rows.map((row) => row.logicalId),
    ),
    named("expansion").length === 0 ? [] : all(client(CsExpansion).where({ expansionId: { $in: named("expansion") } }).asyncIter()),
    named("suppliers").length === 0 ? [] : all(client(CsSupplier).where({ logicalId: { $in: named("suppliers") } }).asyncIter()),
    named("orders").length === 0 ? [] : all(client(CsPurchaseOrder).where({ logicalId: { $in: named("orders") } }).asyncIter()),
  ]);
  const known = {
    expansion: new Set(expansions.map((e) => e.expansionId ?? "")),
    suppliers: new Set(suppliers.map((s) => s.logicalId ?? "")),
    orders: new Set(orders.map((o) => o.logicalId ?? "")),
  };
  return { rows, plan: planImport({ rows, digests, stored, known }) };
}

/** The digest the Action would compute for 1 row, to prove that an unchanged record round-trips (REPLAYED). */
export async function rowDigest(kind: EvidenceKind, raw: Record<string, unknown>): Promise<string> {
  const [row] = parseEvidenceRows(kind, [raw]);
  if (row === undefined) throw new Error("No row.");
  return sha256Hex(canonicalJson(row.props as unknown as Json));
}

// ---------------------------------------------------------------------------------------------------------------
// Writes, through the Actions only.

export type ImportResult = { readonly kind: "applied"; readonly batch: Osdk.Instance<CsImportBatch> | undefined } | { readonly kind: "replayed" };

export async function applyImport(expansionId: string, kind: EvidenceKind, fileName: string, fileDigest: string, rows: readonly Record<string, unknown>[]): Promise<ImportResult> {
  try {
    // UI3 A: the import Action is in the app's scope (D9 amendment), so the browser applies it as the signed-in user.
    await client(csImportEvidenceBatch).applyAction({
      expansionId,
      fileKind: kind,
      fileName,
      fileDigest,
      rowsJson: JSON.stringify(rows),
    });
  } catch (error) {
    if (describe(error).includes("REPLAYED")) return { kind: "replayed" };
    throw error;
  }
  const page = await client(CsImportBatch).where({ importBatchId: { $eq: `${expansionId}:${fileDigest}` } }).fetchPage({ $pageSize: 1 });
  return { kind: "applied", batch: page.data[0] };
}

export const batchText = (result: ImportResult): string =>
  result.kind === "replayed"
    ? "REPLAYED: this file was already imported. Nothing changed."
    : `applied · ${["accepted", "replayed", "versioned", "conflicting", "unmatched"].map((k) => `${String((result.batch as Record<string, unknown> | undefined)?.[k] ?? "?")} ${k}`).join(", ")} · revision ${String(result.batch?.evidenceRevisionAfter ?? "?")}`;
