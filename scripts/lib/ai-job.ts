import { randomUUID } from "node:crypto";
import { applyAction, currentUserId, fetchObject } from "./foundry.js";

export const AI_ACTION = "cs-start-ai-job";

export interface StoredRun {
  readonly requestId: string;
  readonly seconds: string;
  readonly run: Record<string, unknown> | null;
}

/** D7: starts 1 AI job through the real Action and reads back the stored CsAiRun. Throws when the Action fails. */
export async function runAiJob(expansionId: string, job: string, subjectId: string): Promise<StoredRun> {
  const requestId = randomUUID();
  const started = Date.now();
  const result = await applyAction(AI_ACTION, { expansionId, job, subjectId, requestId, actorUserId: currentUserId() });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (!result.ok) throw new Error(`${job} ${subjectId}: the Action failed after ${seconds} s. ${result.message}`);
  return { requestId, seconds, run: await fetchObject("CsAiRun", requestId) };
}
