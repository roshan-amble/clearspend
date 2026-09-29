import { DomainError } from "./errors.js";

export type EligibilityStatus = "LEAD" | "SELECTED_FOR_VISIT" | "VERIFIED_PASS" | "VERIFIED_FAIL";

export interface FieldVerificationRef {
  readonly rationVersion: number;
  readonly result: "PASS" | "FAIL";
  /** ISO 8601 UTC text. */
  readonly visitedAt: string;
}

/**
 * D5 and C9: a supplier is eligible only with a passed field verification against the CURRENT ration version.
 * A verification against an older ration version does not count.
 */
export function supplierEligibility(input: {
  readonly currentRationVersion: number;
  readonly verifications: readonly FieldVerificationRef[];
  readonly selectedForVisit: boolean;
}): EligibilityStatus {
  const latest = input.verifications
    .filter((verification) => verification.rationVersion === input.currentRationVersion)
    .reduce<FieldVerificationRef | null>(
      (best, candidate) => (best === null || candidate.visitedAt > best.visitedAt ? candidate : best),
      null,
    );
  if (latest !== null) return latest.result === "PASS" ? "VERIFIED_PASS" : "VERIFIED_FAIL";
  return input.selectedForVisit ? "SELECTED_FOR_VISIT" : "LEAD";
}

export function isEligible(status: EligibilityStatus): boolean {
  return status === "VERIFIED_PASS";
}

/**
 * D5 and D6.6. Foundry sends a notification after the Action saves, and reports no delivery to the caller.
 * So the last state claims only what ClearSpend knows: the notification was requested. There is no NOTIFIED.
 */
export type OutreachStatus = "DRAFTED" | "APPROVED" | "REJECTED" | "NOTIFICATION_REQUESTED";

const OUTREACH_TRANSITIONS: Readonly<Record<OutreachStatus, readonly OutreachStatus[]>> = {
  DRAFTED: ["APPROVED", "REJECTED"],
  APPROVED: ["NOTIFICATION_REQUESTED"],
  REJECTED: [],
  NOTIFICATION_REQUESTED: [],
};

/** D5: nothing is requested without a person's approval, and a requested notification is never requested again. */
export function nextOutreachStatus(from: OutreachStatus, to: OutreachStatus): OutreachStatus {
  if (!OUTREACH_TRANSITIONS[from].includes(to)) {
    throw new DomainError("INVALID_OUTREACH_TRANSITION", `An outreach message cannot go from ${from} to ${to}.`);
  }
  return to;
}

export type DecisionState = "UNDECIDED" | "DECIDED" | "NEEDS_REVIEW";

/** D5: a decision made at revision n needs review when the evidence revision passes n. */
export function decisionState(currentRevision: number, decidedAtRevision: number | null): DecisionState {
  if (decidedAtRevision === null) return "UNDECIDED";
  return currentRevision > decidedAtRevision ? "NEEDS_REVIEW" : "DECIDED";
}
