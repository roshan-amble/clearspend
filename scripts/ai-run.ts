/**
 * D7: starts 1 AI job through the Action `cs-start-ai-job` and prints the stored CsAiRun. For the D7.7 evaluation
 * cases and for checking the model call. The run changes no number, eligibility, or decision (I7, I10).
 *
 * Run: npm run ai -- --namespace t2 --job CAUSE --subject t2/harbor-erp:INC-A4
 *      npm run ai -- --namespace t2 --job EXPLANATION            (the subject is the expansion)
 */
import { parseArgs } from "node:util";
import { runAiJob } from "./lib/ai-job.js";
import { searchObjects } from "./lib/foundry.js";
import { namespaceExpansion } from "./lib/namespace.js";

const { values } = parseArgs({ options: { namespace: { type: "string" }, job: { type: "string" }, subject: { type: "string" } } });
const expansionId = namespaceExpansion("EXP-ANDROY-2026", values.namespace ?? null);
const job = values.job ?? "EXPLANATION";
const subjectId = values.subject ?? expansionId;
const { requestId, seconds, run } = await runAiJob(expansionId, job, subjectId);
console.log(`${job} ${subjectId}: run ${requestId}, ${String(run?.status)} after ${seconds} s, evidence revision ${String(run?.evidenceRevision)}.`);
console.log(`model ${String(run?.model)}; input truncated ${String(run?.inputTruncated)}; tokens ${String(run?.tokenUseJson ?? "not reported")}`);
console.log(`reasons ${String(run?.reasonsJson)}`);
if (typeof run?.outputJson === "string") console.log(JSON.stringify(JSON.parse(run.outputJson), null, 2));
if (job === "CAUSE") {
  const proposals = (await searchObjects("CsCauseProposal", "aiRunId", requestId)).map((p) => `${String(p.proposalId)} ${String(p.proposedCause)}`);
  console.log(`cause proposals: ${proposals.length === 0 ? "none" : proposals.join(", ")}`);
}
