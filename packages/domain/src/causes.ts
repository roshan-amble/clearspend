import type { AcceptanceResult, Cause } from "./types.js";

export type CauseStatus = "RULE_CLASSIFIED" | "UNCONFIRMED" | "AI_PROPOSED" | "CONFIRMED";

export interface CauseProposalRef {
  readonly proposalId: string;
  readonly proposedCause: Cause;
}

export interface CauseConfirmation {
  readonly decisionId: string;
  readonly chosenCause: Cause;
  /** ISO 8601 UTC text. Text order is time order for this format. */
  readonly createdAt: string;
  readonly supersedesDecisionId?: string;
}

export interface ResolvedCause {
  readonly status: CauseStatus;
  /** The cause that the cost model may use. Null means unconfirmed, so the metric shows a range (C5). */
  readonly effectiveCause: Cause | null;
  readonly proposedCause: Cause | null;
}

/**
 * The deterministic rule of brief section 9.1: a failed acceptance test at receipt is a supplier failure.
 * Returns null when the rule does not decide. Then AIP can propose a cause, and a person confirms it.
 */
export function classifyByRule(deliveries: readonly { readonly acceptance: AcceptanceResult }[]): Cause | null {
  return deliveries.some((delivery) => delivery.acceptance === "FAIL") ? "SUPPLIER" : null;
}

function currentConfirmation(confirmations: readonly CauseConfirmation[]): CauseConfirmation | null {
  const superseded = new Set(
    confirmations.flatMap((confirmation) =>
      confirmation.supersedesDecisionId === undefined ? [] : [confirmation.supersedesDecisionId],
    ),
  );
  const active = confirmations.filter((confirmation) => !superseded.has(confirmation.decisionId));
  return active.reduce<CauseConfirmation | null>(
    (latest, candidate) => (latest === null || candidate.createdAt > latest.createdAt ? candidate : latest),
    null,
  );
}

function usable(cause: Cause): Cause | null {
  return cause === "UNKNOWN" ? null : cause;
}

/** D5: the incident cause status. A rule result is final. An AI proposal alone is never a cause (I10). */
export function resolveIncidentCause(input: {
  readonly ruleCause: Cause | null;
  readonly aiProposals: readonly CauseProposalRef[];
  readonly confirmations: readonly CauseConfirmation[];
}): ResolvedCause {
  const latestProposal = input.aiProposals.at(-1)?.proposedCause ?? null;
  if (input.ruleCause !== null) {
    return { status: "RULE_CLASSIFIED", effectiveCause: usable(input.ruleCause), proposedCause: null };
  }
  const confirmation = currentConfirmation(input.confirmations);
  if (confirmation !== null) {
    return {
      status: "CONFIRMED",
      effectiveCause: usable(confirmation.chosenCause),
      proposedCause: latestProposal,
    };
  }
  if (latestProposal !== null) {
    return { status: "AI_PROPOSED", effectiveCause: null, proposedCause: latestProposal };
  }
  return { status: "UNCONFIRMED", effectiveCause: null, proposedCause: null };
}
