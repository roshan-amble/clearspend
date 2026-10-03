# D3: Data model

Status: approved by Roshan on 2026-09-28. Claude drafted it, because Roshan delegated the data model.
Amended on 2026-09-28 for D6 and D9, after Roshan's answers on the gaps (see [review-log.md](review-log.md)).
Requirements addressed: D1, D2, brief sections 7 and 8.
Context and constraints: [platform-facts.md](platform-facts.md). The enrollment has 1 shared Ontology, so every
ClearSpend object type has the API name prefix `Cs`.

## Principles

1. **4 kinds of things never mix:** recorded evidence, calculated results, AI output, and human decisions.
2. **Evidence is immutable.** A correction is a new version. The old version stays.
3. **Decisions are append-only.** A new decision can supersede an old one. It never edits it.
4. **1 anchor object for each expansion.** Every write Action touches `CsExpansion`. Foundry checks conflicts
   per object, so 2 conflicting writes to the same expansion cannot both succeed silently.
5. **Integers for money and quantities.** USD cents, grams, and millilitres. Public market prices keep the
   published decimal text and an exact integer in micro-dollars.

## Object types

### Evidence: what happened (immutable)

| Object type | Key properties | Identity |
|---|---|---|
| `CsExpansion` | name, region, rationVersion, evidenceRevision, stateVersion, currentSnapshotId, visibilityLevel | `expansionId` |
| `CsExpansionCommodity` | expansionId, commodity, unit, quantityPerMeal, maxMoisturePermille, plannedPerMonth, marketVolumeEstimatePerMonth (synthetic), marketSeries | `expansionId:commodity` |
| `CsSupplier` | name, route (`IMPORT` or `LOCAL`), country | `sourceSystem:supplierId` |
| `CsSupplierProfileVersion` | supplierId, commodity, language, text, quotedCentsPerUnit, claimedCapacityPerMonth, submittedAt, supersedesVersionId | `supplierId@digest` |
| `CsPurchaseOrder` | expansionId, supplierId, commodity, quantity, unitPriceCents, totalCents, currency, replacesOrderId, recordedAt | `sourceSystem:orderId@digest` |
| `CsPayment` | orderId, amountCents, currency, paidAt | `sourceSystem:paymentId@digest` |
| `CsInvoice` | orderId, commodity, quantity, unitPriceCents, totalCents, currency, recordedAt | `sourceSystem:invoiceId@digest` |
| `CsDelivery` | orderId, quantityReceived, receivedAt, handoverAt, moisturePermille, acceptanceResult | `sourceSystem:receiptId@digest` |
| `CsIncident` | orderId, reportedAt, affectedQuantity, documents (list of document ID, author role, text, time) | `sourceSystem:incidentId@digest` |
| `CsFieldVerification` | supplierId, rationVersion, visitedAt, verifierUserId, result, moisturePermille, confirmedCapacityPerMonth, notes, requestDigest, the evidenceRevision it created | the caller's `requestId` (D6) |
| `CsMarketPrice` | date, admin1, market, commodity series, unit, priceType, usdPriceText, usdPriceMicros, sourceUrl, downloadedAt | `marketId:series:date` |
| `CsImportBatch` | fileDigest, importedAt, actorUserId, accepted, replayed, versioned, conflicting, unmatched, the evidenceRevision it created | `expansionId:fileDigest` (D6.7) |

All evidence rows carry `sourceSystem`, `externalId`, `contentDigest`, and `importBatchId`.

### Calculated: what code derives (immutable, 1 set for each revision)

| Object type | Key properties |
|---|---|
| `CsCostSnapshot` | expansionId, evidenceRevision, rulesVersion, createdAt, market indicator values, marketDataAsOf (the latest market month used, I8) |
| `CsCostLine` | snapshotId, supplierId or route, commodity, nominal, supplier, and route cost per unit as low and high bounds, batch count, failure counts by cause, quoted cost, eligibility |

### AI output: what the AI proposed (immutable)

| Object type | Key properties |
|---|---|
| `CsAiRun` | job (`CAUSE`, `EXTRACTION`, `EXPLANATION`, `OUTREACH_DRAFT`), subjectId, evidenceRevision, logicFunctionVersion, model, startedAt, status (`SUCCEEDED`, `FAILED`, `INVALID`), error, validated output as JSON, token use |
| `CsCauseProposal` | incidentId, source (`RULE` or `AI`), aiRunId, proposedCause, citations, conflicts, unknowns |

Extraction, explanation, and outreach draft outputs are display-only, so they stay as validated JSON on
`CsAiRun`. The cause proposal is its own type, because a decision answers it.

### Human decisions: what a person chose (append-only)

| Object type | Key properties |
|---|---|
| `CsDecision` | decisionId = the caller's `requestId` (D6), expansionId, type (`CONFIRM_CAUSE`, `SELECT_FIELD_VISIT`, `APPROVE_OUTREACH`, `REJECT_OUTREACH`, `SOURCING_DECISION`), subjectId, answersProposalId, chosenCause, rationale, actorUserId, createdAt, evidenceRevision, requestDigest, supersedesDecisionId |
| `CsOutreachMessage` | supplierId, aiRunId of the draft, approved text, status `NOTIFICATION_REQUESTED`, approvedByDecisionId |

`CsOutreachMessage.status` claims only that the approval Action requested the notification. Foundry reports no
delivery to the caller (D6.6), so there is no `NOTIFIED` or `FAILED` state.

The counters and `currentSnapshotId` on `CsExpansion` are the only mutable properties in the model.

## Links

```
 CsExpansion ─┬─< CsExpansionCommodity
              ├─< CsPurchaseOrder >── CsSupplier ─┬─< CsSupplierProfileVersion
              │     ├─< CsPayment                 ├─< CsFieldVerification
              │     ├─< CsInvoice                 └─< CsOutreachMessage
              │     ├─< CsDelivery
              │     └─< CsIncident ─< CsCauseProposal ── CsDecision (answers)
              ├─< CsCostSnapshot ─< CsCostLine
              ├─< CsDecision
              ├─< CsAiRun
              └─< CsImportBatch
 ─<  means "has many"
```

## Scale check (D1 scale B)

At 5 regions, 20 foods, 500 suppliers, and 10,000 purchases each year, the largest types are `CsMarketPrice`
(tens of thousands of rows) and the purchase records (tens of thousands). Both are small for Foundry. The
`CsExpansion` anchor gets 1 write for each decision or import, which is a few writes each hour for 20 users.

## Implementation notes, 2026-09-28

Claude added these while creating the types. Roshan reviews them with the Foundry branch.

- Every property is listed in `scripts/lib/ontology.ts`. A test checks that each fixture field maps to exactly
  1 property, and that `CsMarketPrice` maps every column of the uploaded market file.
- Phase 2 creates 15 of the 18 types. `CsFieldVerification`, `CsAiRun`, and `CsOutreachMessage` wait for
  Phases 3 and 4 (brief section 13: "only those needed now").
- **Links to versioned evidence are filters, not Foundry link types.** A Foundry link type must point at the
  target's primary key. A versioned type's primary key is its version ID, but a payment names the order's logical
  ID. So `CsPayment`, `CsInvoice`, `CsDelivery`, and `CsIncident` hold `order_logical_id`, and Functions filter
  on it. Links to types without versions (`CsExpansion`, `CsSupplier`, `CsCostSnapshot`) can be link types.
- Quantities are stored in grams or millilitres, with the source quantity and unit next to them. Prices are
  cents for each kilogram or litre (`unit_price_cents_per_1000`), the same as `packages/domain`.
- Exact ratios on `CsCostLine` are text `numerator/denominator`, because a Foundry double is floating point.
- `CsIncident.documents` is an array of structs. It is edit-only: only Actions write it.
- Each type except `CsMarketPrice` has an empty backing dataset, and only Actions create its objects (D6.4).
- Screen B reads stored results, because the browser never calculates (D2): `CsCostSnapshot.purchases_json`
  (each purchase's reconciliation status and findings), `CsCostSnapshot.incidents_json` (each incident's cause
  status), and `CsCostLine.per_meal_json` (exact cents for 1 meal). The browser only rounds them for display
  (brief section 7). Added 2026-09-29, nullable, because earlier snapshots do not have them.
- A property added after its type was created is edit-only, because Palantir MCP cannot add a column to an
  existing dataset: `CsDecision.request_digest` and `CsCostSnapshot.market_data_as_of`.

## Amendment, 2026-09-30: target price (UI4 A)

Roshan chose UI4 A ("go with recommendations"). `CsExpansionCommodity` gets 3 edit-only properties:
`targetCentsPer1000` (long, whole US cents for 1,000 base units, so 50 means 0.50 USD per kg or L), `targetSetBy`,
and `targetSetAt`. They are the only mutable properties on an evidence type, and they are not evidence: a target is a
planning value, so setting it raises `stateVersion`, never `evidenceRevision`, and no snapshot is written.

The Action `cs-set-commodity-target` (function `csSetCommodityTarget`, D6 guard with expected counters and a request
ID) stores 1 `CsDecision` with `decisionType = SET_TARGET`, `subjectId = commodity`, the target in
`targetCentsPer1000`, and `supersedesDecisionId` pointing at the previous target decision. The decision history is the
audit trail; the edit-only property is the current value.

## Amendment, 2026-10-01: portfolio types (P1)

| Object type | Key properties | Written by |
|---|---|---|
| `CsCountry` | countryIso3, name, flag, programRegion, expansionId, status (ACTIVE, NEW), schools, students, hub, synthetic | Reference upload (`npm run portfolio:upload`) |
| `CsMeal` | mealId, countryIso3, expansionId, name, servingsPerMonth, daysServed, ingredientsJson (whole g or ml per serving) | Reference upload |
| `CsInvestigator` | investigatorId, name, homeCountryIso3, baseCity, hub, kind (LOCAL, REGIONAL), skills, scheduleVersion (edit-only) | Reference upload; bookings raise scheduleVersion |
| `CsInvestigatorBusy` | busyId, investigatorId, startDate, endDate (inclusive), reason, investigationId | Reference upload; `cs-book-investigation` adds 1 block for each booking |
| `CsInvestigation` | investigationId (requestId), countryIso3, subjectType (SUPPLIER, MARKET), subjectId, commodity, reason, requiredSkill, durationDays, status, requestDigest, investigatorId, travelDays, onGroundStart, onGroundEnd, bookedBy, bookedAt | `cs-tag-investigation`, `cs-book-investigation` |

Recipes, costs, nutrition, and recommendations are computed, never stored: the query functions `csPortfolio` and
`csCountry` run `countryView` (packages/domain/src/portfolio-view.ts) over the stored objects on each call.

## Amendment, 2026-10-01: CsSupplierBid (P10)

`CsSupplierBid`, primary key `bid_id` (the submitting request's requestId): country, expansion, food, business name,
contact, delivery area, price in cents per 1,000 base units, the monthly quantity as entered and in base units, the
earliest start, an optional note, status (`SUBMITTED`, `ACCEPTED`, `REJECTED`), who submitted and when, the request
digest, and who reviewed, when, and why. Written only by `cs-submit-supplier-bid` and `cs-review-supplier-bid`. An
accepted offer appears in the country view as supplier `bid:<bid_id>`.

## Help received

Delegated. Claude drafted this record. Roshan reviews it.
