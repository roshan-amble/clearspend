import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OBJECT_TYPES } from "./lib/ontology.js";
import { FIXTURE_DIR, MARKET_PRICES_FILE } from "./lib/paths.js";

function csvHeader(path: string): string[] {
  const firstLine = readFileSync(path, "utf-8").split("\n", 1)[0] ?? "";
  return firstLine.split(",");
}

function sourceFields(fixture: string): string[] {
  const path = join(FIXTURE_DIR, fixture);
  if (fixture.endsWith(".json")) {
    const records = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>[];
    return [...new Set(records.flatMap((record) => Object.keys(record)))];
  }
  return csvHeader(path);
}

describe("Cs object type spec", () => {
  it("every API name has the Cs prefix and is unique", () => {
    const names = OBJECT_TYPES.map((type) => type.apiName);
    expect(names.every((name) => /^Cs[A-Z][A-Za-z]+$/.test(name))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(OBJECT_TYPES)("$apiName has unique snake_case properties, and a required string primary key and title", (type) => {
    const ids = type.properties.map((property) => property.id);
    expect(ids.every((id) => /^[a-z][a-z0-9_]*$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    const key = type.properties.find((property) => property.id === type.primaryKey);
    expect(key?.kind).toBe("string");
    expect(key?.nullable).toBe(false);
    expect(ids).toContain(type.title);
  });

  it.each(OBJECT_TYPES.filter((type) => type.fixture !== undefined))(
    "$apiName maps every field of $fixture exactly once",
    (type) => {
      const fields = sourceFields(type.fixture ?? "");
      const mapped = type.properties.flatMap((property) => (property.source === undefined ? [] : [property.source]));
      const dropped = Object.keys(type.droppedSourceFields ?? {});
      expect([...mapped, ...dropped].sort()).toEqual([...fields].sort());
    },
  );

  it("CsMarketPrice maps every column of the uploaded market file exactly once", () => {
    const type = OBJECT_TYPES.find((candidate) => candidate.apiName === "CsMarketPrice");
    const mapped = type?.properties.map((property) => property.source) ?? [];
    expect([...mapped].sort()).toEqual(csvHeader(MARKET_PRICES_FILE).sort());
  });
});
