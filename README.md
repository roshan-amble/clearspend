# ClearSpend

Sourcing intelligence for **Harbor Meals**, a fictional WFP-style food assistance organization running school meals,
general food distribution, and nutrition support in 22 countries. It answers: what do we buy, from whom, at what
price; which local or international supplier should we check next; what does each supplier claim; who can go and
check it, and when.

> Built on **Palantir Foundry** and **AIP**. 21 programs are generated test data (labeled synthetic). Madagascar, the
> new program, uses WFP's real Androy market prices. Every organization, supplier, and person is fictional.

---

## Architecture at a glance

**There is no backend of our own:** no server, no database, no message queue. Foundry is the whole backend: the
Ontology holds the data and the only ways to change it (Actions), TypeScript Functions hold the logic, and AIP runs
the model. This repo holds the rules, the two React front ends, and the scripts.

```
 THIS REPO (TypeScript monorepo)                          PALANTIR FOUNDRY
 ┌───────────────────────────┐   OSDK (generated SDK)   ┌──────────────────────────────────────────┐
 │ apps/web       :8080      │ ───────────────────────▶ │ ONTOLOGY                                 │
 │  staff app: map + 5 pages │                          │  24 object types (prefix "Cs")           │
 ├───────────────────────────┤                          │  13 Actions: the only way to write       │
 │ apps/supplier  :8081      │ ─── own narrow SDK ────▶ │                                          │
 │  supplier offer form      │                          └──────┬──────────────────────┬────────────┘
 └───────────────────────────┘                                 │ backed by            │ run
 ┌───────────────────────────┐                          ┌──────▼──────┐   ┌───────────▼─────────────┐
 │ packages/domain           │ ── generated copy ─────▶ │  Datasets   │   │ FUNCTIONS (TypeScript)  │
 │  every rule, pure TS,     │    (clearspend-functions │  (storage)  │   │  4 queries, 13 Action   │
 │  exact arithmetic         │     repo, in Foundry)    └─────────────┘   │  functions; the domain  │
 ├───────────────────────────┤                                            │  rules run inside       │
 │ scripts/                  │ ── REST + Actions ─────▶ imports, checks,  └───────────┬─────────────┘
 │  data, imports, real-run  │                          resets                        │ AI jobs only
 │  checks, demo reset       │                                            ┌───────────▼─────────────┐
 └───────────────────────────┘                                            │ AIP: GPT-4o via the     │
                                                                          │ model proxy, user token │
                                                                          └─────────────────────────┘
```

| Layer | Technology |
|---|---|
| Front ends | React 18, Vite 7, React Router, ECharts 5 (SVG), world-atlas + topojson for the heat map |
| Data access | **OSDK** (`@osdk/client`, `@osdk/oauth`): a typed SDK generated per Developer Console app, OAuth public client |
| Rules | `packages/domain`: pure TypeScript, no React, no SDK; exact `Fraction` arithmetic, never floating point |
| Backend logic | **Foundry Functions** (TypeScript v2), repo `clearspend-functions`, CI on push, published on a tag |
| Data and writes | **Foundry Ontology**: object types backed by datasets; **Actions** backed by functions |
| AI | **AIP**: GPT-4o through the OpenAI-compatible model proxy, called from a function with the signed-in user's token |
| Schema changes | Foundry **global branches** and **proposals**, created through the Palantir MCP server, merged by a person |
| Tooling | Node 22.13 (mise), npm workspaces, Vitest, tsx |

---

## The backend in Foundry

### 1. Ontology: 24 object types

All API names start with `Cs`, because the Ontology is shared with other examples.

| Group | Object types |
|---|---|
| Program | `CsCountry`, `CsExpansion` (1 program), `CsExpansionCommodity` (ration spec, market size), `CsMeal` (rations, activities, caseloads) |
| Evidence (versioned, imported) | `CsSupplier`, `CsSupplierProfileVersion`, `CsPurchaseOrder`, `CsInvoice`, `CsPayment`, `CsDelivery`, `CsIncident`, `CsImportBatch` |
| Market | `CsMarketPrice` (WFP monthly medians; real for Madagascar, synthetic elsewhere) |
| Costs (computed, immutable) | `CsCostSnapshot`, `CsCostLine` (1 per supplier or route and food, per evidence revision) |
| Decisions | `CsCauseProposal`, `CsDecision`, `CsFieldVerification`, `CsOutreachMessage` |
| AI | `CsAiRun`: every model call, its input digest, validated output or reasons, and token use |
| Investigations | `CsInvestigation`, `CsInvestigator`, `CsInvestigatorBusy` (calendar blocks) |
| Supplier site | `CsSupplierBid`: an offer that counts only after a person accepts it |

Evidence follows strict identity rules (design record D4): reference records conflict on change, versioned records
get a new version, and a replayed import changes nothing.

### 2. Actions: the only way to write (13)

Every Action is backed by a TypeScript function that checks the request before it writes.

| Action | What it does |
|---|---|
| `cs-import-evidence-batch` | Imports 1 evidence file, validates it, and writes a new cost snapshot |
| `cs-confirm-incident-cause` | A person confirms why a delivery failed; the cost history gets a new point |
| `cs-start-ai-job` | Runs 1 AI job (below) and stores 1 `CsAiRun` |
| `cs-select-field-visit` · `cs-record-field-verification` | Field visits to a supplier and their result |
| `cs-record-sourcing-decision` · `cs-decide-outreach` | The sourcing decision; approving or rejecting an outreach draft |
| `cs-set-commodity-target` | A target price, display only |
| `cs-tag-investigation` · `cs-book-investigation` | Tag a supplier or market for a visit; book an investigator |
| `cs-submit-supplier-bid` · `cs-review-supplier-bid` | Supplier site offers, and their review |
| `cs-reset-country-demo` | Rehearsal tool: removes 1 country's investigations, bookings, offers, and portfolio AI runs |

**Every write is protected the same way:**

- **Actor check.** The function reads the signed-in user (Admin API) and refuses a request made in another
  person's name.
- **Idempotency.** Each command carries a client-generated `requestId` and a SHA-256 digest. The same request again
  is `REPLAYED` and changes nothing; the same ID with different content is refused.
- **Optimistic concurrency.** Commands carry the counters the person saw (evidence revision, state version, an
  investigator's schedule version). A stale view is refused with `STALE_COMMAND`.
- **No double booking.** A booking re-checks the stored calendar inside the Action, not the options the page saw.

### 3. Functions: 4 queries compute every page

| Query | Feeds |
|---|---|
| `csPortfolio` | The heat map (colored by recommended actions) and the country cards |
| `csCountry` | All 5 country pages: ingredients, suppliers with the 10% rule, the local and international plan, the pipeline stage of each food, recommended steps, investigations |
| `csScheduleOptions` | The earliest free trip of each investigator, local or fly-in |
| `csPriceHistory` | The price chart: what we paid each month against the lowest market price |

The browser only formats what these return. The functions run the same `packages/domain` code as the local tests.
`npm run portfolio:check -- --foundry` proves that every cost line stored in Foundry equals what the rules compute
locally.

### 4. AIP: AI handles text, code handles numbers

All AI runs through `cs-start-ai-job`: the function builds the prompt **from stored objects only** (the browser
sends IDs, never text), calls GPT-4o, **validates the output with tested code**, and stores the run. **AI output
changes nothing until a person acts.**

| Job | Where | What the model does | What code refuses |
|---|---|---|---|
| `BRIEF` | Suppliers → Investigate | Writes a visit brief from the supplier's own profile or offer note: claims, gaps, checks | A claim whose quote is not verbatim in the supplier's text |
| `BOOKING` | Investigations | Recommends who to book among the free trips code found | An investigator without a free trip |
| `ANALYSIS` | AI analysis | Orders and explains the steps that rules found | An added, moved, or missing step; any number not in the evidence |
| `CAUSE` | Incidents | Proposes why a delivery failed when documents disagree | A citation to a document that was not sent |
| `EXTRACTION` · `EXPLANATION` · `OUTREACH_DRAFT` | Program records | Profile claims, a cost explanation, a draft message | Non-verbatim spans, unknown citations |

Ranking suppliers by saving is arithmetic, so code does it: each food's next supplier to check (local and
international) is computed, not generated.

### 5. Access: 2 Developer Console apps

App access = OAuth scopes ∩ the app's restricted resource scope ∩ the user's permissions.

| App | Scope | Used by |
|---|---|---|
| ClearSpend | The Cs object types, the staff Actions, the 4 queries, the model | `apps/web` |
| ClearSpend Suppliers | `CsCountry` (program names), `CsSupplierBid`, `cs-submit-supplier-bid` | `apps/supplier`: it never sees a market price, our price, or another offer |

`cs-reset-country-demo` is in neither app's SDK; only the script calls it.

### 6. How a change reaches Foundry

1. Object types and Actions are created on a **global branch** through the Palantir MCP server and merged by a
   person through a **proposal**.
2. `npm run domain:sync` copies `packages/domain` into the functions repo; a test fails if the copy drifts.
3. A push to `clearspend-functions` runs **CI**; a **tag** publishes. Queries run the latest tag; each Action is
   pinned to a function version, so moving it is a proposal.
4. A new **OSDK version** is generated for each app that needs the change.

---

## The domain package (`packages/domain`)

Every rule, as pure TypeScript with tests. No React, no OSDK, no platform SDK.

| Module | Rules |
|---|---|
| `fraction`, `decimal` | Exact arithmetic: integers and fractions; money in cents, quantities in grams or millilitres |
| `evidence`, `snapshot`, `reconcile`, `cost`, `range` | Import validation and identity, reconciliation, the cost model, cost ranges for unconfirmed failures |
| `causes`, `transitions`, `commands`, `permissions` | Incident causes, state transitions, command checks |
| `portfolio`, `portfolio-view`, `offers` | Programs, nutrition, recommendations, the 10% rule, local and international plans, net costs |
| `workflow` | The 5 sourcing stages of each food, the next supplier to check, the recommended steps |
| `schedule` | Earliest free trips, travel days, booking checks |
| `history` | Monthly price series and the price chart |
| `ai` | Every AI input builder, prompt, and output validator |

---

## Repository layout

```
apps/web/            staff app (portfolio map, 5 country pages, program records)
apps/supplier/       supplier offer site
packages/domain/     the rules and their tests
scripts/             data generation, uploads, imports, real-run checks, demo reset
data/fixtures/       the Androy story fixtures and WFP market prices
data/portfolio/      22 generated programs (synthetic) and reference data
docs/design/         design records D1 to D11, the review log, platform facts
docs/                progress, demo script, Foundry resource IDs, learning log
```

The functions live in a separate repo, `clearspend-functions`, which Foundry hosts, builds, and runs.

---

## Running it

**Prerequisites:** Node 22.13 (`mise install`), access to the Foundry enrollment, and a Foundry token in the
`FOUNDRY_TOKEN` environment variable. The token is never written to a file; `.npmrc` reads it to install the
generated SDKs.

```bash
npm install
npm run dev -w @clearspend/web     # staff app on http://localhost:8080
npm run dev:supplier               # supplier site on http://localhost:8081
```

| Command | What it does |
|---|---|
| `npm test` | All tests: domain rules, fixtures, the domain copy drift check |
| `npm run typecheck` | Type checks |
| `npm run portfolio:generate` | Regenerates the 22 programs (deterministic) |
| `npm run portfolio:import -- --country MDG` | Imports a program through the real Actions |
| `npm run portfolio:check -- --foundry` | Parity: Foundry's stored costs equal the local rules |
| `npm run test:offers` · `test:investigations` · `test:target` | Real-run checks against Foundry |
| `npm run demo:reset -- --country KEN --apply` | Removes a rehearsal's investigations, bookings, offers, and AI runs for 1 country |
| `npm run functions:harness` · `functions:typecheck` | Type-checks the functions repo locally |

The click-through is in [`docs/demo-script.md`](docs/demo-script.md). Every decision and its reason is in
[`docs/design/review-log.md`](docs/design/review-log.md).

---

## Limits

- The data is synthetic except Madagascar's WFP market prices. Market sizes are declared estimates.
- The supplier site's scope enforcement is designed but not yet measured under its own sign-in.
- A confirmed incident cause or a sourcing decision changes the cost history and cannot be reset; rehearse those on
  another country.
- The front ends run locally; hosting them on Foundry has not been tried.
