# ClearSpend: instructions for Claude

ClearSpend is Roshan Amble's optional Build with AIP project for his Palantir SWE intern onsite on
2026-10-05. It is sourcing intelligence for a fictional nonprofit, Harbor Meals, that expands school meals to
the Androy region of Madagascar. It runs on Palantir Foundry and AIP. It is not part of Opstastic.

## Read first

1. `docs/progress.md`: where the project is and what is next.
2. `docs/design/`: the approved design records D1 to D5 and D11, and `platform-facts.md`.
3. `docs/brief.md`: the full brief. **If the brief and an approved design record disagree, the record wins.**

## How we work

- Roshan makes the architecture decisions. Give him 2 or 3 options with costs and a recommended default,
  so he can decide fast. Claude drafts the detailed records and the code, and Roshan approves them.
- Never choose a decision that Roshan deferred. See "Open questions" in `docs/progress.md`.
- Keep answers short. Start each message with 5 lines: STATE, ON MY SCREEN, WILL NOT WORK, DEBT ADDED,
  DECISION NEEDED. Write UNMEASURED for anything not measured.
- Do not commit or push unless Roshan asks. Ask for his git email before the first commit.
- Keep `docs/learning-log.md` honest about who wrote what.

## Hard rules

- Foundry is the system of record. No second database.
- ClearSpend never writes money: no payments and no purchase orders. Outreach goes only to Roshan's own
  Foundry user in the demo.
- An AI output changes nothing until a person approves it.
- `packages/domain` imports no React, OSDK, or platform SDK. All money and quantities are exact: integers and
  `Fraction`, never floating point.
- Tokens stay in environment variables. Never write a token into a file or ask Roshan to paste one.
- Every object type has the API name prefix `Cs`, because the Ontology is shared with other examples.

## Platform lessons from the smoke test

- App access = OAuth scopes ∩ the app's restricted resource scope ∩ the user's permissions.
- A function's model is a dependency that must be in the app's scope. If it is missing, the app gets
  `400 QueryRuntimeError ... ModelNotFound`, while the Logic editor preview passes. Fix it in Developer
  Console: OAuth & restrictions, Review resources, Update dependencies.
- The Logic editor's Problems tab can be green while the published function fails. Only a real run proves it.
- HDX refuses automated downloads. Roshan downloads public data in a browser.

## Commands

- `npm test` runs the domain tests. `npm run typecheck` checks types. Node 22.13.0 comes from `mise.toml`.

## Palantir MCP

`.mcp.json` starts `palantir-mcp` with the token from the `FOUNDRY_TOKEN` environment variable. It can create
object types, link types, Action types, and datasets from CSV files, on a branch. It cannot write object data.
