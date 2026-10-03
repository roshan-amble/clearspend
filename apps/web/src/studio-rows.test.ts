import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inNamespace, kindOfColumns, namespaceOf, parseCsv, readRows } from "./studio-rows";

const FIXTURES = join(__dirname, "../../../data/fixtures");

describe("parseCsv", () => {
  it("reads quoted fields, doubled quotes, commas, and CRLF line ends", () => {
    const rows = parseCsv('a,b,c\r\n1,"x, ""y""",3\r\n"multi\nline",,\r\n');
    expect(rows).toEqual([
      { a: "1", b: 'x, "y"', c: "3" },
      { a: "multi\nline", b: "", c: "" },
    ]);
  });

  it("refuses a row with the wrong number of fields and an unclosed quote", () => {
    expect(() => parseCsv("a,b\n1,2,3\n")).toThrow("CSV row 1 has 3 fields");
    expect(() => parseCsv('a\n"open\n')).toThrow("quoted field");
  });

  it("reads every CSV fixture like the scripts' parser: same rows, same columns", () => {
    for (const file of readdirSync(FIXTURES).filter((f) => f.endsWith(".csv"))) {
      const text = readFileSync(join(FIXTURES, file), "utf-8");
      const rows = parseCsv(text);
      const lines = text.trim().split("\n");
      expect(rows.length, file).toBe(lines.length - 1);
      expect(Object.keys(rows[0] ?? {}), file).toEqual(lines[0]?.split(","));
    }
  });
});

describe("kindOfColumns", () => {
  it("names the kind of every fixture file from its columns", () => {
    const expected: Record<string, string> = {
      "expansion.csv": "expansion",
      "expansion-commodities.csv": "expansion-commodities",
      "suppliers.csv": "suppliers",
      "supplier-profiles.json": "supplier-profiles",
      "orders.csv": "orders",
      "payments.csv": "payments",
      "invoices.csv": "invoices",
      "deliveries.csv": "deliveries",
      "incidents.json": "incidents",
      "field-verifications-initial.csv": "field-verifications",
      "field-verifications-later.csv": "field-verifications",
    };
    for (const [file, kind] of Object.entries(expected)) {
      const rows = readRows(file, readFileSync(join(FIXTURES, file), "utf-8"));
      expect(kindOfColumns(Object.keys(rows[0] ?? {})), file).toBe(kind);
    }
    expect(kindOfColumns(["foo"])).toBeNull();
  });
});

describe("namespaces", () => {
  it("reads the namespace from the expansion ID", () => {
    expect(namespaceOf("EXP-ANDROY-2026-DEMO")).toBe("demo");
    expect(namespaceOf("EXP-ANDROY-2026-T2")).toBe("t2");
    expect(namespaceOf("EXP-ANDROY-2026")).toBeNull();
  });

  it("adds the namespace only to rows that have none", () => {
    const rows = inNamespace([{ source_system: "harbor-erp", expansion_id: "EXP-ANDROY-2026" }, { source_system: "demo/harbor-erp" }], "demo");
    expect(rows).toEqual([{ source_system: "demo/harbor-erp", expansion_id: "EXP-ANDROY-2026-DEMO" }, { source_system: "demo/harbor-erp" }]);
  });
});
