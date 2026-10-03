#!/usr/bin/env bash
# Builds a local type-check helper for the Foundry repository clearspend-functions.
# `rune` fails on this machine (docs/design/platform-facts.md), so this script generates the same @ontology/sdk
# with the public @osdk/foundry-sdk-generator, and links public OSDK packages into the functions repository.
# The token comes from FOUNDRY_TOKEN and is passed as an argument. No file stores it.
# Run: npm run functions:harness   (again after object types change)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
harness="${root}/.functions-harness"
functions="${CLEARSPEND_FUNCTIONS_DIR:-${root}/../clearspend-functions}/typescript-functions"
host="https://roshan-amble.usw-3.palantirfoundry.com"
ontology="ri.ontology.main.ontology.17eb06bc-5728-411d-bcd2-772e1b451f20"

: "${FOUNDRY_TOKEN:?Set FOUNDRY_TOKEN first.}"
[[ -d "${functions}" ]] || { echo "No functions repository at ${functions}." >&2; exit 1; }

mkdir -p "${harness}"
cd "${harness}"
[[ -f package.json ]] || echo '{ "name": "clearspend-functions-harness", "private": true }' > package.json
# The same versions as clearspend-functions/typescript-functions/package.json. The Foundry runtime is internal and
# not needed for type-checking.
npm install --no-audit --no-fund --silent \
  @osdk/foundry-sdk-generator@2.72.0 @osdk/client@2.72.0 @osdk/api@2.72.0 @osdk/functions@1.26.0 \
  @osdk/foundry@2.72.0 @opentelemetry/api@^1.9.0 @opentelemetry/api-logs@0.215.0 \
  @osdk/foundry.admin@2.78.0 @osdk/language-models@0.10.0 typescript@5.9 @types/node@24 vitest@4.0.18

# HARNESS_SKIP_TYPES: space-separated object types that are still on a branch (the generator reads main only).
object_types="$(cd "${root}" && HARNESS_SKIP_TYPES="${HARNESS_SKIP_TYPES:-}" npx tsx -e 'import { OBJECT_TYPES } from "./scripts/lib/ontology.ts"; const skip = new Set((process.env.HARNESS_SKIP_TYPES ?? "").split(" ")); console.log(OBJECT_TYPES.map((t) => t.apiName).filter((n) => !skip.has(n)).join(" "))')"
link_types="$(cd "${root}" && npx tsx -e 'import { LINK_TYPES } from "./scripts/lib/ontology.ts"; console.log(LINK_TYPES.flatMap((l) => [`${l.one}.${l.toMany}`, `${l.many}.${l.toOne}`]).join(" "))')"

rm -rf sdk
# shellcheck disable=SC2086 # the type lists are space-separated on purpose
npx foundry-sdk-generator generatePackage --authToken "${FOUNDRY_TOKEN}" --foundryHostname "${host}" \
  --packageName @ontology/sdk --packageVersion 0.0.0 --outputDir ./sdk --ontology "${ontology}" \
  --objectTypes ${object_types} --linkTypes ${link_types} >/dev/null

mkdir -p node_modules/@ontology
ln -sfn ../../sdk/@ontology/sdk node_modules/@ontology/sdk
ln -sfn "${harness}/node_modules" "${functions}/node_modules"
# A symlink does not match the template's `node_modules/` pattern, so exclude it in this clone only.
exclude="$(git -C "${functions}" rev-parse --absolute-git-dir)/info/exclude"
grep -qx 'typescript-functions/node_modules' "${exclude}" 2>/dev/null \
  || echo 'typescript-functions/node_modules' >> "${exclude}"

echo "Harness ready. Type-check with: npm run functions:typecheck"
