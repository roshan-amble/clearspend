/**
 * D6 test on the real Action (Roshan, 2026-09-29), in a test namespace only.
 * Each round sends 2 cause confirmations for the same incident, in parallel, with the same expected counters.
 * Pass: exactly 1 succeeds, the other is refused (STALE_COMMAND after the platform re-runs it, or a conflict),
 * and the counters move by exactly 1. Then a retry of the winner must be REPLAYED, and the same request ID with
 * other content must be REQUEST_ID_REUSED, and a new request from an older view must be STALE_COMMAND.
 *
 * Run: npm run test:d6 -- --namespace t1 [--rounds 5]
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { applyAction, fetchObject, searchObjects, type ApplyResult } from "./lib/foundry.js";
import { namespaceExpansion } from "./lib/namespace.js";

const ACTION = "cs-confirm-incident-cause";
const { values } = parseArgs({ options: { namespace: { type: "string" }, rounds: { type: "string" } } });
if (values.namespace === undefined) throw new Error("Run this only in a test namespace: --namespace t1.");
const namespace = values.namespace;
const rounds = Number(values.rounds ?? "5");
const expansionId = namespaceExpansion("EXP-ANDROY-2026", namespace);
const incident = `${namespace}/harbor-erp:INC-A4`;

async function counters(): Promise<{ evidenceRevision: number; stateVersion: number }> {
  const expansion = await fetchObject("CsExpansion", expansionId);
  if (expansion === null) throw new Error(`${expansionId} does not exist.`);
  return { evidenceRevision: Number(expansion.evidenceRevision), stateVersion: Number(expansion.stateVersion) };
}

const confirm = (requestId: string, expected: { evidenceRevision: number; stateVersion: number }, rationale: string): Promise<ApplyResult> =>
  applyAction(ACTION, {
    expansionId,
    incidentLogicalId: incident,
    chosenCause: "TRANSPORT_AFTER_HANDOVER",
    rationale,
    expectedEvidenceRevision: expected.evidenceRevision,
    expectedStateVersion: expected.stateVersion,
    requestId,
  });

const kind = (result: ApplyResult): string => {
  if (result.ok) return "SUCCESS";
  for (const code of ["STALE_COMMAND", "REPLAYED", "REQUEST_ID_REUSED"]) if (result.message.includes(code)) return code;
  return `OTHER ${result.message.slice(0, 300)}`;
};

let failures = 0;
const check = (label: string, pass: boolean, detail: string): void => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${detail}`);
  if (!pass) failures += 1;
};

const decisionsBefore = (await searchObjects("CsDecision", "subjectId", incident)).length;
const start = await counters();
let lastWinner: { requestId: string; expected: { evidenceRevision: number; stateVersion: number }; rationale: string } | null = null;

for (let round = 1; round <= rounds; round += 1) {
  const expected = await counters();
  const requests = [randomUUID(), randomUUID()].map((requestId, index) => ({
    requestId,
    rationale: `D6 test round ${round}, request ${index + 1}: the transporter's log shows 4 days of rain after handover.`,
  }));
  const results = await Promise.all(requests.map((request) => confirm(request.requestId, expected, request.rationale)));
  const kinds = results.map(kind);
  const after = await counters();
  const winners = kinds.filter((k) => k === "SUCCESS").length;
  check(
    `round ${round}`,
    winners === 1 && kinds.some((k) => k === "STALE_COMMAND" || k.startsWith("OTHER")) &&
      after.evidenceRevision === expected.evidenceRevision + 1 && after.stateVersion === expected.stateVersion + 1,
    `results ${kinds.join(" + ")}; counters ${expected.evidenceRevision}/${expected.stateVersion} -> ${after.evidenceRevision}/${after.stateVersion}`,
  );
  const winnerIndex = kinds.indexOf("SUCCESS");
  if (winnerIndex >= 0) lastWinner = { ...(requests[winnerIndex] as { requestId: string; rationale: string }), expected };
}

if (lastWinner !== null) {
  const before = await counters();
  const retry = kind(await confirm(lastWinner.requestId, lastWinner.expected, lastWinner.rationale));
  const afterRetry = await counters();
  check("retry of a committed request", retry === "REPLAYED" && afterRetry.stateVersion === before.stateVersion, `${retry}; state version ${before.stateVersion} -> ${afterRetry.stateVersion}`);
  const reused = kind(await confirm(lastWinner.requestId, lastWinner.expected, `${lastWinner.rationale} (changed)`));
  check("same request ID, other content", reused === "REQUEST_ID_REUSED", reused);
  // A new decision from a form that was opened before the last commit: the guard itself must refuse it.
  const stale = kind(await confirm(randomUUID(), lastWinner.expected, "D6 test: a decision made on an older view."));
  const afterStale = await counters();
  check("new request from an older view", stale === "STALE_COMMAND" && afterStale.stateVersion === afterRetry.stateVersion, `${stale}; state version ${afterRetry.stateVersion} -> ${afterStale.stateVersion}`);
}

const end = await counters();
const decisionsAfter = (await searchObjects("CsDecision", "subjectId", incident)).length;
check(
  "totals",
  decisionsAfter - decisionsBefore === rounds && end.evidenceRevision - start.evidenceRevision === rounds,
  `${decisionsAfter - decisionsBefore} new decisions for ${rounds} rounds; evidence revision ${start.evidenceRevision} -> ${end.evidenceRevision}`,
);
console.log(failures === 0 ? "D6 GUARD TEST PASSED" : `D6 GUARD TEST FAILED: ${failures} check(s)`);
process.exitCode = failures === 0 ? 0 : 1;
