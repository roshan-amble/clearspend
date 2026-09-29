# D6: Consistency, concurrency, and retries

Status: approved by Roshan on 2026-09-28. He chose A for D6.1 to D6.5 and D6.7, and his own option D for D6.6. See [review-log.md](review-log.md).
Requirements addressed: brief section 8 (invariants I1 to I10 and the review event table), D3 principle 4,
D4 revision effect, D5. Appendix A.4 is the rubric.
Context and constraints: [platform-facts.md](platform-facts.md), and the Foundry page "Consistency and
isolation" [S6], read by Claude on 2026-09-28.

## Platform guarantees this design relies on

| Guarantee | Label |
|---|---|
| An Action's Ontology edits commit as 1 all-or-nothing batch. Notifications and webhooks are outside that batch. | Documented |
| New Action types with batched writes use snapshot isolation. All reads come from 1 point in time, taken at the start. | Documented |
| Conflicts are checked per written object, not per property. If 2 Actions write the same object, 1 fails and its whole edit is discarded. | Documented |
| Objects that an Action only reads cause no conflict. 2 Actions that read the same state and write different objects can both commit ("write skew"). | Documented |
| On a transient error, including a conflict, the platform re-runs the Action from the start, up to 5 times. By default it does not retry Actions with external calls. The mode is set for each Action type. | Documented |
| A rebuild of a backing dataset can cause transient conflicts, even on objects the rebuild does not change. | Documented |
| A notification is sent after all edits are applied. The Action caller gets no delivery status. | Documented |
| An Action edits at most 10,000 objects and 50 object types. | Documented |
| All of the above on this enrollment. Whether a function can read the ID of the user who applied the Action. Whether a side effect fires when an Action commits 0 edits. | Not tested |

## Mechanism

1. **The anchor.** Every evidence write and every decision also writes `CsExpansion`. Conflicts are per
   written object, so 2 such writes that start from the same state cannot both commit. This removes write skew.
2. **2 counters on `CsExpansion`.**
   - `evidenceRevision` goes up by 1 when the numbers can change: an evidence batch with at least 1 new row or
     version, a field verification, or a cause confirmation (brief section 8).
   - `stateVersion` goes up by 1 on every write to the anchor, including every decision.
3. **The guard.** A decision command carries `expectedEvidenceRevision` and `expectedStateVersion` from the
   view that the person saw. If a loaded value differs, the function throws `STALE_COMMAND` and writes nothing.
4. **Request identity.** The browser creates a `requestId` (a UUID) when a form opens. The function computes
   `requestDigest`, the SHA-256 of the canonical command, including the expected counters. The object that
   the command creates has the `requestId` as its primary key.
5. **Order of checks.** Submission criteria (D9) run before the function. Then: replay check, guard,
   `packages/domain` rules, edits. The replay check comes first. After a first commit the counters have
   moved, so a retry would otherwise look stale.
6. **Snapshot.** An Action that raises `evidenceRevision` also writes the new `CsCostSnapshot` (D6.2).

## Client behavior

| Result | What the browser does |
|---|---|
| Success | Reloads the expansion and shows the new state. |
| `REPLAYED`: same `requestId`, same digest | Treats it as success, and loads the object whose key is the `requestId`. |
| `REPLAYED` from the import script: same `expansionId:fileDigest` | Reports the file as already imported. Nothing changed. |
| `REQUEST_ID_REUSED`: same `requestId`, other digest | Shows an error. It is a bug, never a user mistake. |
| `STALE_COMMAND` | Shows "This expansion changed since you opened it." Keeps the typed rationale as a local draft, reloads, and asks for a new submit. The new submit gets a new `requestId`, because it is a decision on a new view. |
| Conflict after the platform's 5 attempts | Shows "Busy. Try again." The app never retries by itself. |
| Network failure, result unknown | "Try again" sends the same `requestId` and digest. The answer is success or `REPLAYED`, never a second decision. |

The platform's automatic retry stays at its default. With the guard it is safe: a re-run loads the anchor again.

## Invariants

| # | How the design satisfies it |
|---|---|
| I1 | `CsDecision` and `CsAiRun` store the `evidenceRevision` they read. Evidence is immutable, and each write that raises the revision records it (D3 additions below). So revision n names 1 active evidence set and 1 `CsCostSnapshot`. |
| I2 | The guard rejects a command from an older view. Decisions are append-only. 2 commands from the same view both write the anchor, so 1 conflicts, is re-run, and meets the guard. |
| I3 | The replay check by `requestId` and `requestDigest`. 2 concurrent copies of 1 request both write the anchor, so 1 is re-run and returns `REPLAYED`. |
| I4 | Evidence becomes active only in the Action that raises the revision, in 1 atomic batch. A file not yet imported, an unmatched row, and a field result not yet recorded are never stored as active. |
| I5 | The browser sends IDs, a cause, a rationale, and expected counters, never a status or a number. The cause confirmation recomputes the snapshot on the server. The sourcing decision checks that `currentSnapshotId` belongs to the expected revision. |
| I6 | An AI run stores the revision it read, and is written without the guard. The app shows it as current only while that revision equals `evidenceRevision`. Otherwise it is labelled historical. |
| I7 | AI runs raise neither counter (D6.3). `decisionState` depends only on the revision. Showing or re-running an analysis changes no decision. |
| I8 | Evidence, AI, and decision objects come only from Actions (D6.4). `CsMarketPrice` is reference data (D4). A snapshot stores the market values it used, so a new market upload never changes the basis of a stored decision. |
| I9 | No decision Action calls a model or an outside system. Model calls run in the AI job (D7). The outreach notification runs after the commit. |
| I10 | The cost function reads only `RULE` causes and `CONFIRM_CAUSE` decisions. No Action copies an AI proposal into a metric, an eligibility, or a decision. The chosen cause is the person's parameter. |

## Decisions

| # | Choice |
|---|---|
| D6.1 | A: both counters must match on every decision command |
| D6.2 | A: the Action that raises the revision also computes the new `CsCostSnapshot` |
| D6.3 | A: an AI run does not write `CsExpansion` |
| D6.4 | A: an empty backing dataset that nothing builds |
| D6.5 | A: a replay throws `REPLAYED`, and nothing commits |
| D6.6 | D, Roshan's own: `APPROVED`, then `NOTIFICATION_REQUESTED` in the same Action. No `NOTIFIED` or `FAILED` |
| D6.7 | A: a batch that stores nothing new raises nothing, and the same file again returns `REPLAYED` |

The options as Roshan saw them:

**D6.1 Guard.** Which counters must match?
- **A (recommended):** both counters, on every decision command (Appendix A.4). Cost: an unrelated decision
  on the same expansion makes an open form stale. At D1 scale, a few writes each hour, this is rare.
- B: the revision, plus the latest decision on the same subject. Cost: more logic, and 1 more version for
  each subject.

**D6.2 Snapshot.** Where is the new `CsCostSnapshot` computed?
- **A (recommended):** in the same Action that raises the revision. Cost: with batched writes the function
  cannot read its own edits, so it computes from stored evidence plus the new rows in memory.
- B: in a separate Action after it. Cost: revision n+1 shows snapshot n until it runs, or forever after a crash.

**D6.3 AI runs and the anchor.**
- **A (recommended):** an AI run does not write `CsExpansion`. Cost: an exception to D3 principle 4.
- B: it writes the anchor but not `stateVersion`. Cost: slow AI writes conflict with decisions, and each
  re-run repeats the model call.
- C: it raises `stateVersion`. Cost: re-running an explanation makes an open review form stale (against I7).

**D6.4 Objects written by Actions.** What backs these object types?
- **A (recommended):** an empty backing dataset that nothing builds. Only Roshan can write it, and the app has
  no dataset scope. Cost: a project editor can still upload rows that bypass the guard.
- B: edit-only object types with no dataset. Cost: Palantir MCP says this is canary-only. Not tested here.

**D6.5 Replay response.**
- **A (recommended):** the function throws `REPLAYED`. Nothing commits, so no side effect can fire twice.
  Cost: the client must treat 1 error code as success.
- B: the function returns 0 edits. Cost: an outreach approval might notify twice (Not tested).

**D6.6 Outreach delivery.** D5 has `NOTIFIED` and `FAILED`, but the Action caller gets no delivery status.
- **A (recommended):** `APPROVED` means "Foundry accepted the request". The recipient, Roshan, confirms receipt
  with a small Action (`NOTIFIED`) or reports it missing (`FAILED`). Cost: 1 more Action. D5 needs a note.
- B: an Automate rule sends on `APPROVED`. Its history shows failures. Cost: a new platform feature to set up,
  and the app still cannot show a failure.
- C: as D5 is written: the approval sets `NOTIFIED`. Cost: it claims a delivery that nobody saw.
- **D (chosen by Roshan):** the approval Action stores `NOTIFICATION_REQUESTED` with the notification side effect.
  The state says only what the app knows. Cost: the app cannot show a delivery failure. If the Action fails,
  nothing is saved and the app shows the error.

**D6.7 A batch of only replays.** D4 raises the revision for every successful batch.
- **A (recommended):** a batch with 0 new rows and 0 new versions raises nothing. A repeat of the same file
  (same `fileDigest`) returns `REPLAYED`. Cost: a D4 amendment.
- B: raise the revision anyway. Cost: every decision shows "needs review" with no evidence change.

## D3 additions this record needs

| Type | Addition | For |
|---|---|---|
| `CsDecision` | key = `requestId`, plus `requestDigest` | I3 |
| `CsFieldVerification` | key = `requestId` instead of a server ID, `requestDigest`, `evidenceRevision` it created | I1, I3 |
| `CsImportBatch` | key = `expansionId:fileDigest`, `evidenceRevision` it created. The expansion is in the key, so a fresh demo expansion can import the same file. | I1, D6.7 |
| `CsCostSnapshot` | `marketDataAsOf`: the latest market month used | I8 |

## Smallest real test (not run)

1. A throwaway type `CsProbe` with 1 object and a `count`, and a function-backed Action `csProbeBump(expected)`
   that throws `STALE_COMMAND` when `count` differs from `expected`, and else writes `count + 1`.
2. Lost update: a variant without the guard, applied 20 times in parallel. Pass: final − start = successes.
3. Guard: 2 parallel applies with the same `expected`, 10 rounds. Pass: 1 success and 1 `STALE_COMMAND` each.
4. Retry mode "Disabled", then step 3 again. Record the exact conflict error name for D8.
5. Delete the type and the Action. Time: UNMEASURED, about 1 hour.

## Consequences and accepted risks

- History is append-only by design for normal users. It is not tamperproof against administrators.
- A strict guard sometimes asks a person to submit again. A platform re-run recomputes the snapshot, not a model call.

## Open questions

- A rules change, a new copy of `packages/domain`, creates no snapshot by itself. Proposal: the deploy step
  applies a recompute Action that raises the revision. D8 decides.
- If a function cannot read the user ID, an Action rule maps "current user" to `actorUserId`. The browser never
  sends it.

## Help received

Claude drafted this record, with options and a recommended default for each decision. Roshan decides.
