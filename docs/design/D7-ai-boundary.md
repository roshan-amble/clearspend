# D7: AI boundary

Status: approved by Roshan on 2026-09-30, with the recommended default (A) for every decision. The questions he deferred stay open.
Requirements addressed: brief section 9 (the 3 AIP jobs, the rules for every job, evaluation scope), section 11
scenarios 4, 6, and 10, Appendix A.5, D1 quality need 1, D2 decision 9 and trust boundary 3, D3 (`CsAiRun`,
`CsCauseProposal`, `CsOutreachMessage`), D5 (incident cause, outreach), D6 (D6.3, I6, I7, I9, I10), D9.
Context and constraints: [platform-facts.md](platform-facts.md), sections "Functions and AIP", "Failure types",
and the facts verified on 2026-09-29 and 2026-09-30.

## Platform facts this record relies on

| Fact | Label |
|---|---|
| A TypeScript function that calls GPT-4o, and an AIP Logic function, both work from an OSDK app. GPT-4o took about 3 seconds. | Verified (smoke test) |
| A Logic function can back an Action. To edit the Ontology, a Logic function must be published and called from an Action. A Logic function can call other functions. [S7] | Documented |
| A TypeScript v2 function can call a published query function, including a Logic function with an API name, through the OSDK client, when it is in the repository's resource imports. | Documented (template AGENTS.md) |
| Logic has a structured output mode and a validator option. The Problems tab can be green while the published function fails. | Documented / Verified |
| Each function's dependencies, including its model, must be in the Developer Console app's scope, or the app gets `400 QueryRuntimeError ... ModelNotFound`. | Verified |
| A function runs with the caller's scopes. Under the app's sign-in, the Admin API returned 403 inside a function (2026-09-30). | Verified |
| Whether calling a Logic function or a model under the app's ontology-only OAuth scopes needs another scope. | Not tested |
| By default the platform does not retry an Action that makes external calls. | Documented [S6] |

## Mechanism

1. **3 jobs, 1 shape.** Cause proposal (9.1), profile extraction (9.2), comparison explanation (9.3). The outreach
   draft of D3 is a 4th job, deferred to Phase 4 (D7.6).
2. **Inputs come from stored evidence only.** The server function loads the objects at 1 evidence revision and
   builds the model input. The browser sends only IDs. It never sends evidence text or a model output.
3. **Source text is data.** Each document and profile goes into the prompt inside a delimited block with its
   evidence ID. The instructions say that text inside a block is never an instruction (brief section 9).
4. **The output is validated in `packages/domain`,** a pure function tested locally, before anything is stored as
   valid (D7.3).
5. **Storage (D3).** Every run writes 1 `CsAiRun`: job, subject, evidence revision, Logic function version, model,
   status `SUCCEEDED`, `INVALID`, or `FAILED`, the reasons, the validated output, and token use. A valid cause
   proposal also writes `CsCauseProposal` with `source = AI`. Extraction and explanation stay as JSON on the run.
6. **Effect: none.** No job writes a metric, an eligibility, a decision, or `CsExpansion` (D6.3, I7, I10). The
   cost model reads only `RULE` causes and `CONFIRM_CAUSE` decisions.
7. **States shown.** Pending: the Action is running. Current: the run's revision equals the expansion's evidence
   revision. Historical: an older revision (I6). Invalid and failed: shown with their reasons, never replaced.
8. **Actor.** The start Action takes `actorUserId` with the submission criterion "equals the current user", the
   same fallback as the cause confirmation (D6, 2026-09-30).

## Decisions for Roshan

**D7.1 Where the model call runs.** Changed on 2026-09-30: Roshan chose B, because Palantir MCP cannot build AIP
Logic functions, and A would cost him about 45 minutes in the Logic UI.
- **A (recommended):** an AIP Logic function makes the model call (D2 decision 9). A TypeScript v2 function builds
  the input from stored objects, calls the Logic function, validates the output, and returns the edits. Cost: 2
  functions, and both, plus the model, must be in the app's scope.
- B: the TypeScript function calls the model directly (`@osdk/language-models`). Cost: changes D2 decision 9, and
  loses Logic's preview, trace, and eval cases.
- C: the Logic function backs the Action and writes the edits itself. Cost: the validation lives in no-code
  blocks, not in tested domain code.

**D7.2 How a run starts and is stored.**
- **A (recommended):** 1 Action per job (`cs-start-ai-job`, with the job as a parameter). Its function runs the
  model and writes `CsAiRun` and, if valid, the proposal, in 1 atomic edit. Cost: the Action lasts a few seconds,
  and the platform does not retry it (external call).
- B: the app calls a query function, then an Action stores the output. Cost: the model output passes through the
  browser, so the server cannot prove it came from the model (trust boundary 1).

**D7.3 Validation before "valid".**
- **A (recommended):** Logic structured output per job (Appendix A.5 shape), then a domain validator: schema,
  allowed enums, citations only from the evidence IDs that were sent, the input revision echoed back, output size
  at most 20 KB, and no field that could carry a metric. Any failure: `INVALID` with the reasons.
- B: only Logic's validator option. Cost: the rules are not versioned or unit-tested in `packages/domain`.

**D7.4 Input limits.**
- **A (recommended):** at most 4,000 characters for each document or profile and 20,000 in total. The run records
  what was cut. Cost: a long document can lose its end, and the run says so.
- B: no limit. Cost: a context-window failure (`LmsContextWindowExceeded`, not retryable) and a larger cost.

**D7.5 Model.**
- **A (recommended):** GPT-4o, verified on this enrollment. Cost: none known.
- B: an Anthropic model from "Palantir provided". Cost: its quota on this tier is not tested.

**D7.6 Scope for Phase 3.**
- **A (recommended):** the 3 jobs of brief section 9 now. The outreach draft waits for Phase 4 and D8.
- B: all 4 jobs now. Cost: more work before the onsite, and outreach needs the notification checks of D6.6.

**D7.7 Evaluation.**
- **A (recommended):** a script runs the 4 cases of brief section 9 against the real functions and stores each
  result in `docs/validation.md`: INC-A4 cites both documents and does not state supplier fault as a fact; SUP-L1
  French fields match the human-written fields; SUP-L5 instruction text is flagged and changes nothing; SUP-L1
  against SUP-L6 is reviewed by Roshan for polish bias. No accuracy percentages.
- B: AIP Evals. Cost: availability on this tier is not tested.

## Open questions for Roshan (deferred, not chosen)

- What "AI-managed dashboard" means (D1 quality need 3). D1 options: A, the AI writes explanations and highlights;
  B, A plus rankings shown as proposals; C, the AI calculates or changes numbers. Fact, not a choice: C would
  contradict brief section 9 ("No AIP output changes a metric").
- The third quality need: traceable decisions, honest uncertainty, speed, or availability.

These 2 answers affect only how AI output is presented on Screen A. The 3 jobs, their inputs, validation,
storage, states, scopes, and evaluation above do not depend on them, and are fully specified by brief section 9.
Recommendation: build the 3 jobs now, and decide the 2 questions before Screen A shows AI output.

## Consequences and accepted risks

- Citation validation checks that a cited ID was sent, not that it supports the claim. Roshan reviews that.
- A synchronous Action makes the person wait a few seconds for each run.

## Amendment, 2026-10-01: 2 portfolio jobs (P7, P8)

Roshan chose 2 more jobs, with the same mechanism: 1 Action (`cs-start-ai-job`), inputs built on the server from
stored objects, domain validation, 1 `CsAiRun`, no effect until a person acts.

- **RANKING** (subject: 1 food of 1 program). Input: the supplier list of `csCountry` in words (price against the
  market and imports, what each could reasonably supply, the net cost a month), the market need and size, each lead's
  latest profile and each accepted offer's note as data. The user message lists the allowed `targets`: the market and
  every supplier not already under an open or scheduled investigation. Validation: 1 to 5 entries, each an allowed
  target, no repeats, the kind matching the target (MARKET_SURVEY for the market), every cited id sent. Effect: none;
  a person tags with `cs-tag-investigation`.
- **BOOKING** (subject: 1 open investigation). Input: the investigation, the supplier to visit, and up to 6 free trips
  from `scheduleOptions`, each with days after the earliest, travel days, busy days in the next 60 days, past
  investigations in the country, and languages assumed from the home country (generated data). The user message lists
  the allowed `investigatorIds`. Validation: the chosen id has a free trip; 1 to 5 reasons with sent ids. Effect: none;
  a person books with `cs-book-investigation`, which checks the stored calendar again. The page marks a pick that no
  longer has a free trip.
- Measured before deployment (2026-10-01, a dry run through the model proxy with live inputs, nothing written):
  RANKING on Madagascar beans and rice and BOOKING on the Mozambique beans survey were SUCCEEDED in 2 to 5 seconds,
  1,300 to 2,700 tokens. The first RANKING listed profile ids as "unknowns" and gave generic reasons; the prompt now
  asks for the deciding figure and for unknowns as sentences.

## Amendment, 2026-10-02: the visit brief replaces the ranking (P16)

- Principle, chosen by Roshan: code handles numbers, AI handles text. Ranking suppliers by saving is arithmetic, so
  code does it (`foodStep().check`: the biggest saving that is neither verified nor under investigation). RANKING is
  removed from `cs-start-ai-job`; its stored runs stay until a demo reset.
- **BRIEF** (subject: `FOOD:supplierLogicalId`). Input: the supplier's row of the supplier list in words, the need and
  the local market, what the program requires of the food (moisture limit), and the supplier's own text: its latest
  profile, or its offer note from the supplier site. The user message lists `supplierTextIds`. Output: a summary,
  `claims` (each with the id of 1 of those items and a verbatim `span` of it), `gaps`, and 3 to 5 `checks` with why.
  Validation: a claim that cites any other item, or whose span is not a verbatim part of the supplier's text, makes the
  run INVALID; fewer than 3 or more than 5 checks is INVALID; every cited id was sent. Effect: none; a person tags the
  visit with `cs-tag-investigation`. The brief is shown where a person opens Investigate and on the investigation.
- Where AI appears now: the visit brief (text of 1 supplier), who to book (a soft trade-off among free trips), the
  cause proposal (conflicting incident documents), and the earlier profile extraction, explanation, and outreach
  draft. AI ranks nothing and calculates nothing.
- Measured before deployment (dry run through the model proxy, nothing written): BRIEF on Kenya rice SUP-L1 was
  SUCCEEDED in 6.4 seconds, 1,431 tokens, with 3 verbatim claims, 5 gaps, and 5 checks.
- Measured after deployment (2026-10-02, through `cs-start-ai-job` on functions 0.8.0): BRIEF on Mali sorghum SUP-L1
  was SUCCEEDED in 6.0 seconds with 3 claims quoted verbatim from a French profile; RANKING was refused.

## Amendment, 2026-10-02: the AI analysis (P18)

- **ANALYSIS** (subject: the expansion). Input: the program's recommended steps, which rules found with exact numbers
  (`countrySteps`), and 1 or 2 sentences of program facts written by code (`analysisFacts`). The user message lists
  every step with its group. Output: a summary, and every step once with its group and 1 sentence of why.
- Validation: a step the rules did not find, a step moved to another group, a step left out, a repeated step, or a
  number in the summary or a why that is not in the evidence (counts up to 12 aside) makes the run INVALID. Effect:
  none; each step links to the page where a person acts.
- The page shows the AI order only while the run covers exactly the current steps; otherwise it says the steps
  changed and shows the rules' order.
- Measured before deployment (dry run through the model proxy, live inputs, nothing written): Kenya (6 steps) and
  Madagascar (6 steps) were SUCCEEDED in about 2.6 and 2.9 seconds, 1,260 and 1,247 tokens.
- Measured after deployment (2026-10-02, through `cs-start-ai-job` on functions 0.9.0): ANALYSIS on Mali (5 steps) was
  SUCCEEDED in 9.6 seconds; every figure it used came from the steps.

## Help received

Claude drafted this record, with options and a recommended default for each decision. Roshan decides.
