import { describe, expect, it } from "vitest";
import { classifyByRule, resolveIncidentCause } from "./causes.js";
import { canPerform, PERMISSIONS, assertCanPerform, type Operation, type Role } from "./permissions.js";
import { decisionState, isEligible, nextOutreachStatus, supplierEligibility } from "./transitions.js";

describe("incident causes (brief 9.1, D5, I10)", () => {
  it("classifies a failed acceptance test at receipt as a supplier failure, with no AI", () => {
    expect(classifyByRule([{ acceptance: "FAIL" }])).toBe("SUPPLIER");
    expect(classifyByRule([{ acceptance: "PASS" }])).toBeNull();
  });

  it("an AI proposal alone is never a cause: the metric stays a range", () => {
    const resolved = resolveIncidentCause({
      ruleCause: null,
      aiProposals: [{ proposalId: "P1", proposedCause: "TRANSPORT_AFTER_HANDOVER" }],
      confirmations: [],
    });

    expect(resolved).toEqual({
      status: "AI_PROPOSED",
      effectiveCause: null,
      proposedCause: "TRANSPORT_AFTER_HANDOVER",
    });
  });

  it("a person can confirm a different cause than the AI proposed, and the latest active confirmation wins", () => {
    const resolved = resolveIncidentCause({
      ruleCause: null,
      aiProposals: [{ proposalId: "P1", proposedCause: "SUPPLIER" }],
      confirmations: [
        { decisionId: "D1", chosenCause: "SUPPLIER", createdAt: "2026-09-28T10:00:00Z" },
        {
          decisionId: "D2",
          chosenCause: "TRANSPORT_AFTER_HANDOVER",
          createdAt: "2026-09-28T11:00:00Z",
          supersedesDecisionId: "D1",
        },
      ],
    });

    expect(resolved.status).toBe("CONFIRMED");
    expect(resolved.effectiveCause).toBe("TRANSPORT_AFTER_HANDOVER");
  });

  it("a rule result is final, even if a person confirmed something else", () => {
    const resolved = resolveIncidentCause({
      ruleCause: "SUPPLIER",
      aiProposals: [],
      confirmations: [{ decisionId: "D1", chosenCause: "STORAGE", createdAt: "2026-09-28T10:00:00Z" }],
    });

    expect(resolved).toMatchObject({ status: "RULE_CLASSIFIED", effectiveCause: "SUPPLIER" });
  });
});

describe("supplier eligibility (C9)", () => {
  it("is eligible only with a PASS against the current ration version", () => {
    const oldPass = [{ rationVersion: 1, result: "PASS" as const, visitedAt: "2026-09-01T00:00:00Z" }];

    expect(supplierEligibility({ currentRationVersion: 2, verifications: oldPass, selectedForVisit: false })).toBe(
      "LEAD",
    );
    expect(supplierEligibility({ currentRationVersion: 2, verifications: oldPass, selectedForVisit: true })).toBe(
      "SELECTED_FOR_VISIT",
    );
    expect(isEligible(supplierEligibility({ currentRationVersion: 1, verifications: oldPass, selectedForVisit: false }))).toBe(true);
  });

  it("uses the latest verification for the current ration version", () => {
    const status = supplierEligibility({
      currentRationVersion: 1,
      selectedForVisit: true,
      verifications: [
        { rationVersion: 1, result: "PASS", visitedAt: "2026-09-01T00:00:00Z" },
        { rationVersion: 1, result: "FAIL", visitedAt: "2026-09-20T00:00:00Z" },
      ],
    });

    expect(status).toBe("VERIFIED_FAIL");
  });
});

describe("outreach and decision states (D5)", () => {
  it("cannot request a notification before a person approves the message", () => {
    expect(() => nextOutreachStatus("DRAFTED", "NOTIFICATION_REQUESTED")).toThrowError(
      /cannot go from DRAFTED to NOTIFICATION_REQUESTED/,
    );
    expect(nextOutreachStatus("DRAFTED", "APPROVED")).toBe("APPROVED");
    expect(nextOutreachStatus("APPROVED", "NOTIFICATION_REQUESTED")).toBe("NOTIFICATION_REQUESTED");
  });

  it("never requests a notification twice, and never undoes a rejection (D6.6)", () => {
    expect(() => nextOutreachStatus("NOTIFICATION_REQUESTED", "APPROVED")).toThrowError(
      /cannot go from NOTIFICATION_REQUESTED/,
    );
    expect(() => nextOutreachStatus("REJECTED", "APPROVED")).toThrowError(/cannot go from REJECTED/);
  });

  it("marks a decision for review when new evidence arrives", () => {
    expect(decisionState(3, null)).toBe("UNDECIDED");
    expect(decisionState(3, 3)).toBe("DECIDED");
    expect(decisionState(4, 3)).toBe("NEEDS_REVIEW");
  });
});

describe("permissions (D1, D5)", () => {
  const operations = Object.keys(PERMISSIONS) as Operation[];

  it("the finance manager can read but cannot write anything", () => {
    for (const operation of operations) {
      expect(canPerform(["FINANCE_MANAGER"], operation)).toBe(false);
    }
  });

  it("the field verifier can only record field verifications", () => {
    const allowed = operations.filter((operation) => canPerform(["FIELD_VERIFIER"], operation));

    expect(allowed).toEqual(["RECORD_FIELD_VERIFICATION"]);
  });

  it("the supply chain manager can do every write except importing evidence and recording a field verification", () => {
    const denied = operations.filter((operation) => !canPerform(["SUPPLY_CHAIN_MANAGER"], operation));

    expect(denied).toEqual(["IMPORT_EVIDENCE", "RECORD_FIELD_VERIFICATION"]);
  });

  it("only the evidence importer can import evidence, and it can do nothing else (D9.2)", () => {
    const importers = (["SUPPLY_CHAIN_MANAGER", "FIELD_VERIFIER", "FINANCE_MANAGER", "EVIDENCE_IMPORTER"] as const).filter(
      (role) => canPerform([role], "IMPORT_EVIDENCE"),
    );
    const allowed = operations.filter((operation) => canPerform(["EVIDENCE_IMPORTER"], operation));

    expect(importers).toEqual(["EVIDENCE_IMPORTER"]);
    expect(allowed).toEqual(["IMPORT_EVIDENCE"]);
  });

  it("has no operation that moves money or creates a purchase, for any role (D1)", () => {
    const roles: Role[] = ["SUPPLY_CHAIN_MANAGER", "FIELD_VERIFIER", "FINANCE_MANAGER", "EVIDENCE_IMPORTER"];

    expect(operations.filter((operation) => /PAY|PURCHASE|ORDER|MONEY/.test(operation))).toEqual([]);
    expect(() => assertCanPerform(roles.slice(2), "CONFIRM_CAUSE")).toThrowError(/PERMISSION|can CONFIRM_CAUSE/);
  });
});
