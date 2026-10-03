/**
 * D5 outreach, end to end in a test namespace: an AI draft for SUP-L1, then an approval through
 * `cs-decide-outreach`. Checks the stored message and that a second decision on the same draft is refused.
 * The Action's notification goes only to Roshan's own Foundry user (CLAUDE.md). No supplier is contacted.
 * Run: npm run test:outreach -- --namespace t2
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { runAiJob } from "./lib/ai-job.js";
import { applyAction, currentUserId, fetchObject, searchObjects } from "./lib/foundry.js";
import { namespaceExpansion } from "./lib/namespace.js";

const { values } = parseArgs({ options: { namespace: { type: "string" } } });
if (values.namespace === undefined) throw new Error("Run this only in a test namespace: --namespace t2.");
const expansionId = namespaceExpansion("EXP-ANDROY-2026", values.namespace);
const supplier = `${values.namespace}/harbor-leads:SUP-L1`;

const batches = (await searchObjects("CsImportBatch", "expansionId", expansionId)).filter((b) => b.fileKind === "supplier-profiles");
let versionId = "";
for (const batch of batches) {
  const found = (await searchObjects("CsSupplierProfileVersion", "importBatchId", String(batch.importBatchId))).find((p) => p.supplierLogicalId === supplier);
  if (found !== undefined) versionId = String(found.versionId);
}
if (versionId === "") throw new Error(`No profile for ${supplier}.`);

const { requestId: aiRunId, seconds, run } = await runAiJob(expansionId, "OUTREACH_DRAFT", versionId);
console.log(`Draft ${aiRunId}: ${String(run?.status)} in ${seconds} s. Reasons ${String(run?.reasonsJson)}`);
if (run?.status !== "SUCCEEDED") process.exit(1);
const draft = JSON.parse(String(run.outputJson)) as { subject: string; body: string; language: string; requestedEvidence: string[] };
console.log(`Language ${draft.language}. Subject: ${draft.subject}\n${draft.body}\nRequested: ${draft.requestedEvidence.join("; ")}`);

const decide = async (requestId: string) => {
  const expansion = await fetchObject("CsExpansion", expansionId);
  return applyAction("cs-decide-outreach", {
    expansionId,
    aiRunId,
    decision: "APPROVE",
    approvedText: `${draft.subject}\n\n${draft.body}`,
    rationale: "Outreach test: ask SUP-L1 for its lab certificate and a visit date.",
    expectedEvidenceRevision: Number(expansion?.evidenceRevision),
    expectedStateVersion: Number(expansion?.stateVersion),
    requestId,
    actorUserId: currentUserId(),
  });
};
const requestId = randomUUID();
const approved = await decide(requestId);
const message = await fetchObject("CsOutreachMessage", requestId);
console.log(approved.ok ? `Approved: message status ${String(message?.status)}, supplier ${String(message?.supplierLogicalId)}.` : `FAILED: ${approved.message}`);
const again = await decide(randomUUID());
console.log(again.ok ? "FAIL: a second decision on the same draft was accepted." : `Second decision refused: ${again.message.slice(0, 160)}`);
process.exitCode = approved.ok && message?.status === "NOTIFICATION_REQUESTED" && !again.ok ? 0 : 1;
console.log(process.exitCode === 0 ? "OUTREACH CHECK PASSED" : "OUTREACH CHECK FAILED");
