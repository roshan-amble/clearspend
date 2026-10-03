import {
  causeInput,
  comparisonItems,
  explanationInput,
  extractionInput,
  outreachInput,
  snapshotRecords,
  INPUT_LIMITS,
  validateCauseOutput,
  validateExplanationOutput,
  validateExtractionOutput,
  validateOutreachOutput,
  type AiInput,
} from "@clearspend/domain";
import { describe, expect, it } from "vitest";
import { expectedSnapshot, fixtureRows } from "./lib/expected-snapshot.js";

// D7: the AI boundary on the story fixtures. These tests need no model: they check what goes in and what the app
// accepts. Whether a model's cited record really supports its claim stays a person's review (brief section 9).

const incident = fixtureRows("incidents").find((row) => row.externalId === "INC-A4");
const order = fixtureRows("orders").find((row) => row.externalId === "PO-A4");
const deliveries = fixtureRows("deliveries").filter((row) => row.props.orderLogicalId === "harbor-erp:PO-A4");
if (incident === undefined || order === undefined) throw new Error("INC-A4 or PO-A4 is missing from the fixtures.");
const cause: AiInput = causeInput({ evidenceRevision: 9, incident, order, deliveries });

const goodCause = {
  evidenceRevision: 9,
  subjectId: "harbor-erp:INC-A4",
  proposedCause: "UNKNOWN",
  citations: [
    { evidenceId: "DOC-A4-WAREHOUSE", statement: "The warehouse manager blames the supplier's packaging.", supports: "SUPPLIER" },
    { evidenceId: "DOC-A4-TRANSPORT", statement: "The transporter reports 4 days of rain after handover.", supports: "TRANSPORT_AFTER_HANDOVER" },
  ],
  conflicts: [{ evidenceIds: ["DOC-A4-WAREHOUSE", "DOC-A4-TRANSPORT"], description: "The documents blame different parties." }],
  unknowns: ["No moisture test after handover."],
};

describe("cause proposal input and validation (9.1, D7.3)", () => {
  it("sends both INC-A4 documents, the order, and its delivery, as citable evidence", () => {
    expect(cause.evidence.map((item) => item.id)).toEqual([
      "DOC-A4-WAREHOUSE",
      "DOC-A4-TRANSPORT",
      "harbor-erp:PO-A4",
      "harbor-erp:DEL-A4",
      "harbor-erp:INC-A4",
    ]);
    expect(cause.truncated).toBe(false);
  });

  it("accepts a well-formed proposal that cites only evidence it was given", () => {
    expect(validateCauseOutput(JSON.stringify(goodCause), cause).status).toBe("SUCCEEDED");
  });

  it.each([
    ["an invented citation", { ...goodCause, citations: [{ ...goodCause.citations[0], evidenceId: "DOC-FAKE" }] }, /not in the input/],
    ["an older revision", { ...goodCause, evidenceRevision: 8 }, /echo 9/],
    ["a cause outside the enum", { ...goodCause, proposedCause: "WEATHER" }, /proposedCause must be one of/],
    ["an extra score field", { ...goodCause, confidenceScore: 0.9 }, /does not allow: confidenceScore/],
  ])("marks %s INVALID", (_label, output, reason) => {
    const result = validateCauseOutput(JSON.stringify(output), cause);
    expect(result.status).toBe("INVALID");
    expect(result.status === "INVALID" ? result.reasons.join(" ") : "").toMatch(reason);
  });

  it("marks text that is not JSON INVALID, never a fabricated fallback", () => {
    expect(validateCauseOutput("The supplier is at fault.", cause)).toEqual({ status: "INVALID", reasons: ["The output is not valid JSON."] });
  });
});

describe("profile extraction input and validation (9.2, D7.3)", () => {
  const ration = fixtureRows("expansion-commodities").find((row) => row.props.commodity === "RICE")?.props;
  const profile = (id: string) => {
    const row = fixtureRows("supplier-profiles").find((candidate) => candidate.externalId === id);
    if (row === undefined || ration === undefined) throw new Error(`${id} or the rice ration is missing.`);
    return { row, input: extractionInput({ evidenceRevision: 9, profile: { versionId: `${row.logicalId}@v`, props: row.props }, ration }) };
  };

  it("accepts claims whose spans are verbatim profile text, and rejects a span the profile does not contain", () => {
    const { row, input } = profile("SUP-L1");
    const base = { evidenceRevision: 9, subjectId: input.subjectId, language: "fr", gaps: [], instructionLikeText: [] };
    const good = { ...base, claims: [{ field: "CAPACITY", value: "12,000 kg a month", span: "Capacité : 12 000 kg par mois" }] };
    const invented = { ...base, claims: [{ field: "CAPACITY", value: "20,000 kg", span: "Capacité : 20 000 kg par mois" }] };

    expect(row.props.text).toContain("Capacité : 12 000 kg par mois");
    expect(validateExtractionOutput(JSON.stringify(good), input, row.props.text).status).toBe("SUCCEEDED");
    expect(validateExtractionOutput(JSON.stringify(invented), input, row.props.text).status).toBe("INVALID");
  });

  it("rejects a quality score: the schema has no place for one (9.2)", () => {
    const { row, input } = profile("SUP-L6");
    const scored = { evidenceRevision: 9, subjectId: input.subjectId, language: "en", claims: [], gaps: [], instructionLikeText: [], qualityScore: 9 };

    expect(validateExtractionOutput(JSON.stringify(scored), input, row.props.text).status).toBe("INVALID");
  });
});

describe("input limits (D7.4)", () => {
  it("cuts a long document to 4,000 characters and records the cut", () => {
    if (incident === undefined) throw new Error("INC-A4 is missing.");
    const long = { ...incident, props: { ...incident.props, documents: [{ ...incident.props.documents[0]!, text: "x".repeat(9_000) }] } };
    const input = causeInput({ evidenceRevision: 9, incident: long, order: order!, deliveries });

    expect(input.evidence[0]?.text.length).toBe(INPUT_LIMITS.perItem);
    expect(input.truncated).toBe(true);
  });
});

describe("comparison explanation input and validation (9.3, D7.3)", () => {
  const records = snapshotRecords(expectedSnapshot({}, null, { leads: true }), {
    expansionId: "EXP-ANDROY-2026",
    evidenceRevision: 9,
    rulesVersion: "test",
    createdAt: "2026-09-30T00:00:00Z",
  });
  const input = explanationInput({ evidenceRevision: 9, expansionId: "EXP-ANDROY-2026", items: comparisonItems(records.snapshot, records.lines) });

  it("sends each cost line and the market indicator as items the model may cite, numbers as calculated by code", () => {
    expect(input.evidence.map((item) => item.id)).toContain("EXP-ANDROY-2026@9:market");
    expect(input.evidence).toHaveLength(records.lines.length + 1);
    const rice = input.evidence.find((item) => item.id === "EXP-ANDROY-2026@9:harbor-erp:SUP-A:RICE")?.text ?? "";
    // Rounded for reading only: the model sees 5.5 to 5.7 cents, never 11/2, and a quote is never a paid cost.
    expect(rice).toContain("5.5 to 5.7 US cents for this supplier");
    expect(rice).toContain("meals for 1 US dollar");
    const lead = input.evidence.find((item) => item.id === "EXP-ANDROY-2026@9:harbor-leads:SUP-L1:RICE")?.text ?? "";
    expect(lead).toContain("No paid cost");
    expect(lead).toContain("Quoted price for 1 meal: 5.1 US cents. A quote, never a paid cost.");
    expect(lead).toContain("the failure risk is unknown, not 0");
    const market = input.evidence.find((item) => item.id === "EXP-ANDROY-2026@9:market")?.text ?? "";
    expect(market).toContain("RICE: the planned purchase is 2.5% of a synthetic monthly market estimate; below the review threshold of 10%");
    expect(market).toContain("Rice (local) (LOCAL): 14.1% from 2025-09 to 2026-08");
  });

  it("accepts an explanation that cites only sent items, and rejects a recommendation field", () => {
    const good = {
      evidenceRevision: 9,
      subjectId: "EXP-ANDROY-2026",
      summary: "The import route has the longest record.",
      observations: [{ text: "Rice from the import route has more batches.", evidenceIds: [records.lines[0]!.costLineId], category: "RECORDED_FACT" }],
      unknowns: ["No field result for the new leads yet."],
      suggestedNextSteps: [{ kind: "FIELD_VERIFY", reason: "Leads are unverified.", evidenceIds: [] }],
    };
    expect(validateExplanationOutput(JSON.stringify(good), input).status).toBe("SUCCEEDED");
    expect(validateExplanationOutput(JSON.stringify({ ...good, recommendedSupplier: "SUP-L1" }), input).status).toBe("INVALID");
    const invented = { ...good, observations: [{ ...good.observations[0], evidenceIds: ["PO-INVENTED"] }] };
    expect(validateExplanationOutput(JSON.stringify(invented), input).status).toBe("INVALID");
  });
});

describe("outreach draft input and validation (D5, D7.6)", () => {
  const profile = fixtureRows("supplier-profiles").find((row) => row.externalId === "SUP-L1");
  const ration = fixtureRows("expansion-commodities").find((row) => row.props.commodity === "RICE");
  if (profile === undefined || ration === undefined) throw new Error("SUP-L1 or the rice spec is missing.");
  const input = outreachInput({ evidenceRevision: 15, profile: { versionId: "harbor-leads:SUP-L1@abc", props: profile.props }, ration: ration.props });
  const good = {
    evidenceRevision: 15,
    subjectId: "harbor-leads:SUP-L1@abc",
    language: "fr",
    subject: "Visite de terrain",
    body: "Bonjour, pourriez-vous nous envoyer le certificat du laboratoire ?",
    requestedEvidence: ["Certificat du laboratoire"],
    citations: ["harbor-leads:SUP-L1@abc"],
  };

  it("uses the extraction evidence, as its own job", () => {
    expect(input.job).toBe("OUTREACH_DRAFT");
    expect(input.evidence.map((item) => item.id)).toEqual(["harbor-leads:SUP-L1@abc", "EXP-ANDROY-2026:RICE"]);
  });

  it("accepts a draft that cites the sent profile, and rejects a draft that cites anything else or adds fields", () => {
    expect(validateOutreachOutput(JSON.stringify(good), input).status).toBe("SUCCEEDED");
    expect(validateOutreachOutput(JSON.stringify({ ...good, citations: ["harbor-leads:SUP-L6@x"] }), input).status).toBe("INVALID");
    expect(validateOutreachOutput(JSON.stringify({ ...good, sendNow: true }), input).status).toBe("INVALID");
    expect(validateOutreachOutput(JSON.stringify({ ...good, body: "x".repeat(2_001) }), input).status).toBe("INVALID");
  });
});
