/**
 * D4 "Field verifications": applies the field verification fixtures through the Action
 * `cs-record-field-verification`, 1 row at a time. A person's observation, so the actor is the token's user.
 * The fixture names a supplier by its bare ID. It is resolved by exact ID match against suppliers.csv, never fuzzy.
 *
 * Run: npm run record:verifications -- [--namespace t2] [--file field-verifications-later.csv]
 */
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readCsv } from "./lib/csv.js";
import { fixtureRows } from "./lib/expected-snapshot.js";
import { applyAction, currentUserId, fetchObject } from "./lib/foundry.js";
import { namespaceExpansion, namespaceRow } from "./lib/namespace.js";
import { FIXTURE_DIR } from "./lib/paths.js";
import { stableRequestId } from "./lib/request-id.js";

export const VERIFICATION_ACTION = "cs-record-field-verification";

const { values } = parseArgs({ options: { namespace: { type: "string" }, file: { type: "string" } } });
const namespace = values.namespace ?? null;
const file = values.file ?? "field-verifications-initial.csv";
const expansionId = namespaceExpansion("EXP-ANDROY-2026", namespace);
const suppliers = new Map(fixtureRows("suppliers", namespace).map((row) => [row.externalId, row.logicalId] as const));
const actorUserId = currentUserId();

for (const raw of readCsv(join(FIXTURE_DIR, file))) {
  const row = namespaceRow(raw, namespace) as Record<string, string>;
  const supplierLogicalId = suppliers.get(row.supplier_id ?? "");
  if (supplierLogicalId === undefined) throw new Error(`${file}: supplier ${row.supplier_id} is not in suppliers.csv.`);
  const requestId = stableRequestId(`${expansionId}|${row.source_system}|${row.verification_id}`);
  const result = await applyAction(VERIFICATION_ACTION, {
    expansionId,
    supplierLogicalId,
    rationVersion: Number(row.ration_version),
    visitedAt: row.visited_at,
    result: row.result,
    sourceConfirmedCapacityPerMonth: Number(row.confirmed_capacity_kg_per_month),
    notes: row.notes,
    requestId,
    actorUserId,
    ...(row.moisture_permille === "" || row.moisture_permille === undefined ? {} : { moisturePermille: Number(row.moisture_permille) }),
    sourceSystem: row.source_system,
    externalId: row.verification_id,
  });
  if (result.ok) {
    const stored = await fetchObject("CsFieldVerification", requestId);
    console.log(`${row.verification_id}: recorded ${row.result} for ${supplierLogicalId}. Evidence revision ${String(stored?.evidenceRevision ?? "?")}.`);
  } else if (result.message.includes("REPLAYED")) {
    console.log(`${row.verification_id}: REPLAYED. Already recorded. Nothing changed.`);
  } else {
    console.error(`${row.verification_id}: FAILED. ${result.message}`);
    process.exitCode = 1;
    break;
  }
}
