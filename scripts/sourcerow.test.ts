import { canonicalJson, parseEvidenceRows, sourceRowOf, EDITABLE_KINDS, type Json } from "@clearspend/domain";
import { describe, expect, it } from "vitest";
import { fixtureRows } from "./lib/expected-snapshot.js";

// UI3 A: a studio edit writes the source row again. Unchanged, it must parse back to the same props (a replay).
describe("source rows round-trip (UI3)", () => {
  it.each(EDITABLE_KINDS)("%s: every fixture row parses back to the same props", (kind) => {
    const rows = fixtureRows(kind, "demo");
    expect(rows.length).toBeGreaterThan(0);
    const again = parseEvidenceRows(kind, rows.map((row) => sourceRowOf(kind as never, row.logicalId, row.props as never)));
    expect(again.map((row) => canonicalJson(row.props as unknown as Json))).toEqual(rows.map((row) => canonicalJson(row.props as unknown as Json)));
    expect(again.map((row) => row.logicalId)).toEqual(rows.map((row) => row.logicalId));
  });
});
