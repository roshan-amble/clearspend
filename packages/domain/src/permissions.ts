import { DomainError } from "./errors.js";

/**
 * D1 roles, plus EVIDENCE_IMPORTER (D9.2): a technical role for the import script only. It holds no business
 * role, and no business role can import evidence, so the person who decides cannot change the evidence.
 */
export type Role = "SUPPLY_CHAIN_MANAGER" | "FIELD_VERIFIER" | "FINANCE_MANAGER" | "EVIDENCE_IMPORTER";

/**
 * Every write that ClearSpend can do. D1: there is deliberately no payment or purchase operation,
 * so no role can ever be given one.
 */
export type Operation =
  | "IMPORT_EVIDENCE"
  | "START_AI_JOB"
  | "CONFIRM_CAUSE"
  | "SELECT_FIELD_VISIT"
  | "RECORD_FIELD_VERIFICATION"
  | "DECIDE_OUTREACH"
  | "RECORD_SOURCING_DECISION";

/** D5 "who can do what". The Foundry Action submission rules must match this table. */
export const PERMISSIONS: Readonly<Record<Operation, readonly Role[]>> = {
  IMPORT_EVIDENCE: ["EVIDENCE_IMPORTER"],
  START_AI_JOB: ["SUPPLY_CHAIN_MANAGER"],
  CONFIRM_CAUSE: ["SUPPLY_CHAIN_MANAGER"],
  SELECT_FIELD_VISIT: ["SUPPLY_CHAIN_MANAGER"],
  RECORD_FIELD_VERIFICATION: ["FIELD_VERIFIER"],
  DECIDE_OUTREACH: ["SUPPLY_CHAIN_MANAGER"],
  RECORD_SOURCING_DECISION: ["SUPPLY_CHAIN_MANAGER"],
};

export function canPerform(roles: readonly Role[], operation: Operation): boolean {
  return roles.some((role) => PERMISSIONS[operation].includes(role));
}

export function assertCanPerform(roles: readonly Role[], operation: Operation): void {
  if (!canPerform(roles, operation)) {
    throw new DomainError("PERMISSION_DENIED", `None of the roles [${roles.join(", ")}] can ${operation}.`);
  }
}
