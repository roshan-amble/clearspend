# Validation

D8.5 A: what was actually exercised, in 3 kinds kept apart. A claim not listed here is UNMEASURED.

## 1. Unit tests (local, no Foundry)

`npm test`: 232 tests pass on 2026-09-30. `npm run typecheck` and `npm run functions:typecheck` are clean.

| Suite | What it proves |
|---|---|
| `packages/domain` (reconcile, cost, causes, eligibility, commands, evidence) | The pure rules: exact money, C5 ranges, rule-classified causes, D6 replay and guard, D5 decision rules |
| `scripts/snapshot.test.ts` | The snapshot equals the fixture pipeline; any object order gives the same snapshot; leads and eligibility |
| `scripts/ai.test.ts` | AI inputs come from stored evidence, D7.4 limits, and the validators reject invented citations, extra fields, and non-verbatim spans |
| `scripts/domain-copy.test.ts` | The functions repository holds an exact copy of the domain code |
| `apps/web/src/view.test.ts` | The screens only format stored exact values; a quote is never a paid cost |

## 2. Platform observations (real Foundry, dated)

| Date | Command or action | Observed |
|---|---|---|
| 2026-09-29 | `npm run import -- --namespace t1` (functions 0.1.0) | 73 rows in 8 batches; `expansion.csv` again: `REPLAYED`; evidence revision 9 |
| 2026-09-29 | `npm run verify:snapshot -- --namespace t1` | MATCH: Foundry's snapshot equals the local domain result |
| 2026-09-29 | `npm run test:d6 -- --namespace t1` | 7 rounds of 2 parallel confirmations: 1 winner each, the loser HTTP 409; replay, reuse, and stale checks pass |
| 2026-09-30 | Screen B in the browser, Roshan | INC-A4 confirmed on `t2`: revision 10, rice 5.5 (supplier) and 5.7 (route) cents for each meal |
| 2026-09-30 | `npm run test:actor -- --namespace t1` | Another user's ID refused (HTTP 200, validation INVALID), nothing written. Passed again after the Action moved to 0.2.0 |
| 2026-09-30 | `npm run import -- --namespace t2 --later` | Replay row `REPLAYED`, correction `VERSIONED`; revision 12; `verify:snapshot -- --later` MATCH |
| 2026-09-30 | `npm run record:verifications -- --namespace t2` (0.2.0) | 3 PASS results, revisions 13 to 15. Run again: 3 times `REPLAYED` |
| 2026-09-30 | `npm run verify:snapshot -- --namespace t2 --confirmed INC-A4=TRANSPORT_AFTER_HANDOVER --later --leads --verifications field-verifications-initial.csv` | MATCH: all 9 cost lines, including 6 leads with eligibility |
| 2026-09-30 | `npm run ai -- --namespace t2 --job CAUSE --subject t2/harbor-erp:INC-A4` | SUCCEEDED in 4.4 s, 1,045 tokens, 1 `CsCauseProposal` stored |
| 2026-09-30 | `npm run ai` EXTRACTION of SUP-L5 | SUCCEEDED in 3.2 s; the instruction text flagged verbatim, not followed |
| 2026-09-30 | Screen A "Explain this comparison (AI)", Roshan's browser | FAILED, HTTP 403 from the model proxy: the app lacked `api:use-language-models-execute`. Stored as a FAILED run with the reason (D8) |
| 2026-09-30 | The same, after the D9 amendment | SUCCEEDED under the app's sign-in |
| 2026-09-30 | `npm run test:actor -- --namespace t1` (0.2.2) | 4 checks pass: a forged actor is refused by the confirm criterion, the field visit criterion, and, on the AI job Action with no criterion, by the function's Admin API check; the caller's own ID is stored |
| 2026-09-30 | `npm run test:outreach -- --namespace t2` (0.2.2) | French draft SUCCEEDED in 9.7 s; approval stored `NOTIFICATION_REQUESTED`; a second decision on the same draft refused. Notification receipt: UNMEASURED (Roshan to confirm) |
| 2026-09-30 | `npm run import` and `record:verifications` for the demo expansion (0.2.2) | Revision 12, but `verify:snapshot` MISMATCH: 21 lines, expected 9. Cause: `$startsWith` matches words (platform facts). Fixed in 0.2.3 |
| 2026-09-30 | `npm run eval:ai -- --namespace t2` (functions 0.2.1) | 4 cases SUCCEEDED in 2.9 to 8.7 s; all 20 automatic checks pass; no run changed a counter or the snapshot. Output in `docs/ai-evaluation.md` |

## 3. Manual model review (Roshan)

Not done yet. `npm run eval:ai -- --namespace t2` writes the 4 D7.7 cases to `docs/ai-evaluation.md`, each with
its automatic checks and 1 review question. Roshan answers the questions there. Observation so far, for the review:
on INC-A4 the model cited the passed acceptance test at receipt as supporting SUPPLIER. On SUP-L6 it recorded the
marketing guarantee "moisture below 14%" as a TEST_VALUE, although SUP-L6 names no test (a possible polish effect).
On SUP-L1 its only "gap" repeats the whole ration spec, which is not informative.

## 4. Reported by Roshan, not in this repository

These exist on Roshan's other device. Their results cannot be checked from this repository, so they are UNMEASURED
here.

| Date | What Roshan reports | Where it is |
|---|---|---|
| 2026-10-07 | Playwright end-to-end tests | His local copy, kept out of the repository to keep the download small |
| 2026-10-07 | A trace of each path | His own review |
| 2026-10-07 | The consolidated project | His local copy; this repository holds the earlier version |
