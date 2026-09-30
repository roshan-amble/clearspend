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
