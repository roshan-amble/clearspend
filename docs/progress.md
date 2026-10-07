# Progress

Updated: 2026-10-07. The onsite was on 2026-10-05, and Roshan has submitted the Build with AIP video.

**This repository is not the latest version.** Roshan consolidated the project locally on another device, and his
Playwright end-to-end tests stay there (step 32).

## Where the project is

| Phase (brief section 13) | Status |
|---|---|
| Phase 0: access, smoke test, region, platform facts | Done. The smoke test passed on 2026-09-27. Region: Androy. |
| Design records | D1, D2, D3, D4, D5, and D11 approved. D2 decision 10 added. D11 has 2 data-driven amendments for Roshan to see. D6 and D9 approved. D3, D4, D5 amended. D7, D8, D10 not started. |
| Phase 1: pure domain core and fixtures | Done. `packages/domain` and `data/fixtures`: 74 tests pass, type check clean, 2 mutation checks done. |
| Phase 2: Ontology and a connected screen | Exit condition met on 2026-09-30: Roshan confirmed INC-A4 from Screen B in the browser, with real persistence and a verified revision guard. Checkpoint C's trace: Roshan traced each path himself (step 32). |
| Phase 3: AI boundary | Deployed (2026-09-30). All 4 jobs run on GPT-4o from scripts and the browser. `eval:ai`: 20 automatic checks pass. Waiting: Roshan's manual review in `docs/ai-evaluation.md` (Checkpoint D). |
| Phase 4: field visits, verification, sourcing decision, outreach, Screens A and C | Deployed (functions 0.2.3, SDK 0.4.0). Demo namespace `demo` imported and verified (revision 12, MATCH). UI rebuilt (UI1 to UI5, step 18), waiting on merge 1 (step 19). |
| Phase 5: optional extensions | Not recorded here |
| Phase 6: explanation, recording, and handoff | The full video is submitted (Roshan, 2026-10-07). |

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
- 2026-09-28: 12 one-to-many link types on the branch (`LINK_TYPES` in `scripts/lib/ontology.ts`, 13 more spec
  tests). IDs are in `docs/foundry-resources.md`.
- 2026-09-28: Roshan created `clearspend-functions` (TypeScript v2). Claude cloned it with Palantir MCP. The clone put
  the token in `.git/config` and the macOS keychain. Claude removed both and set a helper that reads `FOUNDRY_TOKEN`.
  See `platform-facts.md`.
- 2026-09-28: Roshan approved running `rune` 0.98.0 (unnotarized, like the Foundry CLI). It is in the functions
  repository folder, git-ignored. Claude checks `.rune/` for the token after each run.
- 2026-09-28: `npm run domain:sync` writes the 13 domain source files into `clearspend-functions`, in
  `typescript-functions/src/domain/`, each with a "GENERATED" header, plus `SOURCE.json` with their SHA-256.
  `scripts/domain-copy.test.ts` (15 tests) fails when the copy differs from the source, and skips when no clone
  exists. Checked: a hand edit in the copy fails the test, and the sync refuses a hand-added file. The copy
  type-checks with the template's compiler settings. The copy is not committed or pushed to Foundry yet.
- 2026-09-28: the branch has `CsDecision.request_digest` (key = `requestId`), `CsImportBatch` keyed
  `expansionId:fileDigest`, and `CsCostSnapshot.market_data_as_of`. A branch search found no `requestId` left.

## Foundry resources

All identifiers are in [foundry-resources.md](foundry-resources.md).

## Next steps

1. Done: the proposal is merged.
2. Done: the 15 types and 12 links are imported into `clearspend-functions` (commit `3bf5a9d`, by Roshan in the
   in-platform VS Code). `rune` still fails locally.
3. Roshan chose (2026-09-29): Claude pushes to `clearspend-functions`, and Foundry's checks compile and test.
   First push: commit `99dc3c4`, the domain copy only. Foundry's checks passed in 83 seconds.
   Local type-check without `rune`: `npm run functions:harness` (generates `@ontology/sdk` with the public generator
   into the git-ignored `.functions-harness/`), then `npm run functions:typecheck`.
4. Written, not pushed (2026-09-29): the functions `csImportEvidenceBatch` and `csConfirmIncidentCause` in
   `clearspend-functions`, with shared loaders in `src/clearspend/`. The rules are pure and tested in
   `packages/domain`: `evidence.ts` (validation, canonical JSON, D4 identity plan), `snapshot.ts` (active set,
   reconciliation, cost lines, market signal, storage records), `commands.ts` (D6 replay check, guard, D5 rules).
   A parity test requires the snapshot's cost lines to equal the fixture pipeline's. `npm run import` applies the
   fixtures through the Action, with `--namespace t1` for the test expansion `EXP-ANDROY-2026-T1`.
5. Done (2026-09-29): Roshan added `@osdk/foundry.admin` (commit `27eb608`). Claude pushed the functions (commit
   `00765af`, checks passed in 86 seconds), tagged `0.1.0` (publish build succeeded in about 2 minutes), and
   created the 2 Action types on the branch `clearspend-phase-2-actions`. Proposal
   `ri.branch..proposal.a95473d5-2a0e-4b6b-96a6-f1c2a85c9559` is open.
6. Done (2026-09-29): Roshan merged the Actions. `npm run import -- --namespace t1` stored 73 rows in 8 batches
   (`expansion.csv` again: `REPLAYED`), evidence revision 9. `npm run verify:snapshot` found Foundry's snapshot equal
   to the local domain result. `npm run test:d6` passed 7 rounds plus the replay, reuse, and stale checks (see D6).
   INC-A4 is confirmed in `t1`, revision 16: rice 5.5 (supplier) and 5.7 (route) cents for each meal.
   The Action types still allow everyone in the organization until Roshan sets the D9 group criteria.
7. In progress (2026-09-30): Screen B. Roshan merged 3 snapshot properties for it and created the Developer Console
   app. Claude published 0.1.1 (sorted snapshots, purchase findings, incident statuses, per-meal costs) and opened
   the proposal that points the Actions at it. `apps/web` (Vite, React, OSDK) type-checks against a locally
   generated SDK. Roshan merged it and set up the app's resources. Claude generated the app SDK `@clearspend/sdk`
   0.1.0 (15 object types, 12 links, 1 Action: the import Action is not in the app's scope, D9), connected
   `apps/web` (root `.npmrc` reads `${FOUNDRY_TOKEN}`), and imported namespace `t2` through 0.1.1: snapshot,
   purchases, incidents, and per-meal costs match the local result. The dev server runs on localhost:8080.
   Roshan signed in, read Screen B for `t2`, and confirmed INC-A4 from the screen (2026-09-30): revision 10, rice
   supplier view 5.5 and route view 5.7, 1 decision by Roshan at revision 9. The browser needed function 0.1.3:
   the Admin API is denied under the app's sign-in, so the actor is a parameter checked by a submission criterion
   (`npm run test:actor` passed).
8. Deferred by Roshan on 2026-09-30 ("we are very late, continue implementation"): Checkpoint C. Roshan traces a click from React through the OSDK and the Action function to the
   stored decision, states the Foundry guarantee D6 depends on, and answers the late field verification question.
   Still open: the D9 groups, and the demo import without a namespace.
9. Done (2026-09-30): the later batches of scenario 5 (`data/fixtures/later/`) hold a deliberate replay and a
   correction. Applied to `t2` (revision 12), `verify:snapshot -- --later` MATCH.
10. Written, committed locally in `clearspend-functions`, not pushed (2026-09-30), commits `0cdd459` and `60e62e9`:
    - `csSelectFieldVisit` and `csRecordSourcingDecision`: decisions under the D6 guard, raise `stateVersion` only.
    - `csRecordFieldVerification`: evidence; replay check only; raises the revision and writes the snapshot; a
      source's verification ID can be recorded once.
    - `csStartAiJob` (D7.2 A, 1 Action for 3 jobs): builds the input from stored objects, calls GPT-4o through the
      AIP proxy (`@osdk/language-models`, alias `gpt4o`), validates in domain code, writes 1 `CsAiRun` and, for a
      valid cause, 1 `CsCauseProposal`. It writes a `FAILED` run on a model error, and raises no counter.
    - The snapshot now includes lead lines (profiles), eligibility from field verifications, and exact meals per
      dollar. The import Action passes new profiles to the snapshot.
    - Local type-check passes. Domain and script tests: 226 pass.
11. Written, not run (2026-09-30): `apps/web` Screen A (`/expansions/:id`: comparison, market pressure, AI
    explanation, sourcing decision, history) and Screen C (`/expansions/:id/leads`: leads, profile text,
    extracted claims, field visit selection, verification form); Screen B gains the AI cause proposal. They need
    `@clearspend/sdk` 0.3.0 with the new types and Actions, so the web type-check fails until then.
    Scripts: `npm run record:verifications -- --namespace t2 [--file field-verifications-later.csv]` and
    `npm run ai -- --namespace t2 --job CAUSE --subject t2/harbor-erp:INC-A4`.
12. Blocker, Roshan: in the in-platform VS Code of `clearspend-functions`, Resource imports: add Cs AI Run,
    Cs Field Verification, Cs Outreach Message (Ontology SDK tab) and GPT-4o with alias `gpt4o` (Platform tab,
    Add, Models), then commit. Then Claude pushes, tags 0.2.0, creates 4 Action types on a branch and moves the 2
    existing ones to 0.2.0; Roshan merges and sets the `actorUserId` criterion on the 4 new Actions; Claude
    publishes SDK 0.3.0; Roshan accepts the new resources in Developer Console.
13. Done (2026-09-30): the outreach draft and decision (`cs-decide-outreach`, notification to Roshan only), the D7.7
    evaluation (`npm run eval:ai`, output in `docs/ai-evaluation.md`), `docs/validation.md` (D8.5).
14. Done (2026-09-30): D9 amended twice by Roshan: the app requests `api:use-language-models-execute` and
    `api:admin-read`; every function checks the actor itself (`npm run test:actor` passes 4 checks).
15. Bug found and fixed (0.2.3): OSDK `$startsWith` matches words, so the bare `EXP-ANDROY-2026` expansion got
    the t1 and t2 lead profiles in its snapshots. It stays as a test artifact. The demo runs in namespace `demo`
    (`EXP-ANDROY-2026-DEMO`), which the app opens by default.
16. Superseded by 17 to 19: Roshan runs the hero story on `demo` in the browser (runbook in the conversation of 2026-09-30); then
    Checkpoint D (AI review), Phase 4 cleanup (dead controls, unused packages), and Phase 6.
17. Decided (Roshan, 2026-09-30, "go with recommendations and continue building"): UI1 A (React with the POC's
    tokens and ECharts, dark default, gray alternative), UI3 A (development-only data studio, writes only through
    Actions with a dry run; the import Action joins the app scope, D9 amendment), UI4 A (edit-only target price on
    `CsExpansionCommodity` and `cs-set-commodity-target`; display only, D3 and D11 amendments), UI5 A (query
    function `csPriceHistory`, D2 amendment). Recorded in `design/review-log.md`.
18. Written (2026-09-30), not deployed: `packages/domain/src/history.ts` (`priceHistory`), `sourcerow.ts`
    (`sourceRowOf`, the inverse of `parseEvidenceRows`), and `namespace.ts` (moved from scripts); the functions
    `csPriceHistory` and `csSetCommodityTarget` in `clearspend-functions` (they type-check only after merge 1). Tests:
    246 pass.
    The web app is rebuilt in `apps/web/src/pages/`: Overview, Prices, Incidents, Leads, Studio (DEV only), and
    SystemMap, with `Shell`, `theme.css`, `charts.tsx`, and 1 shared loader (`data/expansion.tsx`). Web type-check
    and production build pass; the production bundle has no studio and no fixtures. Not yet seen in a browser.
    The price charts, target form, and studio writes show "waiting" until the SDK has `csPriceHistory`,
    `cs-set-commodity-target`, and `cs-import-evidence-batch`.
19. Merge 1 (target fields), done:
    https://roshan-amble.usw-3.palantirfoundry.com/workspace/developer-branching/proposal/ri.branch..proposal.0dfe9099-96a1-42c5-8bfc-d9b6d34a5271
    Merged (2026-09-30). Claude regenerated the harness (functions type-check passes) and pushed commit `9b68a20`.
    Done: tag 0.3.0; `cs-set-commodity-target` created on 0.3.0; proposal 2 open
    (`ri.branch..proposal.00c54b4a-fb83-4bc5-93fb-6e36677cb5b6`). App SDK 0.5.0 published and installed: the target
    fields and the import Action (the studio can apply). `csPriceHistory` needed a query API name to be callable
    (0.3.1, platform facts); a real run on `demo` returns HTTP 200. The 7 existing Actions stay on
    0.2.2 and 0.2.3: none needs a behavior change, and it is not known whether an MCP update keeps the notification
    that Roshan set by hand on `cs-decide-outreach`.
    Done (2026-09-30): Roshan merged proposal 2 and added `csPriceHistory` to the app. App SDK 0.6.0 (the Action
    and the query) is installed; the app calls both through typed SDK functions. `npm run test:target -- --namespace
    t2` passed 8 real checks: target stored, revision unchanged, state version +1, REPLAYED, STALE_COMMAND, the
    decision, and the target in `csPriceHistory`.
20. Done (2026-09-30): Roshan's review ("sections need titles, more space, too cluttered"): every page is now
    numbered sections with a title and 1 plain sentence, the header shows the page name and its question, and the
    design-record codes left the visible text. `docs/demo-script.md` is the click-through. The studio's "Fresh copy
    of the demo" ran in a headless browser into namespace `uitest`: revision 12, 9 files, 64 rows, 3 field visits,
    `verify:snapshot` MATCH.
21. Portfolio (Roshan, 2026-10-01, decisions P1 to P4 in the review log): 22 country programs, meals and nutrition,
    recommendations, investigations with scheduling, and a clickable map. Done: domain modules `portfolio.ts`,
    `portfolio-view.ts`, `schedule.ts` with tests; `npm run portfolio:generate` (deterministic data), `portfolio:upload`
    (reference datasets and market prices), `portfolio:import` (all 22 through the real Actions), `portfolio:check
    -- --foundry` (MATCH: every stored cost line equals the local engine); 5 datasets and 5 object types on a branch;
    functions `csPortfolio`, `csCountry`, `csScheduleOptions`, `csTagInvestigation`, `csBookInvestigation` written; web
    pages Portfolio (map), Country, Investigations written.
    Deployed (2026-10-01): Roshan merged the types and the 2 investigation Actions and added the 3 queries to the app;
    functions 0.4.0 (commit `724bdb2`), app SDK 0.7.0. Real runs: `csPortfolio` and `csCountry` return all 22
    programs; `npm run test:investigations` passed 11 checks on Laos (tag, replay, duplicate refused, options, booking,
    busy block, booking replay, stale schedule refused, double booking refused). It left 1 scheduled and 1 open
    investigation in Laos. Pages checked in a headless browser: Portfolio (map), Madagascar, Investigations.
22. Done (2026-10-01, Roshan: "where … do you actually see individual local suppliers and their bids/market costs?
    … how much we can get from them without meaningfully inflating local prices"): Sourcing options on the Country
    page and on each investigation: every bid and paid price against the WFP median, capacity (confirmed or claimed),
    and `localSourcingPlan` (10% of the local market, cheapest local bids first, rest imported; D11 amendment).
    Functions 0.4.1. Madagascar re-keyed to `EXP-MDG-ANDROY-2027` with small beans and oil markets; its bean bids now
    sit near WFP's real median (3 profiles VERSIONED). Investigator names are now per country, without repeats.
23. Done (2026-10-01, Roshan: "WFP is not exclusively for students, fix that"; decisions P5 and P6): each country
    now runs school meals, general food distribution, and nutrition support, with caseloads. `CsMeal` has
    `activity`, `beneficiary_group`, and `beneficiaries` (Roshan merged the proposal); each ration's nutrition is
    measured against its own group (30% of a child's need for a school meal, 100% of the Sphere planning figures for
    a general ration, half of a young child's need for Super Cereal). People reached counts each activity once.
    Functions 0.4.2 (commit `204896a`), app SDK 0.8.0. The name Harbor Meals stays.
    Functions 0.4.3 (commit `ff68b2a`): a nutrition suggestion adds at most 100 g of a food (30 ml of oil) to a
    serving; past that, it names a fortified food or micronutrient powder (Madagascar's general ration needed
    "322 g of beans" for iron). The ingredient table fits 4 rations without scrolling.
24. Done except the supplier site's first run (2026-10-01, decisions P7 to P11): a supplier list front and center, AI
    in investigations, and a supplier site.
    - Supplier list on the Country page (under the tiles, `?food=RICE` opens a food) and on each investigation:
      what each supplier could supply without pushing local prices up, the net cost against what we pay or against
      importing, the cheapest-first plan, Investigate on every row (`offers.ts`, D11 amendment).
    - AI jobs RANKING (which investigations first; the rules follow it) and BOOKING (who to book among the free trips)
      in `cs-start-ai-job` (D7 amendment). Real runs through the Action: RANKING on Kenya rice SUCCEEDED in 4.0 s,
      BOOKING on the Mozambique beans survey SUCCEEDED in 3.8 s.
    - `CsSupplierBid`, `cs-submit-supplier-bid`, `cs-review-supplier-bid`; `cs-tag-investigation` accepts an accepted
      offer. `npm run test:offers` passed 12 real checks on Zambia (submit, replay, a price of 0 refused, the review
      preview, accept, replay, a flipped decision refused, the lead in the list, the paid cost unchanged, tagging).
      It left 1 accepted test offer and 1 open test investigation in Zambia.
    - Roshan merged 3 proposals and created the Developer Console app "ClearSpend Suppliers" (client ID in
      `apps/supplier/.env.development`). Functions 0.6.0 (commit `789aff9`), main app SDK 0.10.0, supplier SDK
      `@clearspend-suppliers/sdk` 0.1.0.
    - `apps/supplier` (port 8081, `npm run dev:supplier`): the offer form and a development-only scope check.
    - Functions 0.6.1 (commit `8da6730`): an empty ranking that says why is valid; a ranking with nothing left to
      rank is refused (found on Mozambique beans, where the market survey was already open).
    - Test data left by the real runs: Laos (1 accepted test offer of rice and its open investigation), Zambia (the
      same for beans), 2 RANKING and 2 BOOKING runs.
    Next for Roshan: open http://localhost:8081, sign in, send 1 offer, and press "What can this site read?".
    UNMEASURED until then: sign-in to the supplier app, a submit from the site, and the scope check. 2 open risks:
    the supplier app's allowed operations have no Security (Admin) read, which the submit function uses to know the
    signed-in user; and its scope and SDK include `CsSupplierBid`, so the site's token may be able to read every offer.
    Note (2026-10-01): part of this step was done in a session whose conversation was lost; its commits, its test
    data, and its notes in `docs/foundry-resources.md` were kept and reconciled with the source (`domain:sync` shows
    no difference from the deployed 0.6.1).
25. Done (2026-10-01, Roshan's review of the Madagascar page): a new program shows 0 people reached and its caseload
    as planned; a "First step: choose a supplier for each food" card leads the page; each food's supplier list
    compares local with international (3 boxes and a table grouped by route). Functions 0.6.2 (commit `122c123`),
    queries only. Open: Madagascar has no international supplier or lead in its data, so its international row is
    WFP's import price as a reference; adding generated international leads is Roshan's call.
26. Done (2026-10-02, P12): a demo reset for 1 country, so a rehearsed click-through can be shown again.
    `csResetCountryDemo` (functions 0.6.3) and `cs-reset-country-demo` (Roshan merged the proposal).
    `npm run demo:reset -- --country KEN` lists what it would remove; `--apply` removes it. Measured on Kenya: it
    removed Roshan's beans investigation of SUP-L2, its calendar block, and 3 AI runs (5 records); the page shows
    Investigate and "Rank with AI" again; Laos, Mozambique, and Zambia were untouched. Test data still stored:
    Laos and Zambia (1 accepted test offer and its open investigation each).
27. Done (2026-10-02, P13 to P15): the workflow redesign. Home is a worklist (15 tasks across 8 programs on the day)
    over the map and 1 line for each program. A program page is a short header, 4 tabs (Sourcing, Rations, Incidents,
    Prices), and the sourcing pipeline: 1 row for each food with its stage and next action. `/countries/:iso3/foods/
    :commodity` is the 1 screen for the decision on 1 food: stage, next step, local against international, the
    suppliers, and what to investigate first. The Investigations page lost its duplicate supplier list. The Madagascar
    page went from about 5,000 pixels to 1 screen. Domain `workflow.ts` (foodStep, countryTasks, sortTasks) with
    tests; functions 0.7.0 and 0.7.1 (queries only). Laos and Zambia test data cleared. `docs/demo-script.md` is
    rewritten for this flow.
    Kenya holds Roshan's second beans rehearsal (1 scheduled investigation, 2 AI runs): reset it before the demo.
    Reversed the same day: Roshan preferred the earlier home screen. Home is again the program map, then the country
    cards (the 5 tiles became 1 line above the map); the worklist is computed and shown nowhere.
28. Done (2026-10-02, P16): the role of AI on the sourcing screen. Code names the next supplier to check
    (`foodStep().check`); AI writes the visit brief from the supplier's own text (BRIEF replaces RANKING); every net
    cost on a food's screen compares with 1 stated price. Functions 0.8.0 (commit `6a4d2d0`); Roshan merged the
    proposal that moved `cs-start-ai-job` and `cs-reset-country-demo` to it. Real run through the Action on Mali
    sorghum SUP-L1: SUCCEEDED in 6.0 s, 3 claims quoted verbatim from a French profile, 5 gaps, 5 checks; RANKING is
    refused. The brief panel was checked on screen (`?investigate=<supplier>` opens it). 1 BRIEF run is stored in
    Mali.
29. Done (2026-10-02, P17 to P19): 5 pages for each country, after the heat map. Built and checked on screen
    with live data (Kenya): Ingredients (who supplies each, what we pay, the lowest available price, how far over it
    we pay, which rations use it, and 1 chart: what we paid against the lowest market price), Suppliers (the 10% rule
    figures, the next supplier to check, local against international, who we use for how much, offers to review, the
    visit brief), Incidents (by supplier), AI analysis (the steps in 3 groups, ordered and explained by AI),
    Investigations (this country only, booking and the brief). The heat map counts recommended actions. Functions
    0.9.0 (commit `0e49ec1`) and 0.9.1 (commit `834978c`); dry runs of ANALYSIS SUCCEEDED on Kenya and Madagascar.
    Roshan merged the proposal that moved `cs-start-ai-job` and `cs-reset-country-demo` to 0.9.0. Real run through
    the Action on Mali: ANALYSIS SUCCEEDED in 9.6 s, 5 steps ordered and explained, checked on screen. 1 ANALYSIS
    run is stored in Mali. Kenya holds Roshan's new rehearsal data: reset it before the demo.
30. Done (2026-10-02, P20): international suppliers. Madagascar has 7 generated international suppliers (imported
    through the real Action; parity MATCH). The plan buys locally up to the 10% line, then from international offers
    cheapest first (Madagascar rice: 40,000 kg local, 300,000 kg SUP-I1, 151,960 kg SUP-I2; −$13,260 a month). The
    Suppliers page has a selector (all, local, international) and names the next supplier to check on each route;
    the AI analysis steps split each such food into a local and an international step. Functions 0.10.0 and 0.10.1.
    Roshan merged the proposal that moved `cs-start-ai-job` and `cs-reset-country-demo` to 0.10.1. Real runs on
    Madagascar: ANALYSIS SUCCEEDED in 7.3 s (9 steps, international first); BRIEF on SUP-I1 SUCCEEDED in 8.4 s and
    flagged that its price is CIF Toliara, inland transport extra. Madagascar was then reset (clean for the demo).
31. Next: Roshan runs `docs/demo-script.md` (portfolio flow) in the browser; then Checkpoint D (AI review), Phase 4
    cleanup, and Phase 6.
32. Done, reported by Roshan on 2026-10-07 (the work is on his other device, not in this repository):
    - The full Build with AIP video is submitted.
    - He traced each path himself.
    - He generated Playwright end-to-end tests. They stay local so the repository download stays small.
    - He consolidated the project locally. This repository holds the earlier version.
    - After his 2-hour architectural review, the learning log's AI-generated rows read "AI-generated and reviewed".
    Not recorded here: Checkpoint D (the manual AI review in `docs/ai-evaluation.md`) and Checkpoint E (1 small
    change that Roshan makes himself).

## Open questions

- D7, deferred by Roshan: what "AI-managed dashboard" means, and the third quality need. Ask him. Never choose.
- D2 platform checks: whether an AIP Logic function can back an Action that writes a proposal object; whether
  website hosting and notifications work on the dev tier; whether Roshan can create groups (D9).

## Debt

- `CsAiRun.logicFunctionRid` and `logicFunctionVersion` keep their names from D3, but under D7.1 B they hold the
  function name `csStartAiJob` and the domain `RULES_VERSION` (which covers the prompts and validators).
- A field visit selection is shown from `SELECT_FIELD_VISIT` decisions. The stored snapshot never says
  `SELECTED_FOR_VISIT`, so a second selection of the same lead is allowed.
- Calling the model under the app's ontology-only OAuth scopes is not tested (D7). If it fails, the app needs
  another scope or the AI job must be started by a script.

- D2 decision 6 says a script uploads reference data. `cs_market_price` was uploaded once through Palantir MCP.
  The import script must take over this upload before a demo reset.

## Git

- Local identity `Roshan Amble <rosh.daboss@gmail.com>`. No remote. Roshan asked for 3 commits by phase on 2026-09-28.
