# D9: Access and data exposure

Status: approved by Roshan on 2026-09-28. He chose A for D9.1 to D9.4.
See [review-log.md](review-log.md).
Requirements addressed: brief sections 10 and 14, D1 roles and quality need 2, D2 trust boundaries,
D5 "Who can do what".
Context and constraints: [platform-facts.md](platform-facts.md), section "Access".

## Principals

| Principal | In Foundry | Can write |
|---|---|---|
| Supply chain manager | Group `clearspend-supply-chain-managers` | The D5 rows for this role |
| Field verifier | Group `clearspend-field-verifiers` | Record a field verification |
| Finance manager | Group `clearspend-finance-managers` | Nothing. No Action names this group. |
| Evidence importer | Group `clearspend-evidence-importers`, used only by the import script (D9.2) | The import Action `csImportEvidenceBatch`, and nothing else |
| The app | A public OAuth client, authorization code grant | Nothing by itself. It acts only as the signed-in user. |

Whether the dev tier lets Roshan create groups: Not tested.

## Where each check runs

Access is the overlap of 3 layers (Verified), plus 1 check for each Action.

| Layer | ClearSpend setting | Label |
|---|---|---|
| OAuth operation scopes | Ontology read and write only. No dataset, admin, or other scope. The exact scope names come from Developer Console when the app is created. | Not tested |
| App resource restrictions | "Restricted". It holds the `Cs` object and link types, the app's Actions, its functions, and each function's model. A model missing from the scope gives `400 QueryRuntimeError ... ModelNotFound`. After each new Logic version: Developer Console, OAuth & restrictions, Review resources, Update dependencies. | Verified |
| User permissions | ClearSpend project: the 3 groups are Viewers, and Roshan is the Owner. Objects follow their backing dataset, so a Viewer on the dataset sees the objects. | Documented |
| Action submission criteria | "Current user is a member of group X", for each Action, from the D5 table. No `NOT` condition: the docs warn that a scoped token can make a `NOT` pass. | Documented |

- No purchase or payment Action exists, so none can be in the app's scope (D1).
- The import Action is not in the app's scope. Only the script can apply it, with Roshan's own token.
- `actorUserId` comes from the platform, never from a browser parameter (D6 open question).

## What the browser can read

- Every `Cs` object that the signed-in user can see, through the OSDK only. The app has no dataset scope.
- All 3 roles read everything (D5). The finance manager sees costs and decisions, and writes nothing.
- Market prices arrive as `CsMarketPrice` objects, never as a dataset download.
- The browser shows numbers and never calculates them (D2).

## Visibility levels (brief section 14)

- v1 builds only **Private**. `CsExpansion.visibilityLevel` is `PRIVATE`, and no Action changes it in v1
  (D1: no public view).
- The supplier and public aggregate levels are extensions (brief section 15). If built, they read a separate,
  separately authorized aggregate object. They never filter private objects in the browser.

## Outreach

- The notification recipient is a **static** setting: Roshan's own Foundry user ID. It never comes from a
  parameter or from a supplier property. So a wrong supplier record cannot route a message elsewhere.
- Foundry notifications go only to Foundry users. A plain email address receives nothing (Documented).
- By default, an Action fails before any edit if a recipient cannot see the data (Documented).

## Tokens

| Where | Credential | Rule |
|---|---|---|
| Browser | The user's OAuth token from the public client | No secret. Only the client ID and the Foundry URL are configuration. |
| Scripts and Palantir MCP | A user token in `FOUNDRY_TOKEN` | Never in a file, a log, a screenshot, or the video |
| npm registry for the generated SDK | `.npmrc` reads `${FOUNDRY_TOKEN}` | Verified |
| Foundry CLI | Not used (decision of 2026-09-28) | `foundry login` stores credentials on disk |
| Palantir MCP | Writes the user token to `~/.palantir/mcp-config.json` (mode 600) when it starts | **The 1 recorded exception** to "tokens stay in environment variables" (Roshan, 2026-09-29). Revoke the token when the project ends. It expires on 2026-10-16. |
| `clearspend-functions` clone | Git helper reads `FOUNDRY_TOKEN` at run time; no token in `.git/config` or the keychain | Checked after each tool run |

## Data that leaves the governed path in v1

| Path | Leaves Foundry? |
|---|---|
| App reads and writes | No. OSDK only. |
| AI jobs (D7) | The prompt goes to the model through AIP. Where the model provider runs is not checked here. |
| Outreach notification | No. Roshan sets notifications to in-platform only (D9.4). |
| Local files | Synthetic fixtures and public market data only |
| Recording and screenshots | Synthetic data only. No token on screen. |

## Decisions

| # | Choice |
|---|---|
| D9.1 | A: submission criteria are the only role check, with a drift test against `PERMISSIONS` |
| D9.2 | A: a 4th, technical group `clearspend-evidence-importers`, used only by the import script |
| D9.3 | A: Roshan leaves the field verifier group to show a denial from the app and from a script |
| D9.4 | A: notifications stay in the platform, so nothing leaves Foundry |

The options as Roshan saw them:

**D9.1 Role check in the function.**
- **A (recommended):** submission criteria are the only enforcement. `PERMISSIONS` in `packages/domain` stays
  the 1 source of the table. A test compares it with the group criteria of each Action type, read from
  Foundry. Cost: the drift test needs a read of Action type definitions, and runs on demand.
- B: the function also reads the user's groups with the Admin API and calls `assertCanPerform`. Cost: an admin
  read scope for functions, and group IDs configured in 2 places.

**D9.2 Who may import evidence.** D5 has no row for it.
- **A (recommended):** a 4th group, `clearspend-evidence-importers`, with only Roshan in it. Cost: 1 more group.
- B: the supply chain manager group. Cost: a manager gets a power that D5 does not list.

**D9.3 Showing role enforcement with 1 person.** Roshan holds all roles in the story.
- **A (recommended):** for the proof, Roshan leaves the field verifier group, tries to record a verification
  from the app and from a script, records the denial, and joins again. The script proves that a hidden button
  is not the only barrier. Cost: group changes and their delay on the dev tier are Not tested.
- B: a 2nd Foundry user, only in the finance manager group. Cost: the dev tier may allow only 1 user (Not
  tested), and the recording needs a 2nd sign-in.
- C: no denial demo. Document that the configuration exists but the denial was not shown (brief section 10).
  Cost: a weaker proof of quality need 2.

**D9.4 Notification channel.**
- **A (recommended):** Roshan sets his notifications to in-platform only for the demo. The outreach text never
  leaves Foundry, so D2 trust boundary 4 stays true.
- B: allow email. Cost: the approved text goes to Roshan's email provider. D2 trust boundary 4 must change.

## Consequences and accepted risks

- Roshan is the Owner and holds every role. The demo proves the configuration, not separation of duties.
- A user token has all of Roshan's permissions. The scripts use it only on his machine.

## Help received

Claude drafted this record, with options and a recommended default for each decision. Roshan decides.
