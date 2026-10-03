import type { CauseStatus } from "./causes.js";
import { DomainError } from "./errors.js";
import type { EligibilityStatus } from "./transitions.js";
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

function requireRationale(rationale: string): void {
  if (rationale.trim() === "") {
    throw new DomainError("RATIONALE_REQUIRED", "A decision needs a rationale in the person's own words.");
  }
}

/** D5: a supply chain manager selects a lead for a field visit. A verified supplier needs no visit. */
export function checkFieldVisitSelection(input: { readonly eligibility: EligibilityStatus; readonly rationale: string }): void {
  if (input.eligibility === "VERIFIED_PASS" || input.eligibility === "VERIFIED_FAIL") {
    throw new DomainError("ALREADY_VERIFIED", "This supplier already has a field verification for the current ration version.");
  }
  requireRationale(input.rationale);
}

/**
 * D5 and C9: a sourcing decision chooses a supplier that is eligible now: a passed field verification against the
 * current ration version. A quote alone never qualifies. The decision records a choice only: it creates no purchase
 * order and moves no money (D1).
 */
export function checkSourcingDecision(input: { readonly eligibility: EligibilityStatus; readonly rationale: string }): void {
  if (input.eligibility !== "VERIFIED_PASS") {
    throw new DomainError("NOT_ELIGIBLE", "Only a supplier with a passed field verification for the current ration version can be chosen.");
  }
  requireRationale(input.rationale);
}

/** D5: a field verification result is PASS or FAIL, for a known ration version, recorded by a field verifier. */
export function checkFieldVerification(input: {
  readonly result: string;
  readonly rationVersion: number;
  readonly currentRationVersion: number;
}): "PASS" | "FAIL" {
  if (input.result !== "PASS" && input.result !== "FAIL") {
    throw new DomainError("UNKNOWN_RESULT", `"${input.result}" is not PASS or FAIL.`);
  }
  if (input.rationVersion !== input.currentRationVersion) {
    throw new DomainError(
      "OLD_RATION_VERSION",
      `The visit checked ration version ${input.rationVersion}, but the expansion uses version ${input.currentRationVersion}.`,
    );
  }
  return input.result;
}

/**
 * D5 outreach: a supply chain manager approves or rejects 1 valid AI draft, once. An approval stores the text the
 * person approved, which may differ from the draft, and requests the notification (D6.6). A rejection stores only
 * the decision. Returns the text to store, or null for a rejection.
 */
export function checkOutreachDecision(input: {
  readonly runJob: string;
  readonly runStatus: string;
  readonly alreadyDecided: boolean;
  readonly decision: string;
  readonly approvedText: string;
  readonly rationale: string;
  readonly maxCharacters: number;
}): string | null {
  if (input.runJob !== "OUTREACH_DRAFT" || input.runStatus !== "SUCCEEDED") {
    throw new DomainError("NOT_A_DRAFT", "Only a valid AI outreach draft can be approved or rejected.");
  }
  if (input.alreadyDecided) throw new DomainError("ALREADY_DECIDED", "This draft was already approved or rejected.");
  if (input.decision !== "APPROVE" && input.decision !== "REJECT") {
    throw new DomainError("UNKNOWN_DECISION", `"${input.decision}" is not APPROVE or REJECT.`);
  }
  requireRationale(input.rationale);
  if (input.decision === "REJECT") return null;
  const text = input.approvedText.trim();
  if (text === "") throw new DomainError("TEXT_REQUIRED", "An approval needs the message text that the person approves.");
  if (text.length > input.maxCharacters) throw new DomainError("TEXT_TOO_LONG", `The message is longer than ${input.maxCharacters} characters.`);
  return text;
}
