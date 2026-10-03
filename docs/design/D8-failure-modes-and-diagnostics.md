# D8: Failure modes and diagnostics

Status: approved by Roshan on 2026-09-30, with the recommended default (A) for every decision. The questions he deferred stay open.
Requirements addressed: brief section 9 (explicit failed state, bounded retry), section 11 (scenarios 9 and 10,
`docs/validation.md`), brief rubric "Failure modes", D1 quality needs 1 and 2, D2 decision 5, D6 client behavior,
D7 states, D9.
Context and constraints: [platform-facts.md](platform-facts.md). Most rows below were observed on this
enrollment on 2026-09-29 and 2026-09-30.

## Rule for every failure

The app shows the failure and what still works. It never shows fixture data, a guessed number, or a stale value
as current. A write that fails writes nothing: Action edits are all-or-nothing (Documented [S6], and observed:
every refused or failed Action left the counters unchanged).

## Failure table

| Failure | Where it comes from | What the reviewer sees | What stays usable | Label |
|---|---|---|---|---|
| Parallel write to the same expansion | HTTP 409 `CONFLICT`, `ObjectChanged` or `ObjectsModifiedConcurrently`. The platform did not re-run the loser. | "Busy: someone else changed this expansion at the same moment. Try again." The typed rationale stays. | Reading; the other person's decision is stored | Verified (7 of 7 rounds) |
| Decision on an older view | `STALE_COMMAND` from the function (D6 guard) | "This expansion changed since you opened it." The page reloads and keeps the draft. A new submit gets a new request ID. | Everything | Verified |
| Retry of a committed request | `REPLAYED` from the function | Treated as success; the page reloads | Everything | Verified |
| Same request ID, other content | `REQUEST_ID_REUSED` | "This is a bug; please report it." | Everything | Verified |
| Submission criteria unmet (wrong actor, wrong group) | HTTP 200 with `validation.result` INVALID and the configured message. Nothing is written. | The configured message, for example "You can only confirm a cause as yourself." | Everything | Verified (REST); browser form Not tested |
| Function error | HTTP 400 `FunctionExecutionFailed`, with the inner message and stack in `parameters` | Error name, inner message, and error ID | Reading | Verified |
| Admin API inside a function under the app's sign-in | Inner 403 | As above | Reading | Verified; fixed by the actor parameter |
| Action unknown right after a merge | HTTP 404 `ActionTypeNotFound` for about 1 minute | Script: "not available yet" | Everything else | Verified |
| Function or model not in the app's scope | `400 QueryRuntimeError ... ModelNotFound`; the Logic preview still passes | Error name and ID | Everything without AI | Verified (smoke test) |
| Model error that can be retried | `LmsRetryableServerError`, `LmsRetryableNetworkError`, rate limits | Run `FAILED` with the kind, if the bounded retry also fails | Everything; the numbers never depended on AI | Documented |
| Model error that cannot be retried | `LmsContextWindowExceeded`, `PermissionDenied` | Run `FAILED` with the kind | As above | Documented |
| Model output fails validation (D7.3) | Domain validator | Run `INVALID` with the reasons; no proposal is shown as valid | As above | Not tested yet |
| Snapshot written before function 0.1.1 | `purchasesJson`, `incidentsJson`, `perMealJson` are empty | "Not stored (before 0.1.1)". Never recomputed in the browser. | The stored exact values | Verified on screen |
| Load failure in the browser | Any read error | "Could not load … from Foundry" and a Try again button. No fixture fallback. | Nothing on that screen | Verified (code path) |
| Import file invalid | Domain validation in the script, before any upload | Row number and field | Earlier batches stay | Verified (tests) |
| Import rows that name unknown IDs | Import plan | Counted as unmatched in the `CsImportBatch` report, not stored | The batch's other rows | Verified |
| `FOUNDRY_TOKEN` expired (2026-10-16) | HTTP 401 in scripts and MCP | "Set FOUNDRY_TOKEN" or the 401 | The browser app (own sign-in) | Documented |
| Notification not delivered (D6.6) | Foundry gives the caller no delivery status | `NOTIFICATION_REQUESTED` only; never "sent" | Everything | Documented |

## Decisions for Roshan

**D8.1 Where the operator finds a failure.**
- **A (recommended):** functions log with OpenTelemetry to Foundry's execution history, and the app shows the error
  ID from each failed call, so the operator can find the run. Cost: the operator uses Foundry, not the app.
- B: a `CsErrorLog` object type. Cost: a failed Action writes nothing, so it could not log its own failure anyway.

**D8.2 Automatic retries in the browser.**
- **A (recommended):** none. The person clicks again; a click after an unknown network result sends the same
  request ID. Cost: 1 more click after a conflict.
- B: retry once on 409. Cost: 2 messages for 1 click, and D6 says the app never retries by itself.

**D8.3 Scripts right after a merge.**
- **A (recommended):** retry `ActionTypeNotFound` for up to 2 minutes, then fail with the error. Cost: a slower
  failure when the name is really wrong.
- B: fail at once. Cost: a manual re-run after every merge.

**D8.4 Model errors.**
- **A (recommended):** 1 retry after 2 seconds for the retryable kinds, inside the function, then a `FAILED` run
  with the kind. Cost: a slow failure takes about twice as long.
- B: no retry. Cost: a short rate limit fails a run that would have passed.

**D8.5 Recording observed results (brief section 11).**
- **A (recommended):** `docs/validation.md` now, with 3 kinds kept apart: unit tests, platform observations (the
  runs above, with dates and commands), and manual model review. Cost: about 30 minutes.
- B: write it at the end of Phase 4. Cost: the details of today's observations may be lost.

## Consequences and accepted risks

- An error ID and inner message are shown to the signed-in user. They contain no token or secret, but they can
  contain internal names such as function paths.
- The browser's handling of a submission-criteria refusal through the OSDK is Not tested; the REST path is.

## Amendment, 2026-10-02: demo reset for 1 country (P12)

- `cs-reset-country-demo` (function `csResetCountryDemo`) removes, for 1 country: its `CsInvestigation` objects, the
  `CsInvestigatorBusy` blocks whose `investigationId` is one of them, the `CsAiRun` objects of its expansion with job
  RANKING or BOOKING, and its `CsSupplierBid` objects. It touches no evidence, snapshot, cost line, decision, incident,
  or cause proposal, and no other country. An investigator's schedule version is not lowered.
- It is the only Action that deletes, and it is an exception to "a run is stored, never replaced" (D7, D8): Roshan
  chose it so that a rehearsed click-through can be shown again. It is a rehearsal tool, not a product feature: no app
  SDK holds it, so neither app can call it; `npm run demo:reset -- --country KEN --apply` calls it with the person's
  own token, and the function refuses an actorUserId that is not the signed-in user.
- Without `--apply` the script only lists what it would remove.
- Not covered: a confirmed incident cause or a sourcing decision. Those change the cost history and cannot be reset;
  rehearse them on another country.

## Help received

Claude drafted this record, with options and a recommended default for each decision. Roshan decides.
