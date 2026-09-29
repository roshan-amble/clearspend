# Progress

Updated: 2026-09-28. The onsite is on 2026-10-05.

## Where the project is

| Phase (brief section 13) | Status |
|---|---|
| Phase 0: access, smoke test, region, platform facts | Done. The smoke test passed on 2026-09-27. Region: Androy. |
| Design records | D1, D2, D3, D4, D5, and D11 approved. D2 decision 10 added. D11 has 2 data-driven amendments for Roshan to see. D6 and D9 approved. D3, D4, D5 amended. D7, D8, D10 not started. |
| Phase 1: pure domain core and fixtures | Done. `packages/domain` and `data/fixtures`: 74 tests pass, type check clean, 2 mutation checks done. |
| Phase 2: Ontology and a connected screen | Started. 15 object types on a Foundry branch. D6 and D9 approved, so the design gate for Actions is open. |
| Phase 3 to 6 | Not started |

## Done in Phase 1

- `packages/domain`: reconciliation, cost model, cause rules, eligibility, outreach, permissions, exact arithmetic.
- `data/fixtures`: the brief's story as files, recalibrated by the D11 price rule. See D11 "Amendment".
- `data/public/androy-market-prices.csv`: 1,585 real retail rows, Androy, 4 series, from 2024-09. Built by
  `npm run fixtures:market` from the HDX download.
- `scripts/fixtures.test.ts`: referential integrity, the calibration rule for every order and quote, quote text
  against quote field, and the story numbers.

## Done in Phase 2

- 2026-09-28: Palantir MCP works in this repository with `FOUNDRY_TOKEN`.
- 2026-09-28: SuperRepo check. The enrollment serves the Foundry CLI, but the binary is not notarized, and
  `foundry login` stores credentials on disk. Claude did not install or run it. See `platform-facts.md`.
- 2026-09-28: `npm run fixtures:market` now adds `price_id` (`marketId:series:date`) and `usd_price_micros`
  (exact, from `parseDecimalScaled`). The dataset `cs_market_price` holds the 1,585 rows. A SQL check in
  Foundry matched the local file: row counts, unique IDs, dates, and micro-dollar sums for each series.
- 2026-09-28: Roshan chose D2 decision 10: a Foundry TypeScript v2 functions repository with a generated,
  digest-checked copy of `packages/domain`, and object types through Palantir MCP on a branch.
- 2026-09-28: `scripts/lib/ontology.ts` lists every property of the 15 Phase 2 types. `scripts/ontology.test.ts`
  (26 tests) checks the names and the fixture field mapping. `npm run ontology:payloads` prints the MCP inputs.
  See the implementation notes in D3.
- 2026-09-28: the 15 Phase 2 object types exist on the global branch `clearspend-phase-2-ontology`, each with
  an empty backing dataset except `CsMarketPrice`. A branch search found all 15. None is on Main.
- 2026-09-28: Claude drafted D6 (7 decisions) and D9 (4 decisions), each with options and a recommended default.
- 2026-09-28: Roshan answered the 4 gaps and chose all recommended options, with his own option D for D6.6
  (`NOTIFICATION_REQUESTED`). Claude amended D3, D4, and D5, wrote `docs/design/review-log.md`, and changed
  `packages/domain`: the `EVIDENCE_IMPORTER` role with `IMPORT_EVIDENCE`, and the outreach states. 101 tests pass.
  A mutation check (the manager allowed to import) failed 2 tests, as it should.
- 2026-09-28: the branch has `CsDecision.request_digest` (key = `requestId`), `CsImportBatch` keyed
  `expansionId:fileDigest`, and `CsCostSnapshot.market_data_as_of`. A branch search found no `requestId` left.

## Foundry resources

All identifiers are in [foundry-resources.md](foundry-resources.md).

## Next steps

1. Create the link types between types without versions (see D3 implementation notes).
2. Run the smallest concurrency test of D6 on the enrollment.
3. Create the TypeScript v2 functions repository and the sync script of D2 decision 10.
4. Build the import Action `csImportEvidenceBatch` (D4), and import `data/fixtures`.
5. Add a replay row to 1 fixture batch. The brief requires a deliberate replay in an import batch.

## Open questions

- D7, deferred by Roshan: what "AI-managed dashboard" means, and the third quality need. Ask him. Never choose.
- D2 platform checks: whether an AIP Logic function can back an Action that writes a proposal object; whether
  website hosting and notifications work on the dev tier; whether Roshan can create groups (D9).

## Debt

- D2 decision 6 says a script uploads reference data. `cs_market_price` was uploaded once through Palantir MCP.
  The import script must take over this upload before a demo reset.

## Git

- Local identity `Roshan Amble <rosh.daboss@gmail.com>`. No remote. Roshan asked for 3 commits by phase on 2026-09-28.
