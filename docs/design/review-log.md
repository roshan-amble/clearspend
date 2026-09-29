# Design review log

Brief section 12.1, step 7: the questions from Claude's reviews, and Roshan's answers.

## 2026-09-28: D6 and D9 drafts, and gaps in approved records

Claude drafted D6 and D9 with options and a recommended default. The drafts found 4 gaps in approved records.

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| Gap 1 | The brief says a cause confirmation changes the evidence revision. D4 and D5 do not. Should it? | Yes. A confirmation changes the cost numbers. Without a new revision, a sourcing decision made on the old numbers stays "decided" and is not marked for review. Brief section 8 already says this. | D4 "Revision effect", D5 incident cause |
| Gap 2 | D4 raises the revision for a batch of only replays. | Fix it. A pure replay would give a new revision, and every decision would need review for no reason. | D4 "Revision effect", D6.7 A, `CsImportBatch` key |
| Gap 3a | D5 has no role that may import evidence. | Fix it. Keep import separate from the business roles. A technical import group, used only by the script, is the classic finance control. | D5 table, D9.2 A, `packages/domain` `IMPORT_EVIDENCE` |
| Gap 3b | D5's `NOTIFIED` assumes a delivery signal. Foundry gives none. | Fix it. Foundry runs the notification after the save and does not confirm delivery. The state must say only what the app knows. Then chose: `APPROVED`, then `NOTIFICATION_REQUESTED`, with no manual receipt Action. | D5 outreach, D3 `CsOutreachMessage`, D6.6 option D, `packages/domain` `OutreachStatus` |
| Gap 4 | D3 has no request identity for retries. | Fix it. Without it a retry can create duplicate decision records, which invariant I3 forbids. | D3 `CsDecision`, `CsFieldVerification`, `CsImportBatch`, and the Foundry branch |
| D6.1 to D6.5, D9.1, D9.3, D9.4 | The remaining decisions | All A, the recommended default | D6, D9 |

Claude's change beyond the drafts: the `CsImportBatch` key is `expansionId:fileDigest`, not `fileDigest`, so a
fresh demo expansion can import the same file.

Roshan approved D6 and D9 on 2026-09-28. The Phase 2 design gate before any Action is open.

Roshan's notes on gaps 2, 3a, 3b, and 4 arrived cut off. The "Roshan's answer" column shows Claude's reading of them.
