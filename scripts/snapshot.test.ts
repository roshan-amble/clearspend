import {
  computeCostLine,
  formatFixed,
  frac,
  mul,
  parseExactText,
  snapshotRecords,
  type Cause,
} from "@clearspend/domain";
import { describe, expect, it } from "vitest";
import { expectedSnapshot } from "./lib/expected-snapshot.js";
import { costIncidents, costPurchases, loadFixtures } from "./lib/fixtures.js";
import { OBJECT_TYPES } from "./lib/ontology.js";

// D6.2: the Action computes the snapshot with buildSnapshot from stored objects. This test feeds it the story
// fixtures as stored objects, and requires the same cost lines as the fixture pipeline that the hero tests check.

const snapshotWith = (confirmed: Readonly<Record<string, Cause>>) => expectedSnapshot(confirmed);

const set = loadFixtures();
const comparable = (line: ReturnType<typeof computeCostLine>) => ({
  nominal: line.nominal,
  supplier: line.supplier,
  route: line.route,
  batches: line.batches,
  failures: line.failures,
  failureRisk: line.failureRisk,
  excluded: line.excluded.map((entry) => entry.status),
  ambiguous: line.ambiguousReplacements.length,
});

describe("buildSnapshot on the story fixtures", () => {
  it.each([
    ["while INC-A4 is unconfirmed", {}],
    ["after INC-A4 is confirmed as transport after handover", { "INC-A4": "TRANSPORT_AFTER_HANDOVER" as const }],
  ])("gives the same cost lines as the fixture pipeline, %s", (_label, confirmed: Readonly<Record<string, Cause>>) => {
    const snapshot = snapshotWith(confirmed);
    const purchases = costPurchases(set);
    const incidents = costIncidents(set, confirmed);

    expect(snapshot.lines.map((entry) => `${entry.supplierLogicalId}/${entry.commodity}/${entry.route}`)).toEqual([
      "harbor-erp:SUP-B/BEANS/LOCAL",
      "harbor-erp:SUP-O/OIL/IMPORT",
      "harbor-erp:SUP-A/RICE/IMPORT",
    ]);
    for (const entry of snapshot.lines) {
      const supplierId = entry.supplierLogicalId.split(":")[1] ?? "";
      const expected = computeCostLine({ supplierId, commodity: entry.commodity, purchases, incidents });
      expect(comparable(entry.line)).toEqual(comparable(expected));
    }
  });

  it("classifies INC-A3 by the rule, and leaves INC-A4 unconfirmed until a person confirms it", () => {
    const before = snapshotWith({}).incidents.map((incident) => [incident.incidentLogicalId, incident.status]);
    const after = snapshotWith({ "INC-A4": "TRANSPORT_AFTER_HANDOVER" }).incidents.find((incident) => incident.incidentLogicalId === "harbor-erp:INC-A4");

    expect(before).toEqual([
      ["harbor-erp:INC-A3", "RULE_CLASSIFIED"],
      ["harbor-erp:INC-A4", "UNCONFIRMED"],
    ]);
    expect(after?.effectiveCause).toBe("TRANSPORT_AFTER_HANDOVER");
  });

  it("records the real market signal: local rice +14.1% from 2025-09 to 2026-08, data as of 2026-08", () => {
    const snapshot = snapshotWith({});
    const rice = snapshot.market.find((entry) => entry.commodity === "RICE")?.series.find((series) => series.route === "LOCAL");

    expect([rice?.firstMonth, rice?.lastMonth]).toEqual(["2025-09", "2026-08"]);
    expect(rice?.change === null || rice === undefined ? null : formatFixed(mul(rice.change, frac(100n)), 1)).toBe("14.1");
    expect(snapshot.marketDataAsOf).toBe("2026-08");
  });

  it("reports the beans change as unknown, because the beans series starts in 2026-02", () => {
    const beans = snapshotWith({}).market.find((entry) => entry.commodity === "BEANS")?.series[0];

    expect(beans?.firstMedianMicros).toBeNull();
    expect(beans?.change).toBeNull();
  });

  it("writes only CsCostSnapshot and CsCostLine properties, with exact text that reads back the same value", () => {
    const records = snapshotRecords(snapshotWith({}), {
      expansionId: "EXP-ANDROY-2026",
      evidenceRevision: 7,
      rulesVersion: "test",
      createdAt: "2026-09-29T00:00:00Z",
    });
    const camel = (id: string): string => id.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
    const propertiesOf = (apiName: string) => new Set(OBJECT_TYPES.find((type) => type.apiName === apiName)?.properties.map((p) => camel(p.id)));
    const rice = records.lines.find((line) => line.commodity === "RICE");

    expect(Object.keys(records.snapshot).filter((key) => !propertiesOf("CsCostSnapshot").has(key))).toEqual([]);
    expect(records.lines.flatMap((line) => Object.keys(line)).filter((key) => !propertiesOf("CsCostLine").has(key))).toEqual([]);
    expect(records.snapshot.snapshotId).toBe("EXP-ANDROY-2026@7");
    // 4.4 cents for each meal of 100 g is 11/250 of a cent for each gram.
    expect(rice?.nominalExact).toBe("11/250");
    expect(parseExactText(rice?.nominalExact ?? "")).toEqual(frac(11n, 250n));
  });

  it("gives the same snapshot whatever order the Ontology returns the objects in", () => {
    const forward = expectedSnapshot({});
    const reversed = expectedSnapshot({}, null, { reverse: true });

    expect(JSON.stringify(snapshotRecords(reversed, META))).toBe(JSON.stringify(snapshotRecords(forward, META)));
  });
});

const META = { expansionId: "EXP-ANDROY-2026", evidenceRevision: 1, rulesVersion: "test", createdAt: "2026-09-29T00:00:00Z" };
