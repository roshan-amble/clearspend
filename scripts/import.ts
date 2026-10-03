/**
 * D2 decision 6 and D4: applies the fixture files to Foundry through the Action `cs-import-evidence-batch`, 1 file at
 * a time, in the D4 order. The script validates each file first, with the same rules as the Action.
 * The token comes from FOUNDRY_TOKEN and is only sent in the Authorization header.
 *
 * Run: npm run import -- [--namespace t1] [--kind orders]
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { EVIDENCE_KINDS, parseEvidenceRows, type EvidenceKind } from "@clearspend/domain";
import { readCsv } from "./lib/csv.js";
import { applyAction, fetchObject } from "./lib/foundry.js";
import { KIND_FILES, LATER_FILES } from "./lib/kinds.js";
import { namespaceExpansion, namespaceRow } from "./lib/namespace.js";
import { FIXTURE_DIR } from "./lib/paths.js";

const DEMO_EXPANSION = "EXP-ANDROY-2026";
export const IMPORT_ACTION = "cs-import-evidence-batch";

const { values } = parseArgs({ options: { namespace: { type: "string" }, kind: { type: "string" }, later: { type: "boolean" } } });
const namespace = values.namespace ?? null;
if (values.kind !== undefined && !(EVIDENCE_KINDS as readonly string[]).includes(values.kind)) {
  throw new Error(`--kind must be one of ${EVIDENCE_KINDS.join(", ")}.`);
}
const kinds: readonly EvidenceKind[] = values.kind === undefined ? EVIDENCE_KINDS : [values.kind as EvidenceKind];
const expansionId = namespaceExpansion(DEMO_EXPANSION, namespace);
// --later applies only the later batches of scenario 5. Without it, the main files in the D4 order.
const batches = values.later === true ? LATER_FILES : kinds.map((kind) => ({ kind, file: KIND_FILES[kind].file }));

for (const { kind, file } of batches) {
  const bytes = readFileSync(join(FIXTURE_DIR, file));
  const raw: unknown[] = file.endsWith(".json") ? (JSON.parse(bytes.toString("utf-8")) as unknown[]) : readCsv(join(FIXTURE_DIR, file));
  const rows = raw.map((row) => namespaceRow(row as Record<string, unknown>, namespace));
  // D4: stop before any upload when a row is invalid. The error names the row and the field.
  parseEvidenceRows(kind, rows);
  const fileDigest = createHash("sha256").update(bytes).digest("hex");

  const result = await applyAction(IMPORT_ACTION, {
    expansionId,
    fileKind: kind,
    fileName: file,
    fileDigest,
    rowsJson: JSON.stringify(rows),
  });
  if (result.ok) {
    const batch = await fetchObject("CsImportBatch", `${expansionId}:${fileDigest}`);
    const counts = ["inputRows", "accepted", "replayed", "versioned", "conflicting", "unmatched", "evidenceRevisionAfter"]
      .map((key) => `${key} ${String(batch?.[key] ?? "?")}`)
      .join(", ");
    console.log(`${file}: applied. ${counts}.`);
  } else if (result.message.includes("REPLAYED")) {
    console.log(`${file}: REPLAYED. It was already imported into ${expansionId}. Nothing changed.`);
  } else {
    console.error(`${file}: FAILED. ${result.message}`);
    process.exitCode = 1;
    break;
  }
}
