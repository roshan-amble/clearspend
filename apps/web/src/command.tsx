import { useState } from "react";
import { currentUserId } from "./client";

export type Outcome = { readonly kind: "idle" | "sending" | "done" | "error"; readonly message?: string };

/** Foundry's error name, status, and parameters. A token is never part of an error, so the whole text can be shown. */
export function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const api = error as Error & { errorName?: string; errorCode?: string; statusCode?: number; errorInstanceId?: string; parameters?: unknown };
  const parts = [api.errorName ?? error.name, api.statusCode === undefined ? "" : `HTTP ${api.statusCode}`, error.message];
  if (api.parameters !== undefined) parts.push(`parameters ${JSON.stringify(api.parameters).slice(0, 1500)}`);
  if (api.errorInstanceId !== undefined) parts.push(`error ID ${api.errorInstanceId}`);
  return parts.filter((part) => part !== "").join(" · ");
}

/**
 * D6 client behavior for every command. The request ID is made when the form opens, so a retry of the same submit
 * is REPLAYED on the server, never a second write. After a success the next submit gets a new request ID.
 */
export function useCommand(onChanged: () => void) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  async function run(apply: (ids: { readonly requestId: string; readonly actorUserId: string }) => Promise<unknown>, doneMessage: string): Promise<void> {
    setOutcome({ kind: "sending" });
    try {
      await apply({ requestId, actorUserId: await currentUserId() });
      setRequestId(crypto.randomUUID());
      setOutcome({ kind: "done", message: doneMessage });
      onChanged();
    } catch (error) {
      const text = describe(error);
      if (text.includes("REPLAYED")) {
        setRequestId(crypto.randomUUID());
        setOutcome({ kind: "done", message: "This was already recorded. Nothing changed." });
        onChanged();
      } else if (text.includes("STALE_COMMAND")) {
        // A decision on an older view. Keep what the person typed, reload, and ask for a new submit.
        setRequestId(crypto.randomUUID());
        setOutcome({ kind: "error", message: "This expansion changed since you opened it. The page reloaded. Check it, then submit again." });
        onChanged();
      } else if (text.includes("CONFLICT") || text.includes("ObjectChanged") || text.includes("ObjectsModifiedConcurrently")) {
        setOutcome({ kind: "error", message: "Busy: someone else changed this expansion at the same moment. Try again." });
      } else if (text.includes("REQUEST_ID_REUSED")) {
        setRequestId(crypto.randomUUID());
        setOutcome({ kind: "error", message: "The app sent a request ID twice. This is a bug; please report it." });
      } else {
        setOutcome({ kind: "error", message: text });
      }
    }
  }

  return { outcome, run, sending: outcome.kind === "sending" };
}

export function OutcomeText({ outcome }: { readonly outcome: Outcome }) {
  if (outcome.message === undefined) return null;
  return (
    <p role={outcome.kind === "error" ? "alert" : "status"} className={outcome.kind}>
      {outcome.message}
    </p>
  );
}

/** The counters of the view the person sees (D6 mechanism 3). */
export interface Expected {
  readonly expansionId: string;
  readonly expectedEvidenceRevision: number;
  readonly expectedStateVersion: number;
}
