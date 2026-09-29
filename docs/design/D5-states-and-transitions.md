# D5: Statuses and transitions

Status: approved by Roshan on 2026-09-28. Claude drafted it.
Amended on 2026-09-28 after Roshan's answers on gaps 1, 3a, and 3b (see [review-log.md](review-log.md)).
Requirements addressed: D1 roles and writes, brief sections 8 and 9, invariants I1 to I10, rules C1 to C9.

All transitions are defined and tested in 1 place: `packages/domain`. Actions call it. The browser never
decides a transition.

## Purchase reconciliation (derived, never stored as a decision)

`RECONCILED`, `DISCREPANCY`, `INCOMPLETE`, or `UNSUPPORTED`. Only `RECONCILED` purchases enter a paid cost (C2).
Every finding stays visible. A display status never hides a second finding.

## Incident cause

```
 imported ──► rule check ──► rule matches ──────────────────────► RULE_CLASSIFIED   (final)
                   │
                   └──► no match ──► UNCONFIRMED ──► AI run ──► AI_PROPOSED
                                        ▲                          │
                                        │                          ▼
                                        └──── new evidence ◄── CONFIRMED  (a person chose the cause)
```

- `UNCONFIRMED` and `AI_PROPOSED` both count as unconfirmed, so the metric shows a range (C5).
- A person can confirm a different cause than the AI proposed. The decision records both.
- A later confirmation supersedes an earlier one. The history keeps both.
- A confirmation changes the cost numbers, so it raises the evidence revision (D4). A sourcing decision made on
  the old numbers then shows "needs review".

## Supplier eligibility (derived from evidence and decisions)

```
 LEAD ──► SELECTED_FOR_VISIT ──► VERIFIED_PASS  ──►  ELIGIBLE
                             └─► VERIFIED_FAIL
 A new ration version sends every supplier back to "needs verification", with its history kept.
```

A supplier is `ELIGIBLE` only with a passed field verification against the current ration version (C9).

## Outreach message

```
 DRAFTED ──► person approves ──► APPROVED ──► same Action requests the notification ──► NOTIFICATION_REQUESTED
         └─► person rejects  ──► REJECTED
```

- Nothing is requested without a person's approval.
- Foundry sends the notification after the Action saves, and reports no delivery (D6.6). So the last state says
  only what ClearSpend knows. There is no `NOTIFIED` or `FAILED` state.
- If the Action fails, nothing is saved, and the app shows the error. A person can approve again.

## Expansion decision state

`UNDECIDED` ──► `DECIDED` at revision n ──► `NEEDS_REVIEW` when the evidence revision passes n.
The events that raise the revision are listed in D4 "Revision effect".

## Who can do what

| Transition | Supply chain manager | Field verifier | Finance manager | Evidence importer |
|---|:-:|:-:|:-:|:-:|
| Import an evidence batch | | | | ✓ |
| Start an AI job | ✓ | | | |
| Confirm an incident cause | ✓ | | | |
| Select a supplier for a field visit | ✓ | | | |
| Record a field verification | | ✓ | | |
| Approve or reject an outreach message | ✓ | | | |
| Record a sourcing decision | ✓ | | | |
| Read everything | ✓ | ✓ | ✓ | |

Foundry enforces this table: each Action's submission rules name the allowed Foundry group.
The evidence importer is a technical group, used only by the import script (D9.2). No business role can change
the evidence that its own decisions depend on. `PERMISSIONS` in `packages/domain` holds the same table.

## Help received

Delegated. Claude drafted this record. Roshan reviews it.
