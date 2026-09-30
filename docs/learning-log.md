# Learning log

Brief section 12 requires an accurate record of ownership. The categories are: independently implemented,
implemented after explanation, and AI-generated and reviewed.

| Date | Concept | Roshan's contribution | Help received | Category |
|---|---|---|---|---|
| 2026-09-27 | Platform smoke test: OSDK reads, Action writes, AIP calls | Ran each test in the browser. Found the stale description display. | Claude diagnosed the app-scope `ModelNotFound` error and wrote the code changes. | AI-generated and reviewed |
| 2026-09-27 | Lesson 1 data loading | Pasted code from the lesson's sample | Claude found 2 defects in it: a wrong `projectId` field and a `try`/`catch` that hid errors | Implemented after explanation |
| 2026-09-28 | D1 requirements and scope | Chose every option: roles, writes, cost breakdown, scale, non-goals | Options without a recommendation | Independently decided |
| 2026-09-28 | D2 architecture | Accepted the recommended default for all 7 decisions | Options with a recommended default | Decided with a recommendation |
| 2026-09-28 | D3, D4, D5, D11 | Delegated the drafts. Approved D5 and D11. | Claude drafted all 4 records | AI-generated and reviewed |
| 2026-09-28 | `packages/domain`: reconciliation, cost model, causes, eligibility, permissions | Changed the arrangement: Claude implements the domain code, and Roshan makes the architecture decisions | Claude wrote the code and 47 tests, and proved with a deliberate mutation that the hero tests catch a wrong cost rule | AI-generated, review pending |
| 2026-09-28 | Fixtures and the D11 calibration rule | "Continue as you need" | Claude wrote the fixtures, the market file builder, and 27 fixture tests, and proved with a deliberate wrong quote that the calibration check fails | AI-generated, review pending |
| 2026-09-28 | D2 decision 10: domain code in Functions | Chose the recommended option: a functions repository with a generated copy | Options with costs and a recommended default | Decided with a recommendation |
| 2026-09-28 | Object type property spec and Foundry branch | Approved object types through Palantir MCP on a branch | Claude wrote `scripts/lib/ontology.ts`, 26 spec tests, and the payload generator, proved with a dropped mapping that the test fails, and created the types | AI-generated, review pending |
| 2026-09-28 | D6 consistency and D9 access, and 4 gaps in approved records | Answered the 4 gaps with his own reasons, designed a new outreach option (`NOTIFICATION_REQUESTED`), and accepted the recommended default for the other decisions | Claude drafted D6 and D9 with options and costs, found the gaps, and applied the answers to the records, the domain code, and the branch | Decided with a recommendation; gap answers independent |
| 2026-09-29 | First real Actions in Foundry, D6 guard test | Merged the Action proposal, chose to test with the default permission | Claude published 0.1.0, ran the `t1` import, wrote `verify:snapshot` and `test:d6`, and found the 409 conflict behavior | AI-generated, review pending |
| 2026-09-29 | Import and cause confirmation logic, Foundry functions | Chose the setup-file path, namespaces, and the actor source; did the SDK and import steps in the in-platform VS Code | Claude wrote the domain modules (evidence, snapshot, commands), 48 new tests, the 2 functions, the loaders, and the import script | AI-generated, review pending |
| 2026-09-28 | Market price dataset in Foundry, SuperRepo check | "Read docs/progress.md and continue" | Claude added the key and micro-dollar columns, uploaded the dataset through Palantir MCP, checked it with SQL, and probed the Foundry CLI | AI-generated, review pending |

## Next uncertainty

- Roshan has not yet traced 1 cost number through `computeCostLine` by hand. Brief checkpoint E still asks for
  1 small change that Roshan makes himself, for example a new incident cause category.
