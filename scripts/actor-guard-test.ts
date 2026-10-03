/**
 * D6 actor check: an API caller cannot act as someone else. The confirmation has a submission criterion (2026-09-29)
 * and, from function 0.2.2, every function also compares actorUserId with the signed-in user (Admin API). The field
 * visit and AI job Actions have no criterion, so they prove the function check alone. Test namespace only.
 * Run: npm run test:actor -- --namespace t1
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { applyAction, currentUserId, fetchObject } from "./lib/foundry.js";
import { namespaceExpansion } from "./lib/namespace.js";

const { values } = parseArgs({ options: { namespace: { type: "string" } } });
if (values.namespace === undefined) throw new Error("Run this only in a test namespace: --namespace t1.");
const expansionId = namespaceExpansion("EXP-ANDROY-2026", values.namespace);
const incidentLogicalId = `${values.namespace}/harbor-erp:INC-A4`;

async function counters() {
  const expansion = await fetchObject("CsExpansion", expansionId);
  if (expansion === null) throw new Error(`${expansionId} does not exist.`);
  return { evidenceRevision: Number(expansion.evidenceRevision), stateVersion: Number(expansion.stateVersion) };
}

const confirm = async (actorUserId: string, requestId: string) => {
  const expected = await counters();
  return applyAction("cs-confirm-incident-cause", {
    expansionId,
    incidentLogicalId,
    chosenCause: "TRANSPORT_AFTER_HANDOVER",
    rationale: "Actor check: the transporter's log shows 4 days of rain after handover.",
    expectedEvidenceRevision: expected.evidenceRevision,
    expectedStateVersion: expected.stateVersion,
    requestId,
    actorUserId,
  });
};

let failures = 0;
const check = (label: string, pass: boolean, detail: string): void => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${detail}`);
  if (!pass) failures += 1;
};

const me = currentUserId();
let someoneElse = randomUUID();
while (someoneElse === me) someoneElse = randomUUID();

const before = await counters();
const forged = await confirm(someoneElse, randomUUID());
const afterForged = await counters();
check(
  "another user's ID is refused, and nothing is written",
  !forged.ok && afterForged.stateVersion === before.stateVersion,
  forged.ok ? "APPLIED (the criterion did not stop it)" : `${forged.message.slice(0, 220)}; state version ${before.stateVersion} -> ${afterForged.stateVersion}`,
);

const requestId = randomUUID();
const own = await confirm(me, requestId);
const decision = await fetchObject("CsDecision", requestId);
check(
  "the caller's own ID is accepted and stored",
  own.ok && decision?.actorUserId === me,
  own.ok ? `decision ${requestId.slice(0, 8)}… stored with the caller as actor` : own.message.slice(0, 300),
);

// The AI job Action has no submission criterion, so only the function's Admin API check can refuse it.
const beforeOthers = await counters();
const visit = await applyAction("cs-select-field-visit", {
  expansionId,
  supplierLogicalId: `${values.namespace}/harbor-leads:SUP-L2`,
  rationale: "Actor check: this must be refused.",
  expectedEvidenceRevision: beforeOthers.evidenceRevision,
  expectedStateVersion: beforeOthers.stateVersion,
  requestId: randomUUID(),
  actorUserId: someoneElse,
});
const aiRequestId = randomUUID();
const ai = await applyAction("cs-start-ai-job", { expansionId, job: "EXPLANATION", subjectId: expansionId, requestId: aiRequestId, actorUserId: someoneElse });
const afterOthers = await counters();
check(
  "the field visit Action refuses another user's ID (its criterion or the function), and writes nothing",
  !visit.ok && (visit.message.includes("act as yourself") || visit.message.includes("criterion")) && afterOthers.stateVersion === beforeOthers.stateVersion,
  visit.ok ? "APPLIED" : visit.message.slice(0, 160),
);
check(
  "the AI job function refuses another user's ID, and stores no run",
  !ai.ok && ai.message.includes("act as yourself") && (await fetchObject("CsAiRun", aiRequestId)) === null,
  ai.ok ? "APPLIED" : ai.message.slice(0, 160),
);

console.log(failures === 0 ? "ACTOR CHECK PASSED" : `ACTOR CHECK FAILED: ${failures} check(s)`);
process.exitCode = failures === 0 ? 0 : 1;
