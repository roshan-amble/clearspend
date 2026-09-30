/**
 * Phase 2 exit check: reload what the Actions stored in Foundry, and compare the current CsCostSnapshot and its
 * CsCostLine objects field by field with the same domain code run locally on the fixtures.
 * Run: npm run verify:snapshot -- --namespace t1 [--confirmed INC-A4=TRANSPORT_AFTER_HANDOVER]
 */
import { parseArgs } from "node:util";
import { snapshotRecords, type Cause } from "@clearspend/domain";
import { expectedSnapshot } from "./lib/expected-snapshot.js";
import { fetchObject, searchObjects } from "./lib/foundry.js";
import { namespaceExpansion } from "./lib/namespace.js";

const { values } = parseArgs({ options: { namespace: { type: "string" }, confirmed: { type: "string", multiple: true } } });
const namespace = values.namespace ?? null;
const confirmed: Record<string, Cause> = Object.fromEntries(
  (values.confirmed ?? []).map((entry) => entry.split("=") as [string, Cause]),
);
const expansionId = namespaceExpansion("EXP-ANDROY-2026", namespace);

const expansion = await fetchObject("CsExpansion", expansionId);
if (expansion === null) throw new Error(`${expansionId} does not exist in Foundry.`);
const snapshotId = String(expansion.currentSnapshotId);
const stored = await fetchObject("CsCostSnapshot", snapshotId);
if (stored === null) throw new Error(`Snapshot ${snapshotId} does not exist.`);
const storedLines = await searchObjects("CsCostLine", "snapshotId", snapshotId);

const expected = snapshotRecords(expectedSnapshot(confirmed, namespace), {
  expansionId,
  evidenceRevision: Number(expansion.evidenceRevision),
  rulesVersion: String(stored.rulesVersion),
  createdAt: String(stored.createdAt),
});

const text = (value: unknown): string =>
  value === undefined || value === null || (Array.isArray(value) && value.length === 0)
    ? "(none)"
    : Array.isArray(value)
      ? JSON.stringify(value)
      : String(value);
/** Market data by meaning: snapshots written before 0.1.1 list the commodities in the Ontology's order. */
const market = (json: unknown): string =>
  JSON.stringify((JSON.parse(String(json)) as { commodity: string }[]).sort((a, b) => a.commodity.localeCompare(b.commodity)));
const differences: string[] = [];
if (market(stored.marketIndicatorsJson) !== market(expected.snapshot.marketIndicatorsJson)) {
  differences.push(`snapshot.marketIndicatorsJson differs:\n    Foundry  ${text(stored.marketIndicatorsJson)}\n    expected ${expected.snapshot.marketIndicatorsJson}`);
}
for (const key of ["snapshotId", "evidenceRevision", "marketDataAsOf"] as const) {
  if (text(stored[key]) !== text(expected.snapshot[key])) differences.push(`snapshot.${key}: Foundry ${text(stored[key])}, expected ${text(expected.snapshot[key])}`);
}
if (storedLines.length !== expected.lines.length) differences.push(`lines: Foundry ${storedLines.length}, expected ${expected.lines.length}`);
for (const line of expected.lines) {
  const actual = storedLines.find((candidate) => candidate.costLineId === line.costLineId);
  if (actual === undefined) {
    differences.push(`missing line ${line.costLineId}`);
    continue;
  }
  for (const [key, value] of Object.entries(line)) {
    if (text(actual[key]) !== text(value)) differences.push(`${line.commodity}.${key}: Foundry ${text(actual[key])}, expected ${text(value)}`);
  }
}

console.log(`${expansionId}: evidence revision ${text(expansion.evidenceRevision)}, state version ${text(expansion.stateVersion)}, snapshot ${snapshotId}, rules ${text(stored.rulesVersion)}.`);
for (const line of storedLines) {
  console.log(`  ${text(line.commodity)} ${text(line.supplierLogicalId)}: nominal ${text(line.nominalExact)}, supplier ${text(line.supplierLowExact)} to ${text(line.supplierHighExact)}, route ${text(line.routeLowExact)} to ${text(line.routeHighExact)}, batches ${text(line.batchCount)}, unconfirmed ${text(line.unconfirmedFailures)}`);
}
if (differences.length > 0) {
  console.error(`MISMATCH (${differences.length}):\n  ${differences.join("\n  ")}`);
  process.exitCode = 1;
} else {
  console.log(`MATCH: the snapshot and all ${storedLines.length} cost lines equal the local domain result.`);
}
