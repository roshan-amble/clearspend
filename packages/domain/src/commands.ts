import type { CauseStatus } from "./causes.js";
import { DomainError } from "./errors.js";
import type { Cause } from "./types.js";

/** The counters on CsExpansion (D6 mechanism 2). */
export interface Counters {
  readonly evidenceRevision: number;
  readonly stateVersion: number;
}

export type CommandCheck =
  | { readonly result: "PROCEED" }
  /** Same requestId, same content: the first attempt committed. The caller treats this as success. */
  | { readonly result: "REPLAYED" }
  /** Same requestId, other content: a client bug, never a user mistake. */
  | { readonly result: "REQUEST_ID_REUSED" }
  /** The person decided on an older view. Nothing is written. */
  | { readonly result: "STALE_COMMAND"; readonly detail: string };

/**
 * D6 mechanism 5: the replay check comes before the guard. After a first commit the counters have moved, so a
 * retry of that same command would otherwise look stale.
 */
export function checkCommand(input: {
  readonly existing: { readonly requestDigest: string } | null;
  readonly requestDigest: string;
  readonly expected: Counters;
  readonly actual: Counters;
}): CommandCheck {
  if (input.existing !== null) {
    return input.existing.requestDigest === input.requestDigest ? { result: "REPLAYED" } : { result: "REQUEST_ID_REUSED" };
  }
  const { expected, actual } = input;
  if (expected.evidenceRevision !== actual.evidenceRevision || expected.stateVersion !== actual.stateVersion) {
    return {
      result: "STALE_COMMAND",
      detail:
        `The expansion changed since it was opened: evidence revision ${actual.evidenceRevision} and state version ` +
        `${actual.stateVersion}, not ${expected.evidenceRevision} and ${expected.stateVersion}.`,
    };
  }
  return { result: "PROCEED" };
}

export const CAUSES: readonly Cause[] = ["SUPPLIER", "TRANSPORT_AFTER_HANDOVER", "STORAGE", "BUYER", "UNKNOWN"];

/**
 * D5: a person confirms the cause of an incident that the rule did not classify. A rule result is final.
 * The rationale is required (brief section 8). Returns the cause, checked.
 */
export function checkCauseConfirmation(input: {
  readonly status: CauseStatus;
  readonly chosenCause: string;
  readonly rationale: string;
}): Cause {
  if (input.status === "RULE_CLASSIFIED") {
    throw new DomainError("RULE_IS_FINAL", "The rule already classified this incident. A person cannot change a rule result (D5).");
  }
  if (!(CAUSES as readonly string[]).includes(input.chosenCause)) {
    throw new DomainError("UNKNOWN_CAUSE", `"${input.chosenCause}" is not one of ${CAUSES.join(", ")}.`);
  }
  if (input.rationale.trim() === "") {
    throw new DomainError("RATIONALE_REQUIRED", "A confirmation needs a rationale in the person's own words.");
  }
  return input.chosenCause as Cause;
}
