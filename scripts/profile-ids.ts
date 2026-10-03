/**
 * Lists the stored supplier profile versions of 1 expansion, for the AI extraction job's subject ID.
 * Run: npm run profile:ids -- --namespace t2
 */
import { parseArgs } from "node:util";
import { searchObjects } from "./lib/foundry.js";
import { namespaceExpansion } from "./lib/namespace.js";

const { values } = parseArgs({ options: { namespace: { type: "string" } } });
const expansionId = namespaceExpansion("EXP-ANDROY-2026", values.namespace ?? null);
const batches = await searchObjects("CsImportBatch", "expansionId", expansionId);
for (const batch of batches.filter((b) => b.fileKind === "supplier-profiles")) {
  for (const profile of await searchObjects("CsSupplierProfileVersion", "importBatchId", String(batch.importBatchId))) {
    console.log(`${String(profile.supplierLogicalId)}  ${String(profile.versionId)}  ${String(profile.language)}`);
  }
}
