import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOMAIN_TARGET_DIR, expectedCopy } from "./lib/domain-copy.js";

// D2 decision 10. Without a clone of clearspend-functions next to this repository, there is no copy to check.
describe.skipIf(!existsSync(DOMAIN_TARGET_DIR))("generated domain copy in clearspend-functions", () => {
  const expected = expectedCopy();

  it("holds exactly the files that `npm run domain:sync` writes", () => {
    expect(readdirSync(DOMAIN_TARGET_DIR).sort()).toEqual([...expected.keys()].sort());
  });

  it.each([...expected.keys()])("%s equals the current source. If not, run npm run domain:sync", (name) => {
    expect(readFileSync(join(DOMAIN_TARGET_DIR, name), "utf-8")).toBe(expected.get(name));
  });
});
