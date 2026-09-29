# Platform facts for the ClearSpend design

These facts constrain Roshan's design records D1 to D11. Claude collected them in Phase 0.
Each fact has 1 label:

- **Verified**: seen on Roshan's enrollment during the Phase 0 smoke test, 2026-09-26 and 2026-09-27.
- **Documented**: read in official documentation or in a platform screen. Not tested yet.

The smoke test used the "OSDK with AIP Logic" To Do example in the Foundry project `OSDK Sandbox`.
The code is in `~/Developer/osdk-sandbox/todo-aip-app`. It is not part of ClearSpend.

## Enrollment

| Fact | Label | Record |
|---|---|---|
| Foundry URL: `https://roshan-amble.usw-3.palantirfoundry.com`. | Verified | D2 |
| The enrollment has 1 Ontology, `roshan-amble Ontology`, RID `ri.ontology.main.ontology.17eb06bc-5728-411d-bcd2-772e1b451f20`. All projects share it. | Verified | D3 |
| A project separates files and permissions. It does not separate Ontology types. An install prefix, for example `example-yu41`, keeps types apart. | Verified | D3 |
| The Ontology already holds other examples, for example a flight dataset with 1.7 million objects. | Verified | D3 |
| Ontology changes can go through Proposals, and there is a `Main` branch selector. | Documented | D3 |
| Project templates: "Sandbox" (everyone in the enrollment can access) and "Production" (owner, builder, and user groups). | Verified | D9 |
| The Foundry project `ClearSpend` exists and is empty. It stays empty until D3 is approved. | Verified | D3 |

## Data and Ontology

| Fact | Label | Record |
|---|---|---|
| A dataset backs each object type, for example `to_do_application_task` backs the task type. | Verified | D3 |
| An Action type has its own submit permission for each user. | Verified | D9 |
| An Action can return its edits. The OSDK result has `type: "edits"` and `addedObjects`, each with `primaryKey` and `objectType`. | Verified | D6 |
| A write through an Action is visible after a page reload. | Verified | D6 |
| With Object Storage V2, an Action loads each object at 1 version for the whole apply. It checks versions only on the objects that it uses to generate edits. | Documented | D6 |
| A conflict is checked per object, not per property. A concurrent edit to any property of the same object can fail the Action with a StaleObject conflict. | Documented | D6, D8 |
| Action isolation and conflict behavior on this enrollment. | Not tested | D6 |
| An Action notification goes only to Foundry users. A recipient must be a Foundry user ID. A plain email address receives nothing. | Documented | D2, D6 |
| A webhook can call a system outside Foundry, for example an email service. A side-effect webhook runs after the edits are saved, best-effort, in no fixed order. | Documented | D2, D6, D8 |
| Webhooks need an external source to be configured. Availability on the dev tier is not tested. | Not tested | D2 |

## Access

| Fact | Label | Record |
|---|---|---|
| App access = OAuth scopes ∩ app resource restrictions ∩ the signed-in user's permissions. | Verified | D9 |
| The browser uses a public OAuth client with the authorization code grant. There is no secret in the browser. | Verified | D2, D9 |
| The consent screen lists the OAuth scopes. The app also receives the user's name and email. | Verified | D9 |
| The app's resource restrictions were "Restricted". The marking restrictions were "Unrestricted". | Verified | D9 |
| Each function's dependencies, including its model, must be in the app's restricted scope. | Verified | D9 |
| A model missing from the app's scope returns `400 QueryRuntimeError` with `ModelNotFound`. The same function passes in the Logic editor preview, which uses the full user session. | Verified | D8, D9 |
| A new published Logic version can add dependencies. Developer Console then shows "Review resources" again. | Verified | D8, D9 |
| The Developer Console lesson page shows a live session token. User tokens are under Account, Settings, Tokens, and can be revoked there. | Verified | D9 |

## Functions and AIP

| Fact | Label | Record |
|---|---|---|
| 2 function kinds work from the app: a TypeScript function that calls GPT-4o, and an AIP Logic function. | Verified | D7 |
| The OSDK calls `client(fn).executeFunction(params)`. When `isFixedVersion` is `false`, Foundry runs the latest published version. | Verified | D7 |
| A Logic function is a chain of blocks. In the example, 6 blocks are deterministic and only the last block calls the model. | Verified | D7 |
| Logic has a structured output mode, a validator option, and a "Single completion" strategy with no tools. | Documented | D7 |
| The Logic preview does not apply Ontology edits. It shows a debugger for each block, a trace, and token use. A preview run can become an eval test case. | Verified | D7 |
| The Logic editor's Problems tab showed no problem while the published function failed at run time. | Verified | D8 |
| GPT-4o in the example took about 3 seconds for 1 summary. | Verified | D8 |
| Model picker: OpenAI and Anthropic models under "Palantir provided", and a "Registered" tab. Quota for each model on the free tier is not tested. | Documented | D7 |
| GPT-4o limits shown: 128K context, 16K output, 400K tokens and 800 requests per minute. | Documented | D7, D8 |

## Failure types from the model dependency list

| Kind | Examples | Record |
|---|---|---|
| Can be retried | `LmsRetryableServerError`, `LmsRetryableNetworkError`, rate limits at user, project, enrollment, portal, and hub level | D8 |
| Cannot be retried | `LmsContextWindowExceeded`, `PermissionDenied` | D8 |

## Development environment

| Fact | Label | Record |
|---|---|---|
| In development, the app calls `localhost:8080`, and the Vite dev server passes the calls to Foundry. | Verified | D2 |
| In production, an administrator must allowlist the app's domain on the CORS settings page. | Documented | D2 |
| Developer Console offers Website hosting for the React app. | Documented | D2 |
| Website hosting serves static assets only. It runs no server-side code: no Node.js backend and no server-side rendering. A single-page app is supported: unknown paths go to `index.html`. | Documented | D2 |
| A back-end TypeScript application can use the OSDK from a server outside Foundry. Foundry has a bootstrap guide for it. | Documented | D2, D9 |
| OSDK 2.1 and later can subscribe to an object set over a WebSocket. It reports added, changed, and deleted objects. | Documented | D2, D6 |
| The generated SDK package installs from a private Foundry npm registry. `.npmrc` reads the token from `${FOUNDRY_TOKEN}` and stores no token. | Verified | D2 |
| On Roshan's Mac, Node 22.13.0 comes from mise and is set only in the Opstastic repository. A folder outside it needs its own `mise.toml`. | Verified | D2 |

## Public price data and the selected region

Source: WFP food prices for Madagascar, from HDX. Roshan downloaded it in a browser on 2026-09-27, because
HDX refused Claude's tools with a 403 error. File: `data/public/wfp_food_prices_mdg.csv`, 38,597 rows,
from 2004-01-15 to 2026-08-15.

| Fact | Label | Record |
|---|---|---|
| Columns: `date, admin1, admin2, market, market_id, latitude, longitude, category, commodity, commodity_id, unit, priceflag, pricetype, currency, price, usdprice`. | Verified | D4 |
| The file gives a `usdprice` for each row, so ClearSpend needs no exchange rate of its own. | Verified | D11 |
| Rice has 3 series: `Rice (local)` and `Rice (imported)` at retail per kg, and `Rice (paddy)` at producer price. | Verified | D4, D11 |
| Androy, Anosy, and Atsimo Andrefana have rice prices in all 20 months from 2025-01 to 2026-08. | Verified | D1 |
| The prices are monthly retail market prices. They are not supplier or wholesale prices. | Verified | D11 |
| The license is Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO). It requires attribution, so the app and the video show "Source: WFP, via HDX". | Verified: Roshan read it on the Madagascar dataset page on 2026-09-27. | D1 |

Last 12 months, median USD per kg, with the number of markets that reported:

| Region | Markets with local and imported | Local 2025-09 | Local 2026-08 | Imported 2025-09 | Imported 2026-08 |
|---|---:|---|---|---|---|
| Androy | 51 of 52 | 0.71 (25) | 0.81 (21), +14% | 0.70 (25) | 0.65 (23), −7% |
| Anosy | 46 of 47 | 0.665 (30) | 0.53 (5), −20% | 0.64 (30) | 0.54 (6), −16% |
| Atsimo Andrefana | 100 of 101 | 0.71 (66) | 0.61 (11), −14% | 0.67 (66) | 0.65 (10), −3% |

**Selected region: Androy.** Claude selected it in Phase 0. Roshan can change it in D1.

- It has both rice series in all 12 recent months, in 51 of its 52 markets.
- Its latest month still has 21 to 23 markets. Anosy dropped to 5 or 6, and Atsimo Andrefana to 10 or 11.
- Its local rice price rose 14% while imported rice fell 7%. So the market pressure panel has a real signal to explain.

NOTE: The brief's synthetic prices, 80 cents per kg for the import route and 55 to 70 cents for local quotes,
sit next to real retail prices of 0.65 to 0.81 USD per kg. The demo must not contradict the real data beside
it. Calibrating the synthetic prices is a D11 decision for Roshan.

## Development tools

| Fact | Label | Record |
|---|---|---|
| Palantir MCP (`npx -y palantir-mcp --foundry-api-url https://<host>`) works with Claude Code. It needs a user token in `FOUNDRY_TOKEN`, and an administrator must enable it in Control Panel under Code Repositories. | Documented | D2 |
| Its tools create or update object types, link types, and Action types on a branch, create datasets from CSV files, and create global branches and proposals. It cannot write object data. It has no tool for TypeScript Functions repositories. | Documented | D2, D3 |
| A SuperRepo holds Ontology definitions as code, Functions, and a React app in 1 repository. It is in beta and can be missing from an enrollment. | Documented | D2 |
| Palantir MCP works on this enrollment with `FOUNDRY_TOKEN`. It found the `ClearSpend` project and created the dataset `cs_market_price` in it on 2026-09-28. | Verified | D2, D4 |
| The enrollment serves the Foundry CLI installer (`/code/api/extension/install-script`, HTTP 200) and the macOS arm64 CLI binary (186 MB). The CLI is downloaded from the enrollment, not from a package manager. | Verified: Claude downloaded both on 2026-09-28, installed nothing, and deleted the binary. | D2 |
| The CLI binary is ad-hoc signed, with no Team ID. macOS Gatekeeper (`spctl`) rejects it. It runs only because `curl` sets no quarantine flag. | Verified | D2 |
| `foundry login` stores the credentials that every later CLI command uses. With `FOUNDRY_TOKEN` and `--foundry-url` it signs in without prompts. Where it stores them is not documented. | Documented | D2 |
| A SuperRepo deploys as a Marketplace product with `foundry deploy` and an `env.yml` file. | Documented | D2 |
| TypeScript v2 functions generate a local OSDK from their resource imports. A functions repository can install npm packages from Foundry and from npmjs.com. Only pure JavaScript packages work. | Documented | D2 |

## Not yet known

- Whether `foundry create` and `foundry deploy` work on this enrollment, and whether a SuperRepo function can import
  a workspace package such as `packages/domain`. The CLI is served, but it was not installed or run.
- Action isolation, conflict, and retry behavior.
- Model quota on the free tier.
