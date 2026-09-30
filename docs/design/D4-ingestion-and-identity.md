# D4: Ingestion and evidence identity

Status: approved by Roshan on 2026-09-28. Claude drafted it.
Amended on 2026-09-28 after Roshan's answers on gaps 1, 2, and 3a (see [review-log.md](review-log.md)).
Requirements addressed: D1, D2 decision 6, brief section 7 source rules.

## 2 import paths

| Data | Path | Why |
|---|---|---|
| Public market prices | The script uploads a filtered dataset: Androy, the D11 commodity series, the last 24 months. `CsMarketPrice` reads it directly. | Reference data, not spend evidence. It has no revision effect. |
| Evidence: suppliers, profiles, purchases, payments, invoices, deliveries, incidents | The script validates each file, then applies the Action `csImportEvidenceBatch` once for each file, as a member of the evidence importer group only (D9.2) | The Action applies the identity rules on the server, and changes the expansion's revision once for each batch. |
| Setup: `expansion.csv`, `expansion-commodities.csv` | The same Action `csImportEvidenceBatch`, with the file kinds `expansion` and `expansion-commodities`. The first batch creates the `CsExpansion` anchor (Roshan, 2026-09-29). | 1 import path and 1 permission for all imported data. |
| Field verifications | The field verifier records each one through the Action `csRecordFieldVerification`. The demo script can apply the same Action for the later fixture. | It is a person's observation, so it has an actor. |

## Namespaces (Roshan, 2026-09-29)

A demo or test run can import the same fixtures again into a fresh namespace. The script prefixes every
`source_system` and the expansion ID, for example `t1/harbor-erp` and `EXP-ANDROY-2026-T1`. Logical IDs never
collide with another namespace. Suppliers are stored once for each namespace.

## Identity rules

- **Logical ID:** `sourceSystem:externalId`, for example `harbor-erp:PO-A3`.
- **Content digest:** SHA-256 of the canonical JSON of the business fields. The import time is not part of it.
- **Version ID:** `logicalId@first12CharactersOfDigest`.

| Case | Result |
|---|---|
| Same logical ID, same digest | Replay. No new row. The batch report counts it as replayed. |
| Same logical ID, new digest, delivery or incident | A new version with `supersedes`. The new version replaces the old one in the active set. It is never added to it. |
| Same logical ID, new digest, payment | A conflict. The purchase gets the finding `CONFLICTING_EVIDENCE` and cannot reconcile until a person resolves it. |
| New logical ID with `replacesOrderId` | A replacement purchase. It is a new purchase, not a replay. |
| 2 payments with different IDs and the same amount | 2 payments. The rules never match by amount, date, or supplier. |
| A row that references an unknown ID | Not stored. The batch report lists it as unmatched. |

## Validation

- The script checks each file against a Zod schema before any upload. A failed file stops with the row
  number and the field.
- The Action checks the same rules again on the server, because the script is not the only possible caller.
- Money must be a non-negative safe integer in USD cents. Quantities must be whole grams or millilitres.
- Market prices keep `usdprice` as published text. The script converts it to micro-dollars with an exact
  decimal parser, never with floating-point multiplication.

## Revision effect

These events add 1 to `CsExpansion.evidenceRevision`, and compute a new `CsCostSnapshot` in the same Action (D6.2):

- an evidence batch that stores at least 1 new row or new version,
- a cause confirmation, because it changes the cost numbers (brief section 8),
- a field verification.

A batch that stores nothing new, for example a batch of only replays, adds nothing. Otherwise every decision would
show "needs review" with no change in the evidence. The same file again for the same expansion has the same
`CsImportBatch` key, `expansionId:fileDigest`, and returns `REPLAYED` (D6.7).

Earlier AI runs and decisions keep their old revision, so the app shows them as historical.

## Help received

Delegated. Claude drafted this record. Roshan reviews it.
