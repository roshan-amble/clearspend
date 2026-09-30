/**
 * Writes the generated copy of packages/domain/src into clearspend-functions (D2 decision 10).
 * The target folder belongs to this script. A file there that the previous sync did not write is an error,
 * because it means someone added code to the copy by hand.
 * Run: npm run domain:sync
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOMAIN_TARGET_DIR,
  expectedCopy,
  FUNCTIONS_REPO_DIR,
  MANIFEST_FILE,
  RULES_VERSION_FILE,
  type DomainManifest,
} from "./lib/domain-copy.js";

if (!existsSync(join(FUNCTIONS_REPO_DIR, "typescript-functions"))) {
  throw new Error(`No functions repository at ${FUNCTIONS_REPO_DIR}. Clone clearspend-functions there, or set CLEARSPEND_FUNCTIONS_DIR.`);
}

mkdirSync(DOMAIN_TARGET_DIR, { recursive: true });
const present = readdirSync(DOMAIN_TARGET_DIR);
const manifestPath = join(DOMAIN_TARGET_DIR, MANIFEST_FILE);
const previous: ReadonlySet<string> = existsSync(manifestPath)
  ? new Set([MANIFEST_FILE, RULES_VERSION_FILE, ...Object.keys((JSON.parse(readFileSync(manifestPath, "utf-8")) as DomainManifest).files)])
  : new Set();
const unknown = present.filter((name) => !previous.has(name));
if (unknown.length > 0) {
  throw new Error(`${DOMAIN_TARGET_DIR} holds files that no sync wrote: ${unknown.join(", ")}. Move them out first.`);
}

for (const name of present) rmSync(join(DOMAIN_TARGET_DIR, name));
const files = expectedCopy();
for (const [name, content] of files) writeFileSync(join(DOMAIN_TARGET_DIR, name), content, "utf-8");
console.log(`Wrote ${files.size - 2} domain files, ${MANIFEST_FILE}, and ${RULES_VERSION_FILE} to ${DOMAIN_TARGET_DIR}.`);
