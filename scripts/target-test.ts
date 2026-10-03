/**
 * UI4 A check on real Foundry: `cs-set-commodity-target` stores a target under the D6 guard. It sets 1 target,
 * sends the same request again (REPLAYED), sends a stale view (STALE_COMMAND), and reads the target back through the
 * object and through `csPriceHistory`. The target is a planning value: the evidence revision must not change.
 *
 * Run: npm run test:target -- --namespace t2 [--commodity RICE] [--cents 50]
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { applyAction, currentUserId, FOUNDRY_URL, fetchObject, ONTOLOGY_RID } from "./lib/foundry.js";
import { namespaceExpansion } from "./lib/namespace.js";

const ACTION = "cs-set-commodity-target";
const { values } = parseArgs({ options: { namespace: { type: "string" }, commodity: { type: "string" }, cents: { type: "string" } } });
const expansionId = namespaceExpansion("EXP-ANDROY-2026", values.namespace ?? null);
const commodity = values.commodity ?? "RICE";
const cents = Number(values.cents ?? "50");
const actorUserId = currentUserId();

const counters = async () => {
  const e = await fetchObject("CsExpansion", expansionId);
  if (e === null) throw new Error(`${expansionId} does not exist.`);
  return { expectedEvidenceRevision: Number(e.evidenceRevision), expectedStateVersion: Number(e.stateVersion) };
};
let failures = 0;
const check = (ok: boolean, text: string) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${text}`);
  if (!ok) failures += 1;
};

const before = await counters();
const requestId = randomUUID();
const params = { expansionId, commodity, targetCentsPer1000: cents, rationale: "test:target, a planning value", requestId, actorUserId };
const first = await applyAction(ACTION, { ...params, ...before });
check(first.ok, `set ${commodity} target to ${cents} cents for 1,000 base units${first.ok ? "" : `: ${first.message}`}`);

const after = await counters();
check(after.expectedEvidenceRevision === before.expectedEvidenceRevision, `evidence revision unchanged (${after.expectedEvidenceRevision})`);
check(after.expectedStateVersion === before.expectedStateVersion + 1, `state version rose by 1 (${before.expectedStateVersion} → ${after.expectedStateVersion})`);

const replay = await applyAction(ACTION, { ...params, ...before });
check(!replay.ok && replay.message.includes("REPLAYED"), "the same request again is REPLAYED");

const stale = await applyAction(ACTION, { ...params, requestId: randomUUID(), ...before });
check(!stale.ok && stale.message.includes("STALE_COMMAND"), "an older view is refused with STALE_COMMAND");

const row = await fetchObject("CsExpansionCommodity", `${expansionId}:${commodity}`);
check(Number(row?.targetCentsPer1000) === cents && row?.targetSetBy === actorUserId, "the ration spec holds the target and who set it");

const decision = await fetchObject("CsDecision", requestId);
check(decision?.decisionType === "SET_TARGET" && decision?.subjectId === commodity, "1 SET_TARGET decision is stored");

const response = await fetch(`${FOUNDRY_URL}/api/v2/ontologies/${ONTOLOGY_RID}/queries/csPriceHistory/execute`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.FOUNDRY_TOKEN ?? ""}`, "Content-Type": "application/json" },
  body: JSON.stringify({ parameters: { expansionId } }),
});
const history = response.ok ? (JSON.parse(((await response.json()) as { value: string }).value) as { commodities: { commodity: string; targetCentsPer1000: number | null }[] }) : null;
check(history?.commodities.find((c) => c.commodity === commodity)?.targetCentsPer1000 === cents, `csPriceHistory returns the target (HTTP ${response.status})`);

if (failures > 0) process.exitCode = 1;
