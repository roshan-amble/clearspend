/**
 * Imports each generated program (data/portfolio/<ISO3>/) through the same Actions as the demo: the 9 files through
 * cs-import-evidence-batch in the D4 order, then the field verifications through cs-record-field-verification. A run
 * again is a replay: the batch digest and the request IDs are stable, so nothing is written twice.
 *
 * Run: npm run portfolio:import [-- --country KEN]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseEvidenceRows, type EvidenceKind } from "@clearspend/domain";
import { readCsv } from "./lib/csv.js";
import { applyAction, currentUserId } from "./lib/foundry.js";
import { FIXTURE_DIR } from "./lib/paths.js";
import { stableRequestId } from "./lib/request-id.js";

const DIR = join(FIXTURE_DIR, "..", "portfolio");
const FILES: readonly { readonly kind: EvidenceKind; readonly file: string }[] = [
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

const { values } = parseArgs({ options: { country: { type: "string" } } });
const countries = readdirSync(DIR).filter((name) => /^[A-Z]{3}$/.test(name) && (values.country === undefined || values.country === name));
const actorUserId = currentUserId();
let failed = false;

for (const iso3 of countries) {
  const expansionId = (readCsv(join(DIR, iso3, "expansion.csv"))[0] as Record<string, string>).expansion_id as string;
  const results: string[] = [];
  for (const { kind, file } of FILES) {
    const path = join(DIR, iso3, file);
    const bytes = readFileSync(path);
    const raw = file.endsWith(".json") ? (JSON.parse(bytes.toString("utf-8")) as unknown[]) : readCsv(path);
    if (raw.length === 0) {
      results.push(`${kind} 0`);
      continue;
    }
    parseEvidenceRows(kind, raw);
    const result = await applyAction("cs-import-evidence-batch", {
      expansionId,
      fileKind: kind,
      fileName: `${iso3}/${file}`,
      fileDigest: createHash("sha256").update(bytes).digest("hex"),
      rowsJson: JSON.stringify(raw),
    });
    if (result.ok) results.push(`${kind} ${raw.length}`);
    else if (result.message.includes("REPLAYED")) results.push(`${kind} replayed`);
    else {
      console.error(`${iso3} ${file}: FAILED. ${result.message}`);
      failed = true;
      break;
    }
  }
  if (failed) break;

  const verificationsFile = join(DIR, iso3, "field-verifications.csv");
  const suppliers = new Map(readCsv(join(DIR, iso3, "suppliers.csv")).map((row) => [row.supplier_id ?? "", `${row.source_system}:${row.supplier_id}`] as const));
  let recorded = 0;
  for (const row of existsSync(verificationsFile) ? readCsv(verificationsFile) : []) {
    const result = await applyAction("cs-record-field-verification", {
      expansionId,
      supplierLogicalId: suppliers.get(row.supplier_id ?? "") ?? "",
      rationVersion: Number(row.ration_version),
      visitedAt: row.visited_at,
      result: row.result,
      sourceConfirmedCapacityPerMonth: Number(row.confirmed_capacity_kg_per_month),
      notes: row.notes,
      requestId: stableRequestId(`${expansionId}|${row.source_system}|${row.verification_id}`),
      actorUserId,
      ...(row.moisture_permille === "" || row.moisture_permille === undefined ? {} : { moisturePermille: Number(row.moisture_permille) }),
      sourceSystem: row.source_system,
      externalId: row.verification_id,
    });
    if (result.ok || result.message.includes("REPLAYED")) recorded += 1;
    else {
      console.error(`${iso3} ${row.verification_id}: FAILED. ${result.message}`);
      failed = true;
      break;
    }
  }
  console.log(`${iso3} ${expansionId}: ${results.join(", ")}, ${recorded} field verifications.`);
  if (failed) break;
}
if (failed) process.exitCode = 1;
