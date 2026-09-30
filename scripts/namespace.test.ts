import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVIDENCE_KINDS, parseEvidenceRows } from "@clearspend/domain";
import { describe, expect, it } from "vitest";
import { readCsv } from "./lib/csv.js";
import { KIND_FILES } from "./lib/kinds.js";
import { namespaceExpansion, namespaceRow } from "./lib/namespace.js";
import { FIXTURE_DIR } from "./lib/paths.js";

const fixture = (file: string): Record<string, unknown>[] =>
  file.endsWith(".json")
    ? (JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf-8")) as Record<string, unknown>[])
    : readCsv(join(FIXTURE_DIR, file));

describe("namespaces (D4)", () => {
  it("prefixes the source system and suffixes the expansion, so no logical ID collides with the demo", () => {
    const [demo] = parseEvidenceRows("orders", fixture("orders.csv").slice(0, 1));
    const [test] = parseEvidenceRows("orders", fixture("orders.csv").slice(0, 1).map((row) => namespaceRow(row, "t1")));

    expect(demo?.logicalId).toBe("harbor-erp:PO-A1");
    expect(test?.logicalId).toBe("t1/harbor-erp:PO-A1");
    expect(test?.props).toMatchObject({ expansionId: "EXP-ANDROY-2026-T1", supplierLogicalId: "t1/harbor-erp:SUP-A" });
  });

  it.each([...EVIDENCE_KINDS])("keeps every %s row valid inside a namespace", (kind) => {
    const rows = fixture(KIND_FILES[kind].file).map((row) => namespaceRow(row, "t1"));
    expect(parseEvidenceRows(kind, rows).length).toBe(rows.length);
  });

  it("refuses a namespace that could break an ID", () => {
    expect(() => namespaceRow({}, "T1:x")).toThrowError(/lower-case/);
    expect(namespaceExpansion("EXP-ANDROY-2026", null)).toBe("EXP-ANDROY-2026");
  });
});
