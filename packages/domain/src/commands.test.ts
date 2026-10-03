import { describe, expect, it } from "vitest";
import { checkCauseConfirmation, checkCommand, checkFieldVerification, checkFieldVisitSelection, checkOutreachDecision, checkSourcingDecision } from "./commands.js";

const at = (evidenceRevision: number, stateVersion: number) => ({ evidenceRevision, stateVersion });

describe("command check (D6)", () => {
  it("proceeds when both counters match and the request is new", () => {
    expect(checkCommand({ existing: null, requestDigest: "d1", expected: at(3, 9), actual: at(3, 9) })).toEqual({ result: "PROCEED" });
  });

  it("rejects a decision made on an older view, when either counter moved", () => {
    expect(checkCommand({ existing: null, requestDigest: "d1", expected: at(3, 9), actual: at(4, 10) }).result).toBe("STALE_COMMAND");
    expect(checkCommand({ existing: null, requestDigest: "d1", expected: at(3, 9), actual: at(3, 10) }).result).toBe("STALE_COMMAND");
  });

  it("answers a retry of a committed request with REPLAYED, even though the counters moved since", () => {
    expect(checkCommand({ existing: { requestDigest: "d1" }, requestDigest: "d1", expected: at(3, 9), actual: at(4, 10) })).toEqual({
      result: "REPLAYED",
    });
  });

  it("flags the same requestId with different content as a client bug", () => {
    expect(checkCommand({ existing: { requestDigest: "d1" }, requestDigest: "d2", expected: at(3, 9), actual: at(3, 9) }).result).toBe(
      "REQUEST_ID_REUSED",
    );
  });
});

describe("cause confirmation (D5)", () => {
  it("accepts a cause with a rationale for an unconfirmed incident, including a different cause than AI proposed", () => {
    expect(checkCauseConfirmation({ status: "AI_PROPOSED", chosenCause: "STORAGE", rationale: "Mould in the warehouse." })).toBe("STORAGE");
  });

  it("never lets a person change a rule result", () => {
    expect(() => checkCauseConfirmation({ status: "RULE_CLASSIFIED", chosenCause: "BUYER", rationale: "x" })).toThrowError(/rule already/);
  });

  it("requires a known cause and a rationale", () => {
    expect(() => checkCauseConfirmation({ status: "UNCONFIRMED", chosenCause: "WEATHER", rationale: "x" })).toThrowError(/not one of/);
    expect(() => checkCauseConfirmation({ status: "UNCONFIRMED", chosenCause: "UNKNOWN", rationale: "  " })).toThrowError(/rationale/);
  });
});

describe("field visits and sourcing decisions (D5, C9)", () => {
  it("selects only a supplier that is not verified yet, with a rationale", () => {
    expect(() => checkFieldVisitSelection({ eligibility: "LEAD", rationale: "Lab certificate claimed; check storage." })).not.toThrow();
    expect(() => checkFieldVisitSelection({ eligibility: "VERIFIED_PASS", rationale: "x" })).toThrowError(/already has a field verification/);
    expect(() => checkFieldVisitSelection({ eligibility: "LEAD", rationale: " " })).toThrowError(/rationale/);
  });

  it("chooses only an eligible supplier: a quote alone never qualifies", () => {
    expect(() => checkSourcingDecision({ eligibility: "VERIFIED_PASS", rationale: "Trial purchase; import route as backup." })).not.toThrow();
    expect(() => checkSourcingDecision({ eligibility: "LEAD", rationale: "Cheapest quote." })).toThrowError(/passed field verification/);
    expect(() => checkSourcingDecision({ eligibility: "VERIFIED_FAIL", rationale: "x" })).toThrowError(/passed field verification/);
  });

  it("records a verification only against the current ration version", () => {
    expect(checkFieldVerification({ result: "PASS", rationVersion: 1, currentRationVersion: 1 })).toBe("PASS");
    expect(() => checkFieldVerification({ result: "PASS", rationVersion: 1, currentRationVersion: 2 })).toThrowError(/ration version 1/);
    expect(() => checkFieldVerification({ result: "MAYBE", rationVersion: 1, currentRationVersion: 1 })).toThrowError(/not PASS or FAIL/);
  });
});

describe("outreach decision (D5, D6.6)", () => {
  const draft = { runJob: "OUTREACH_DRAFT", runStatus: "SUCCEEDED", alreadyDecided: false, maxCharacters: 2000 };

  it("approves the text the person edited, and rejects with no text", () => {
    expect(checkOutreachDecision({ ...draft, decision: "APPROVE", approvedText: "  Bonjour.  ", rationale: "Ask for the lab report." })).toBe("Bonjour.");
    expect(checkOutreachDecision({ ...draft, decision: "REJECT", approvedText: "", rationale: "Not needed now." })).toBeNull();
  });

  it("never approves an invalid run, another job, or a draft decided before", () => {
    expect(() => checkOutreachDecision({ ...draft, runStatus: "INVALID", decision: "APPROVE", approvedText: "x", rationale: "x" })).toThrowError(/valid AI outreach draft/);
    expect(() => checkOutreachDecision({ ...draft, runJob: "EXTRACTION", decision: "APPROVE", approvedText: "x", rationale: "x" })).toThrowError(/valid AI outreach draft/);
    expect(() => checkOutreachDecision({ ...draft, alreadyDecided: true, decision: "REJECT", approvedText: "", rationale: "x" })).toThrowError(/already/);
  });

  it("requires a rationale, and a text for an approval", () => {
    expect(() => checkOutreachDecision({ ...draft, decision: "APPROVE", approvedText: " ", rationale: "Ask." })).toThrowError(/message text/);
    expect(() => checkOutreachDecision({ ...draft, decision: "APPROVE", approvedText: "Hi", rationale: " " })).toThrowError(/rationale/);
  });
});
