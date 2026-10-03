# Foundry resources

Every identifier that ClearSpend needs on the enrollment `https://roshan-amble.usw-3.palantirfoundry.com`.
Updated: 2026-09-28. Source for the object types: `scripts/lib/ontology.ts` and `npm run ontology:payloads`.

| Resource | Identifier |
|---|---|
| Project `ClearSpend`, `/roshan-amble-7809d6/ClearSpend` | `ri.compass.main.folder.dc56a933-d5b6-4da7-a9c8-739ccf32a1a8` |
| Ontology `roshan-amble Ontology` | `ri.ontology.main.ontology.17eb06bc-5728-411d-bcd2-772e1b451f20` |
| Functions repository `clearspend-functions`, cloned to `~/Developer/clearspend-functions` | `ri.stemma.main.repository.9d8e3420-9bb6-44f3-a13f-1ad37559e532` |
| Function `csImportEvidenceBatch` 0.1.0 (commit `00765af`, tag `0.1.0`) | `ri.function-registry.main.function.ee0f2cb0-ca59-4196-bf15-7aedd68d8b75` |
| Function `csConfirmIncidentCause` 0.1.0 | `ri.function-registry.main.function.2f9345e4-9bbe-4e64-b3f7-75ff93c6f2b9` |
| Global branch `clearspend-phase-2-actions` | `ri.branch..branch.40a31f42-c096-45f0-b64a-dc610e77c061` |
| Proposal to merge the Action types | `ri.branch..proposal.a95473d5-2a0e-4b6b-96a6-f1c2a85c9559` |
| Action type `cs-import-evidence-batch` (on that branch) | `ri.actions.main.action-type.0e5f5833-243c-4cf2-975f-73667fe3e05d` |
| Action type `cs-confirm-incident-cause` (on that branch) | `ri.actions.main.action-type.ee11ca2a-c87e-4f67-977f-05d7b5f7d0d6` |
| Developer Console app `ClearSpend` (public client, authorization code grant) | `ri.third-party-applications.main.application.3ef5e8b2-2997-4c33-b49b-14453bd4756f`, client ID `2df4b0e53677122a40883c3040bc4f40` (public), redirect `http://localhost:8080/auth/callback` |
| App SDK `@clearspend/sdk` 0.1.0 | Artifact repository `ri.artifacts.main.repository.6332d363-5ea8-47a8-b3a7-525178d182d2` |
| Function version 0.1.1 (commit `f4a6911`, tag `0.1.1`) | Adds Screen B storage; published 2026-09-30 |
| Proposal: 3 Screen B properties (merged) | `ri.branch..proposal.e97dd3eb-54c9-4ce7-a91a-b04725635fc8` |
| Proposal: Actions use 0.1.1 | `ri.branch..proposal.2c6ef7f1-1ad9-4b45-8346-7935b800e98c` |
| Global branch `clearspend-phase-3-4-actions` (2026-09-30) | `ri.branch..branch.842e6c89-c61c-4637-b628-7d2e4b2bbcdd` |
| Proposal: Phase 3 and 4 Actions, functions 0.2.0 | `ri.branch..proposal.ae140256-a1ba-4c98-ba27-d3bddadf486a` |
| Function `csSelectFieldVisit` | `ri.function-registry.main.function.1ef8bb1e-e066-469d-a1b7-b6c0a4bbabfd` |
| Function `csRecordFieldVerification` | `ri.function-registry.main.function.dd64bd24-b4c1-4145-9eda-2d7688d2e4b4` |
| Function `csRecordSourcingDecision` | `ri.function-registry.main.function.10350275-c2cc-444a-95e8-cc10d6b26d99` |
| Function `csStartAiJob` | `ri.function-registry.main.function.8dd8800f-30fa-41fd-91a7-338218a2ac0b` |
| Action type `cs-select-field-visit` | `ri.actions.main.action-type.cad26b67-0bf3-4dbd-bbd8-85455cb30fc7` |
| Action type `cs-record-field-verification` | `ri.actions.main.action-type.8e41c9b4-826b-4c8c-a755-6653986f9658` |
| Action type `cs-record-sourcing-decision` | `ri.actions.main.action-type.112ca635-7837-48f1-a7b4-c6d59636c501` |
| Action type `cs-start-ai-job` | `ri.actions.main.action-type.d1b8033a-3451-4f73-a668-40318867a6b7` |
| Model import in `clearspend-functions` | `ri.language-model-service..language-model.gpt-4-o`, alias `gpt4O` |
| Global branch `clearspend-outreach-0-2-1` | `ri.branch..branch.82a3d0a8-0ddc-441e-82f8-ff0f507d092d` |
| Function `csDecideOutreach` | `ri.function-registry.main.function.13719295-02ce-413b-8a21-fb6c42ef7209` |
| Action type `cs-decide-outreach` | `ri.actions.main.action-type.9b2d5a56-93b9-44f0-8501-683694fb4714` |
| Proposal: actor check, functions 0.2.2 | `ri.branch..proposal.1c4413ea-406b-4831-97a1-389552abe8d3` |
| App SDK `@clearspend/sdk` | 0.4.0 (2026-09-30): 18 types, 6 Actions (every Cs Action except the import Action, D9) |
| Proposal: target price fields (UI4, merged 2026-09-30) | `ri.branch..proposal.0dfe9099-96a1-42c5-8bfc-d9b6d34a5271` |
| Functions 0.3.0 (commit `9b68a20`, tag `0.3.0`) | adds `csPriceHistory` and `csSetCommodityTarget` |
| Functions 0.3.1 (commit `edd6498`, tag `0.3.1`) | `csPriceHistory` gets the query API name `csPriceHistory` |
| Function `csPriceHistory` (query function, UI5) | `ri.function-registry.main.function.fc9221b0-08ed-4226-ab4f-a80a618851cd` |
| Function `csSetCommodityTarget` | `ri.function-registry.main.function.9e990600-cc34-473c-9216-381386055d8c` |
| Global branch `clearspend-set-target-action` | `ri.branch..branch.c6a6039a-9e9a-47d0-b79c-ebe412626ef3` |
| Action type `cs-set-commodity-target` (merged) | `ri.actions.main.action-type.7cf60754-45ed-4283-89f4-069cd0f8edb6` |
| Proposal: set target Action (UI4) | `ri.branch..proposal.00c54b4a-fb83-4bc5-93fb-6e36677cb5b6` |
| App SDK `@clearspend/sdk` 0.5.0 (2026-09-30) | adds the target fields and the import Action (D9 amendment for UI3) |
| App SDK `@clearspend/sdk` 0.6.0 (2026-09-30) | adds `cs-set-commodity-target` and the query `csPriceHistory`; installed in `apps/web` |
| Portfolio datasets (2026-10-01) | `cs_country` `ri.foundry.main.dataset.704b64c8-3347-4dd9-b4eb-935ec11842e5`, `cs_meal` `ri.foundry.main.dataset.97d6120b-13f4-4453-a88e-e01a9a632d20`, `cs_investigator` `ri.foundry.main.dataset.26dcf678-95ff-4301-8b71-ce83814b3ca4`, `cs_investigator_busy` `ri.foundry.main.dataset.5aefcf25-8e19-49e7-b1ae-ce5699175302`, `cs_investigation` `ri.foundry.main.dataset.9578ec45-35f8-4315-986a-e830e510874e` |
| `cs_market_price` after the portfolio upload | 7,273 rows: 1,585 real WFP Androy + 5,688 synthetic (source_url `synthetic:clearspend-portfolio-generator`) |
| Global branch `clearspend-portfolio-types` | `ri.branch..branch.63e3f2f2-5a46-49fa-b760-302a8d0a4e8e` |
| Proposal: portfolio types | `ri.branch..proposal.6323cf39-8919-4c7d-b22e-ceca4a240d02` |
| Portfolio expansions | `EXP-<ISO3>-2026` for 22 countries; Madagascar is `EXP-MDG-2026` (leads only) |
| Portfolio object types (merged 2026-10-01) | `ri.ontology.main.object-type.37aeea2b-b2c0-4f46-a947-c61431a739db`, `…e568b5c0-87ff-4c24-8c95-9bb55b56c8df`, `…5e362008-8bf5-4a3b-9934-4e7eaf60258e`, `…37890d41-0555-4e54-8f70-71002969bbe0`, `…1ec94497-1b8e-4bf2-bb10-388503faeb1e` (CsCountry, CsMeal, CsInvestigator, CsInvestigatorBusy, CsInvestigation; in `resources.json`) |
| Functions 0.4.0 (commit `724bdb2`, tag `0.4.0`) | queries `csPortfolio` `ri.function-registry.main.function.88ed1bdc-c45d-4757-a9d6-e817b757c4c9`, `csCountry` `…ada9085e-99fa-417e-8794-f9c200303d78`, `csScheduleOptions` `…29426471-0e39-4d0e-92d0-23d50621a2ea`; `csTagInvestigation` `…eccb07ce-159a-4438-8b3a-d2991f50360f`, `csBookInvestigation` `…611a3484-4ce5-4479-9ddc-27cad4d5d07b` |
| Action types (merged 2026-10-01) | `cs-tag-investigation` `ri.actions.main.action-type.84db21fe-b5ea-4844-a6e8-8bc7ec48dd20`, `cs-book-investigation` `ri.actions.main.action-type.3ee2f018-4934-4dd9-be17-f561a0000377` |
| Proposal: investigation Actions | `ri.branch..proposal.1bcd1497-7d46-4088-9f62-d757e9862756` |
| App SDK `@clearspend/sdk` 0.7.0 (2026-10-01) | adds the 5 portfolio types, the 2 investigation Actions, and the 3 portfolio queries |
| Proposal: ration activities (merged 2026-10-01) | `ri.branch..proposal.6ab2bdc3-d190-41ec-bb7a-d8834d3451ee` on branch `ri.branch..branch.eef32019-999c-4d57-ab6a-66e84a26d608`: `CsMeal` gains `activity`, `beneficiaryGroup`, `beneficiaries` |
| Functions 0.4.2 (commit `204896a`, tag `0.4.2`) | the portfolio loader reads each ration's activity, group, and caseload |
| Functions 0.4.3 (commit `ff68b2a`, tag `0.4.3`) | nutrition suggestions capped at a normal serving |
| Dataset `cs_supplier_bid` (empty; Actions write it) | `ri.foundry.main.dataset.6de0edf9-9a89-48ae-8dff-029938dc2860` |
| Global branch `clearspend-supplier-bids` | `ri.branch..branch.eb998406-684c-4014-87f2-c16a9917fd0b` |
| Proposal: CsSupplierBid (opened 2026-10-01) | `ri.branch..proposal.2be17cd1-8eaa-47ae-b92b-76774e18a237` |
| Functions 0.5.0 (commit `6994484`, tag `0.5.0`) | the supplier list in `csCountry`; RANKING and BOOKING in `csStartAiJob` (live once `cs-start-ai-job` points at it) |
| Object type `CsSupplierBid` (merged 2026-10-01) | `ri.ontology.main.object-type.b7ab9a55-05e1-411e-93df-b156c3ca0f2b` (in `resources.json`) |
| Functions 0.6.0 (commit `789aff9`, tag `0.6.0`) | `csSubmitSupplierBid` `ri.function-registry.main.function.8259ef9a-5979-4ab4-889f-dbd1dc5c6e3c`, `csReviewSupplierBid` `…87ef3683-8b11-4525-b858-ee0f8e8603c1`; bids in `csCountry`; offers can be tagged |
| Action types (merged 2026-10-01) | `cs-submit-supplier-bid` `ri.actions.main.action-type.4007ecf4-b77e-482e-a0f8-3b70565976f7`, `cs-review-supplier-bid` `ri.actions.main.action-type.b192e703-fdfb-4063-8c18-920840e0d563`; `cs-start-ai-job` and `cs-tag-investigation` moved to 0.6.0 |
| Global branch `clearspend-bid-actions` | `ri.branch..branch.01516182-c95b-461e-b10f-ba612f129f37` |
| Proposal: supplier offer Actions, AI ranking and booking (merged 2026-10-01) | `ri.branch..proposal.4d6e1ed4-9c02-4c8d-9e1f-3c8672e79403` |
| App SDK `@clearspend/sdk` 0.9.0 (2026-10-01) | adds `CsSupplierBid` and `cs-review-supplier-bid`; `cs-start-ai-job` and `cs-tag-investigation` updated; installed in `apps/web` |
| Functions 0.6.1 (commit `8da6730`, tag `0.6.1`) | an empty AI ranking that says why is valid; a ranking with nothing left to rank is refused. `cs-start-ai-job` runs it (measured 2026-10-01: stored runs carry its rules version `domain-sha256:32de5f0ddbe50ed3`); the proposal that moved it was merged by Roshan, RID not recorded |
| Functions 0.6.2 (commit `122c123`, tag `0.6.2`) | queries only: reached against planned, local against international, each food's first step |
| Functions 0.6.3 (commit `57a710a`, tag `0.6.3`) | `csResetCountryDemo` `ri.function-registry.main.function.a28acc75-6c30-45e8-b8b3-0490237c2d73` (P12, the only function that deletes) |
| Action type `cs-reset-country-demo` (merged 2026-10-02; in no app SDK) | `ri.actions.main.action-type.6d9608f9-9d07-4632-825a-cb711f14d032` |
| Global branch `clearspend-demo-reset` | `ri.branch..branch.4850a69e-dfe9-4fe0-9b32-80530e49b316` |
| Proposal: demo reset for 1 country (merged 2026-10-02) | `ri.branch..proposal.8f8157ac-9b5c-4b0f-8e3c-46e7473e7381` |
| Functions 0.7.0 (commit `419ca14`) and 0.7.1 (commit `f4a82eb`) | queries only: each food's stage and next action in `csCountry` (`pipeline`, `tasks`), the worklist in `csPortfolio`, ordered by the money at stake |
| Functions 0.8.0 (commit `6a4d2d0`, tag `0.8.0`) | BRIEF replaces RANKING in `csStartAiJob`; 1 compared price and the next supplier to check in `csCountry`; the reset also clears BRIEF runs |
| Global branch `clearspend-visit-brief` | `ri.branch..branch.934d8968-c6d7-47c4-8c70-e463d56feaae` |
| Proposal: the AI visit brief replaces the AI ranking (merged 2026-10-02) | `ri.branch..proposal.8f262543-c3ad-4a01-a1fb-fb6d677b42fc`: `cs-start-ai-job` and `cs-reset-country-demo` to 0.8.0 |
| Functions 0.9.0 (commit `0e49ec1`) and 0.9.1 (commit `834978c`) | recommended steps, the ANALYSIS job, supplier-caused failures, the price chart series, the gap over the lowest price |
| Global branch `clearspend-ai-analysis` | `ri.branch..branch.d719f1da-6524-403f-8d62-0b5f2aa268bc` |
| Proposal: the AI analysis of recommended steps (merged 2026-10-02) | `ri.branch..proposal.12c729f5-0789-4dca-9f5b-ce53e4bfe174`: `cs-start-ai-job` and `cs-reset-country-demo` to 0.9.0 |
| Functions 0.10.0 (commit `a63bcb4`) and 0.10.1 (commit `624bda5`) | the international part of the plan, the next check on each route, local and international steps |
| Global branch `clearspend-international` | `ri.branch..branch.a313f54d-036c-4437-bde9-82d25fbd9d49` |
| Proposal: international suppliers in the AI jobs (merged 2026-10-02) | `ri.branch..proposal.1c64cba3-18bd-4f46-9320-30b5ef6701f9`: `cs-start-ai-job` and `cs-reset-country-demo` to 0.10.1 |
| App SDK `@clearspend/sdk` 0.10.0 (2026-10-01) | the same content as 0.9.0, generated again; installed in `apps/web` |
| Supplier SDK `@clearspend-suppliers/sdk` 0.1.0 | `CsCountry`, `CsSupplierBid`, `cs-submit-supplier-bid`; Artifact repository `ri.artifacts.main.repository.886de6d1-c87f-41d0-8d13-599a4848cff5`; installed in `apps/supplier` |
| Developer Console app `ClearSpend Suppliers` (public client) | `ri.third-party-applications.main.application.a8028b96-ebda-46f7-a886-9e51a7051066`, client ID `0f2de1e12c5c8590ee9cbdb153a64a29` (public), redirect `http://localhost:8081/auth/callback`; scope: `CsCountry` and `cs-submit-supplier-bid` only (P11) |
| App SDK `@clearspend/sdk` 0.8.0 (2026-10-01) | `CsMeal` updated; installed in `apps/web` |
| Global branch `clearspend-prefix-fix-0-2-3` | `ri.branch..branch.cb2b91bd-8d65-49e9-a042-a4592d2b50ad` |
| Global branch `clearspend-phase-2-ontology` (merged) | `ri.branch..branch.353eee45-0ec2-4b90-b7ee-99abb1bd149a` |
| Proposal to merge it to Main (opened 2026-09-28) | `ri.branch..proposal.7d10319c-b382-42f3-b4b9-7b4fb00b2575` |

## Object types, on the branch only

Foundry adds the prefix `fvhlhlrq.` to each object type ID. Each backing dataset is on the dataset branch `master`.
Every dataset except `cs_market_price` is empty: only Actions create those objects.

| API name | Object type ID | Object type RID | Backing dataset |
|---|---|---|---|
| `CsExpansion` | `fvhlhlrq.cs-expansion` | `ri.ontology.main.object-type.b673c603-e5da-4939-b2e6-55e48f2b9636` | `ri.foundry.main.dataset.939b8a78-48c0-44cf-8293-03e6039d95b7` |
| `CsExpansionCommodity` | `fvhlhlrq.cs-expansion-commodity` | `ri.ontology.main.object-type.df6e614c-4987-4cf0-9e9a-9febc6a44c74` | `ri.foundry.main.dataset.81dd87fc-8b38-4e8b-bb2d-0f30aeed0553` |
| `CsSupplier` | `fvhlhlrq.cs-supplier` | `ri.ontology.main.object-type.a750ae26-6bbb-404e-be97-e2efd413e77b` | `ri.foundry.main.dataset.53eb497d-c29f-4687-bb26-9c52e6c39265` |
| `CsSupplierProfileVersion` | `fvhlhlrq.cs-supplier-profile-version` | `ri.ontology.main.object-type.d0f502c5-a20c-4ac1-a3a7-7277e1a0cf6e` | `ri.foundry.main.dataset.5cbe55e9-94f3-4751-8e88-cfa00c1ccad2` |
| `CsPurchaseOrder` | `fvhlhlrq.cs-purchase-order` | `ri.ontology.main.object-type.ab13e7f3-2348-48a9-8213-7339472d8f5a` | `ri.foundry.main.dataset.95edbd14-3748-4c18-bb38-63c7eeeea027` |
| `CsPayment` | `fvhlhlrq.cs-payment` | `ri.ontology.main.object-type.1e684a26-1554-4506-b198-76a82ca7116b` | `ri.foundry.main.dataset.5788ffa0-f563-4781-81c2-c0b566ec1ddd` |
| `CsInvoice` | `fvhlhlrq.cs-invoice` | `ri.ontology.main.object-type.6bfd3f65-9033-4312-b5b6-a42e52c8f08d` | `ri.foundry.main.dataset.c8e91031-2ecc-4e9f-91e4-826cdfbbd114` |
| `CsDelivery` | `fvhlhlrq.cs-delivery` | `ri.ontology.main.object-type.4fcf1951-5326-4fdd-a7cf-70a80c205e5e` | `ri.foundry.main.dataset.8ec6c796-bf54-43e2-9ab6-f9a0f9730a9c` |
| `CsIncident` | `fvhlhlrq.cs-incident` | `ri.ontology.main.object-type.ab6cf0d2-b78a-4408-bba2-8acf8b2f21c7` | `ri.foundry.main.dataset.d8a4c7c1-d7d7-4374-b6e3-fcf49585a321` |
| `CsMarketPrice` | `fvhlhlrq.cs-market-price` | `ri.ontology.main.object-type.46a6b69d-cdbe-4f4e-8d04-e1550b857701` | `ri.foundry.main.dataset.a7150324-76d8-4635-9b6a-f21bf7b4bd60` |
| `CsImportBatch` | `fvhlhlrq.cs-import-batch` | `ri.ontology.main.object-type.83aa71e8-9f93-455f-84e2-3ab93d2d8228` | `ri.foundry.main.dataset.0656c550-141e-4365-845b-b66d419447f9` |
| `CsCostSnapshot` | `fvhlhlrq.cs-cost-snapshot` | `ri.ontology.main.object-type.030348d4-f3d6-4126-bbbd-8117351279b3` | `ri.foundry.main.dataset.c149a447-1c7e-44d5-9b32-9e6cf27e3ca8` |
| `CsCostLine` | `fvhlhlrq.cs-cost-line` | `ri.ontology.main.object-type.20095f54-5fcf-4b84-9d0a-0510c8b28754` | `ri.foundry.main.dataset.76fa5d32-9e1a-4a90-b0ee-b275bd1cd1c1` |
| `CsCauseProposal` | `fvhlhlrq.cs-cause-proposal` | `ri.ontology.main.object-type.1b01c946-f23c-485d-9359-58ddee0d5e0c` | `ri.foundry.main.dataset.88c1feab-6738-4a3d-9481-2bb74ce5845f` |
| `CsDecision` | `fvhlhlrq.cs-decision` | `ri.ontology.main.object-type.ae54f2e8-d4b5-48a8-8009-4f0257ef348e` | `ri.foundry.main.dataset.1172532b-ed5c-4e90-93ee-1e89a03803e1` |

`cs_market_price` holds 1,585 rows from `data/public/androy-market-prices.csv`, keyed on `price_id`.

## Link types, on the branch only

All one-to-many. Source: `LINK_TYPES` in `scripts/lib/ontology.ts`.

| Link type ID | RID |
|---|---|
| `fvhlhlrq.cs-expansion-commodities` | `ri.ontology.main.relation.1ead1eff-8124-4bf1-8401-a9eac68034fa` |
| `fvhlhlrq.cs-expansion-purchase-orders` | `ri.ontology.main.relation.42bfdc31-9c31-4f0a-9ea7-dd7f06143c9a` |
| `fvhlhlrq.cs-expansion-cost-snapshots` | `ri.ontology.main.relation.bc5d9bf1-5027-4340-aefb-40f1d9d4870e` |
| `fvhlhlrq.cs-expansion-decisions` | `ri.ontology.main.relation.05fc8aec-2010-4268-b958-fd9c27b9bf5b` |
| `fvhlhlrq.cs-expansion-import-batches` | `ri.ontology.main.relation.de7f533d-a57e-478b-b965-ee2d78685581` |
| `fvhlhlrq.cs-expansion-cause-proposals` | `ri.ontology.main.relation.4a198998-15a6-42c9-b0f0-e3af5247de27` |
| `fvhlhlrq.cs-supplier-purchase-orders` | `ri.ontology.main.relation.cfba6cf6-2d9e-454a-a3cf-dff2e3a3f214` |
| `fvhlhlrq.cs-supplier-profile-versions` | `ri.ontology.main.relation.52335a9a-4401-4e93-a1cf-f33167564947` |
| `fvhlhlrq.cs-supplier-cost-lines` | `ri.ontology.main.relation.49ae56eb-2997-4380-88bd-0d30a6300482` |
| `fvhlhlrq.cs-snapshot-cost-lines` | `ri.ontology.main.relation.28218d4d-6964-4f59-8cf6-7a1ba55e0fde` |
| `fvhlhlrq.cs-incident-cause-proposals` | `ri.ontology.main.relation.5e097fe7-7b3b-4aee-81a3-24d21569de77` |
| `fvhlhlrq.cs-proposal-decisions` | `ri.ontology.main.relation.0620a540-cbb2-4c64-a657-5336f6ba9f82` |

## Phase 3 and 4 (branch `clearspend-phase-3-4-types`, 2026-09-30)

| Resource | Identifier |
|---|---|
| Branch | `ri.branch..branch.92034fde-1016-4e47-9aed-9038c61a2812` |
| Proposal | `ri.branch..proposal.bd56ac42-5875-4d72-ae3d-2b06ecbd2358` |
| `CsAiRun`, `fvhlhlrq.cs-ai-run` | `ri.ontology.main.object-type.56312ece-118c-4d28-b9ab-60e8aba8b39c`, dataset `ri.foundry.main.dataset.1b6f6659-55ee-4ce7-a9d2-a3ea1d43d3aa` |
| `CsFieldVerification`, `fvhlhlrq.cs-field-verification` | `ri.ontology.main.object-type.b8a2f9db-600a-4d46-8288-a3c33e492382`, dataset `ri.foundry.main.dataset.9ab99521-a0e7-47d1-a68d-aba9e1732caa` |
| `CsOutreachMessage`, `fvhlhlrq.cs-outreach-message` | `ri.ontology.main.object-type.79e9ce86-3517-413e-887b-0c08614a5baf`, dataset `ri.foundry.main.dataset.02b4d047-4420-4e92-94e1-b04a105cd356` |
| Links | `cs-expansion-ai-runs` `578bf2fc-…`, `cs-ai-run-cause-proposals` `d089cff6-…`, `cs-expansion-field-verifications` `a95262df-…`, `cs-supplier-field-verifications` `ac0114cf-…`, `cs-expansion-outreach-messages` `a79f8e12-…`, `cs-supplier-outreach-messages` `be5a16e1-…` (all `ri.ontology.main.relation.*`, prefixed `fvhlhlrq.`) |

