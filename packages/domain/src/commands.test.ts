import { describe, expect, it } from "vitest";
import { checkCauseConfirmation, checkCommand } from "./commands.js";

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
