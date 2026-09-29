# Foundry resources

Every identifier that ClearSpend needs on the enrollment `https://roshan-amble.usw-3.palantirfoundry.com`.
Updated: 2026-09-28. Source for the object types: `scripts/lib/ontology.ts` and `npm run ontology:payloads`.

| Resource | Identifier |
|---|---|
| Project `ClearSpend`, `/roshan-amble-7809d6/ClearSpend` | `ri.compass.main.folder.dc56a933-d5b6-4da7-a9c8-739ccf32a1a8` |
| Ontology `roshan-amble Ontology` | `ri.ontology.main.ontology.17eb06bc-5728-411d-bcd2-772e1b451f20` |
| Global branch `clearspend-phase-2-ontology` | `ri.branch..branch.353eee45-0ec2-4b90-b7ee-99abb1bd149a` |

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
