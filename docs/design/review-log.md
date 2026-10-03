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

Roshan approved D6 and D9 on 2026-09-28.

## 2026-09-29: token file and function builds

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| 1 | Palantir MCP stores the token in `~/.palantir/mcp-config.json`. Accept, delete each session, or stop using the MCP? | A: accept as the 1 recorded exception, and revoke the token when the project ends | D9 "Tokens" |
| 3 | How to verify the D6 guard, given that each Action type change needs a merged proposal? | Test the real cause confirmation Action in a separate test expansion. No throwaway `CsProbe`. | D6 |
| 4 | D4 has no path for `expansion.csv` and `expansion-commodities.csv`. | The same import Action, with 2 more file kinds | D4 |
| 5 | How to keep test data apart from the demo? | The script prefixes every `source_system` and the expansion ID | D4 "Namespaces" |
| 6 | Where does `actorUserId` come from? | The function asks the platform (`Admin.Users.getCurrent`). Fallback: a "current user" parameter, after an override test | D6 open questions |
| 7 | Set the D9 group permissions before or after the first test import? | After: test with the default "organization" permission, then set the groups before the D9.3 denial proof | progress |
| 2 | `rune` fails locally. How to compile and test functions? | A: Claude pushes to `clearspend-functions`, and Foundry's checks compile and test. Roshan runs `rune` in the in-platform VS Code only for a live preview. | progress |
 The Phase 2 design gate before any Action is open.

Roshan's notes on gaps 2, 3a, 3b, and 4 arrived cut off. The "Roshan's answer" column shows Claude's reading of them.

## 2026-09-30: D7 and D8

Roshan: "we are very late, continue implementation and keep me updated on blockers". He deferred Checkpoint C and
approved D7 and D8 with the recommended default for every decision. His 2 deferred D7 questions stay open: what
"AI-managed dashboard" means, and the third quality need.

D7.1 changed to B (Roshan, 2026-09-30): the AI jobs run in TypeScript functions that call GPT-4o through AIP's model
proxy, instead of AIP Logic functions, to save about 45 minutes of his time in the Logic UI. D2 decision 9 updated.

D9 amended (Roshan, 2026-09-30, option A of 3): the app also requests `api:use-language-models-execute`, and GPT-4o
is in its resource restriction. The AI job started from the browser failed with HTTP 403 without it, and the Foundry
docs require this scope for the model proxy. Rejected: B, AI jobs only from the script; C, a Foundry Automate rule.

D9 and D6 amended (Roshan, 2026-09-30): the app also requests `api:admin-read`, and every function checks the actor
with `Users.getCurrent` instead of a hand-set submission criterion. Reason, in his words: the detailed click-throughs
take the time; merge proposals are fine. Cost: the browser token can read user and group information.

## 2026-09-30: UI decisions (UI1 to UI5)

Roshan asked for evidence-based dashboard designs, chose the first concept, asked for colorful data palettes,
ingredient price charts with target against realized prices, a strong data entry page, a function behind every part,
and no white background. Then: "go with recommendations and continue building". Each answer is the recommended
default.

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| UI1 | How to build the screens? | A: the POC's design tokens in React, ECharts for charts. Dark theme by default, gray as the alternative. Rejected: B, Blueprint restyled; C, shadcn/ui with Tailwind | D2 amendment |
| UI3 | Can the data studio write? | A: a development-only route that writes only through the existing Actions, with a dry run first. The import Action joins the app scope. Rejected: B, a read-only studio | D9 amendment |
| UI4 | Where does a target price come from? | A: an edit-only `targetCentsPer1000` on `CsExpansionCommodity`, set by `cs-set-commodity-target`, display only. Rejected: B, no target; C, a derived target | D3, D11 amendments |
| UI5 | How to chart monthly prices without browser arithmetic? | A: the query function `csPriceHistory`, computed on the server. Rejected: B, store the series in each snapshot; C, drop the charts | D2 amendment |

## 2026-10-01: portfolio across countries

Roshan: "the way i am imagining the click through to work is first we have countries … each country has a card …
then you click into a country … recommended steps … at least 20 countries … madagascar … has no existing suppliers …
some nutrition thing … a scheduling thing for each investigation … it should be first class". Later: "i also want a
heatmap of each country that is clickable". Each answer is the recommended default.

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| P1 | How far should the rebuild go before the onsite? | Portfolio on the core: every country is an expansion on the existing cost engine and Actions; 5 new object types; Madagascar is the new program with leads only. Rejected: a full rebuild; a front end over generated data only | D1, D3 amendments |
| P2 | Prices for the other countries? | Generated and labeled synthetic; real WFP prices for Madagascar. Rejected: Roshan downloads about 20 HDX files | D11 note |
| P3 | Nutrition reference? | WHO/FAO for children 7 to 9, key nutrients (energy, protein, iron, vitamin A, zinc), a school meal = 30% of the daily need. Rejected: energy and protein only; a full micronutrient panel | D11 note |
| P4 | Scheduling? | The function proposes the earliest local or fly-in trip; a person books it with an Action. Rejected: auto-booking; suggestions only | D5, D6 amendments |

## 2026-10-01: WFP-style activities, not only school meals

Roshan: "this should be based off the world food programme … the WFP is not exclusively for students, fix that".

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| P5 | Which activities does each country program run? | School meals, general food distribution, and nutrition support. Rejected: adding food assistance for assets; school and general only | D1, D3, D11 amendments |
| P6 | Rename the organization? | Keep Harbor Meals, described as a WFP-style food assistance organization | none |

## 2026-10-01: supplier list, AI in investigations, and the supplier site

Roshan: "we just have an AI recommendation for who best to book. … instead of that i want front and center a simple
list of suppliers, the quantity they could supply us reasonably and what the net cost of that vs what we are currently
priced at would be and from there, we can show the recommended investigations as well as investigations into
everything (but ai recommendations come first)". Then: "also create a simple subsite where suppliers can just input
the prices that they could best profitably supply at and how much … (don't surface the wfp pricing as that can cause
gouges)".

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| P7 | "AI recommendations come first": which? | A new AI job ranks which suppliers (or the market) to investigate first, with reasons citing evidence; the rule-based recommendations follow; every supplier has Investigate. Rejected: rules first, labeled "Recommended" | D7 amendment (job RANKING); partly answers the deferred "AI-managed dashboard" question for this one place only |
| P8 | AI in scheduling? | AI recommends who to book among the free trips that code found; a person books. Rejected: an AI brief for the investigator; AI ranking across countries | D7 amendment (job BOOKING) |
| P9 | Net cost for a program with nothing paid (Madagascar)? | Against importing (WFP import median), else the local retail median; against what we pay when a supplier is paid. Rejected: local median; lowest quote | D11 amendment |
| P10 | The supplier site? | A supplier offers a price and a monthly quantity; a person accepts or rejects it; an accepted offer is an unverified lead in the supplier list and the plan, never a paid cost. Defaults stated, not asked | D3 (CsSupplierBid), D11 amendments |
| P11 | How is the supplier site kept apart from our data? | A separate Developer Console app whose scope holds only program names and the submit Action, with its own SDK and page. Rejected: a route in the current app (hidden, not protected) | D9 amendment |

Defaults stated by Claude, not asked: "could reasonably supply" is the capacity (confirmed, else claimed), at most our
need and, for a local supplier, at most 10% of the local market; net cost = (price − compared price) × that
quantity; the supplier site shows no market price, no other offer, and none of our volumes; a nutrition suggestion
adds at most 100 g (30 ml of oil) to a serving.

## 2026-10-02: reset a country after a rehearsal

Roshan: "reset the db for the kenya edits i made, i like that click through and want to preserve it … just reset that
data". ClearSpend had no way to remove anything: every write is an Action, and no Action deleted.

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| P12 | How to reset what a rehearsal wrote? | 1 guarded Action for 1 country, called only by a script: it removes that country's investigations, the calendar blocks of their bookings, its AI RANKING and BOOKING runs, and its supplier offers. Rejected: cancel only (the old AI ranking stays on the page); use another country for the demo | D8 amendment |

## 2026-10-02: workflow redesign

Roshan: "there is just too much data everywhere … too much data cluttered everywhere, and not enough of a concrete
showing or easy understanding of anything. please make this a first class software that is based off existing proven
workflows". The Madagascar page was about 5,000 pixels of stacked sections, the supplier list was repeated on the
Investigations page, and nothing said where a food stood or what to do next.

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| P13 | Which direction for the cleanup? | Workflow redesign: each food moves through the stages of a procurement process (find suppliers, compare offers, verify on the ground, decide, deliver). The program page is 1 pipeline table with a row for each food, its stage, and its next action; 1 screen for the decision on 1 food; rations, incidents, and prices behind tabs; no duplicate supplier list. Rejected: declutter in place (nothing shows where a food stands) | `workflow.ts`, the Program and Food pages |
| P14 | What does the home screen lead with? | A worklist: what needs a person now across every program, 1 button for each row; the map and 1 line for each program below it. Rejected: map first | `countryTasks`, `csPortfolio` |
| P15 | Stored test data? | Clear Laos and Zambia with the demo reset, including the 2 older Laos test investigations | none (data only) |

Defaults stated by Claude, not asked: a food that is delivered re-enters the pipeline only for a candidate at least
10% below what we pay (the CHEAPER_LEAD rule); a scheduled visit is waiting, not a task; nutrition gaps and price
trends are information on their own tab or screen, not tasks; the worklist puts a program that delivers nothing first,
then what a person has started (offers, bookings, decisions), then unconfirmed causes, then cheaper options by the
money at stake.

After seeing it (2026-10-02), Roshan reversed P14: "home was good, revert it, the heatmap first is ideal followed by
the cards". The home screen is the program map, then 1 card for each program, as before P14. The worklist is still
computed by `csPortfolio` and shown nowhere; P13 (the pipeline and the food screen) stands.

## 2026-10-02: the role of AI on the sourcing screen

Roshan, on Kenya rice: "this is confusing, what is the ai actually recommending? the savings seem obvious on which to
investigate, please solidify the role of ai in these pages". The AI ranking repeated what the table, sorted by saving,
already showed; after the top supplier was tagged it suggested a survey with a vague reason. The same screen also
showed 2 totals against 2 different prices (+$3,782 against WFP's import price, and −$32,282 against what we pay).

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| P16 | What does AI do on the food sourcing screen? | Code handles numbers; AI handles text. Code names the next supplier to check (the biggest saving that is neither verified nor under investigation). AI writes the visit brief for 1 supplier from the supplier's own profile or offer note: what it claims (verbatim quotes), what is missing or doubtful, and 3 to 5 things the investigator must confirm. The AI ranking is removed. Booking and incident-cause AI stay. Rejected: AI as a second opinion shown only when it disagrees; no AI on this screen | D7 amendment (BRIEF replaces RANKING), `workflow.ts` (`check`) |

Fixed with it, not asked: every net cost on a food's screen compares with 1 stated price (what we pay now when the
food is delivered; importing, else the local retail price, when it is not). The 3 boxes are that price, the local
plan against it, and the international price against it.

## 2026-10-02: 5 pages for each country

Roshan: "why do we have program records vs the tabs on this page. doesn't it seem kind of redundant? … there is too
much going on. we want separated workflows that are very simple. we should have for every country, some main
sections": ingredients with their sources and current and historic prices; suppliers, local against international,
who we use for how much, and the 10 percent rule; incident reports for each supplier; an AI analysis page with all
the recommended steps; tagged investigations and scheduling. "again all of this is after the heat map screen which is
heated by how many recommended actions there are … the price chart can be simple, our chart over time vs min cost".

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| P17 | The country pages? | 5 pages and nothing else: Ingredients, Suppliers, Incidents (by supplier), AI analysis, Investigations (this country only). The heat map is colored by the number of recommended actions. "Program records", the pipeline table, the separate food screen, the Rations and Prices tabs, and the sidebar Investigations page are removed. Ingredients has 1 chart: what we paid each month against the lowest market price | `workflow.ts` (steps), `history.ts` (chart), the web pages |
| P18 | Who finds the steps on the AI analysis page? | Rules find every step with exact numbers, in 3 groups (cut cost, serve more and better meals, supplier problems); AI orders and explains them. Code refuses an analysis that adds a step, moves one to another group, leaves one out, or states a number that is not in the evidence. Rejected: rules only, no AI; AI finds the steps itself | D7 amendment (ANALYSIS) |
| P19 | Rations and nutrition? | Folded in: Ingredients shows which rations use each ingredient; nutrition gaps are steps on the AI analysis page; no Rations tab. Rejected: a sixth tab; dropping nutrition | none |

Defaults stated by Claude, not asked: the lowest available price is the lowest of WFP's local and import medians and
every offer not yet bought from; Ingredients shows how far over it we pay as a percentage, because an offer is capped
by its capacity and the 10% rule, so the price gap times the whole need is not a saving; a new rule flags a supplier
whose deliveries failed because of it ("mishandling by suppliers"); recording a visit result and the sourcing
decision stay on the older program screens, unlinked, until Roshan decides where they go.

## 2026-10-02: international suppliers

Roshan: "we need to make sure that international supplier quotes and names are visible as well. like in madagascar,
some things if we buy are unsustainable locally, so a selection option … should be present to look at international
quotes and suppliers (edits to the ai decision and suppliers screen)".

| # | Question | Roshan's answer | Changed |
|---|---|---|---|
| P20 | International suppliers? | Madagascar gets 7 generated international suppliers with quotes and profiles (2 rice, 2 beans, 2 oil, 1 Super Cereal), imported through the real Action. The cheapest-first plan buys locally up to the 10% line, then from international offers cheapest first up to their capacity; what no offer covers stays at the compared price. Code names the next supplier to check on each route. The Suppliers page has a selector (all, local, international) and shows both next checks when local supply cannot cover the need; the recommended steps split such a food into a local and an international step, which the AI analysis orders and explains | D11 amendment, `generate-portfolio.ts`, `workflow.ts`, the Suppliers page |

Not changed: SUP-L11 (Indian Ocean Oils) is an importer stored as a local supplier; a supplier is an unversioned
record, so changing its route would be a conflict (D4). The new international suppliers cover oil.
