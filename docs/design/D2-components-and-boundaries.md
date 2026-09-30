# D2: Components and trust boundaries

Status: approved by Roshan on 2026-09-28. Roshan accepted the recommended default for all 7 decisions.
Decision 10 added on 2026-09-28: Roshan chose the recommended option.
Requirements addressed: D1, brief sections 6 and 10.
Context and constraints: [platform-facts.md](platform-facts.md).

## Decisions

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Rendering | React single-page app, built with Vite, hosted on Foundry Website hosting | An internal tool behind a sign-in needs no SEO. Foundry hosting runs no server-side code. |
| 2 | API layer | No custom API. The browser calls Foundry through the generated OSDK. | Foundry checks the app scope and the user's permissions on every call. A custom server would have to rebuild that. |
| 3 | Business logic | TypeScript Functions in Foundry, with 1 shared domain package | Numbers calculated in the browser cannot be trusted. |
| 4 | Storage | Ontology objects, backed by Foundry datasets | Foundry is the system of record. A second database would make Foundry decorative. |
| 5 | Data freshness | OSDK WebSocket subscriptions on the comparison screen. Load on open and reload after each write elsewhere. | The stale-analysis moment shows live. |
| 6 | Data import | A script that uploads reference data and applies import Actions for evidence | Each demo reset repeats exactly. |
| 7 | Outreach email | A Foundry notification to Roshan's own Foundry user, as the test inbox | No outside system. It cannot reach a real business. |
| 8 | Repository | npm workspaces | The same tool as Opstastic. |
| 9 | AI jobs | AIP Logic functions | The same kind as the smoke test. |
| 10 | Domain code in Functions | A Foundry TypeScript v2 functions repository. A script copies `packages/domain/src` into its `src/domain/` folder with its SHA-256 digest. (Not `src/generated/`: the template's `.gitignore` excludes it.) A test in this repository fails if the copy differs from the source. Object types are created with Palantir MCP on a Foundry branch. | TypeScript v2 functions are generally available. SuperRepo is beta, its CLI is not notarized, and `foundry login` stores credentials on disk. A published npm package needs a publish for each rule change. The copy is generated, so the brief's rule against 2 hand-copied rules holds. |

## Components

```
 BROWSER (untrusted)                       FOUNDRY (trusted)
 ┌──────────────────────────┐              ┌───────────────────────────────────────────┐
 │ apps/web                 │   OSDK       │ Ontology objects (D3), on datasets         │
 │ React single-page app    │─────────────►│   reads, and WebSocket subscriptions       │
 │ public OAuth client      │  user token  │                                             │
 │ no secrets               │─────────────►│ Actions (the ONLY write path)               │
 │                          │              │   role rules + revision check               │
 │ shows numbers, never     │              │   function-backed ──► TypeScript Functions  │
 │ calculates them          │              │                        └─ packages/domain   │
 └──────────────────────────┘              │                                             │
                                           │ AIP Logic functions (3 AI jobs)             │
 DEVELOPER MACHINE (trusted operator)      │   output ──► proposal objects only          │
 ┌──────────────────────────┐              │                                             │
 │ scripts/import           │─────────────►│ Notification side effect ──► Roshan's user  │
 │ user token in env only   │  Platform    └───────────────────────────────────────────┘
 └──────────────────────────┘  SDK + Actions
```

| Component | Responsibility | Must never |
|---|---|---|
| `apps/web` | Screens, sign-in, loading, error, and stale states. Calls reads, Actions, and Logic functions through the OSDK. | Calculate a displayed number, or write outside an Action |
| `packages/domain` | Pure TypeScript: reconciliation, cost model, cause rules, eligibility, and status transitions | Import React, the OSDK, or a platform SDK |
| Foundry Functions | Load trusted data, call `packages/domain`, and return edits for Actions | Trust a value that the browser calculated |
| Actions | The only write path. Check the role, the revision, and the request ID. | Move money or create a purchase order |
| AIP Logic functions | The 3 AI jobs of brief section 9 | Change a metric, an eligibility, or a decision |
| `scripts/import` | Upload reference data and apply import Actions for evidence | Run in the browser, or be committed with a token |

## Trust boundaries

1. **Browser to Foundry.** The browser is untrusted. It holds only the user's OAuth token. Foundry enforces
   the overlap of the OAuth scopes, the app's restricted scope, and the user's permissions.
2. **Action boundary.** Each Action recalculates or checks everything that matters on the server. A value
   from the browser is a request, not a fact.
3. **Model boundary.** A model output is untrusted data. It is validated and stored as a proposal.
4. **Outside Foundry.** In v1, nothing leaves Foundry. Outreach becomes a notification to a Foundry user.

## Open questions for Claude to verify before the build

- Decided in decision 10: how Foundry Functions import `packages/domain`.
- Whether an Action can be backed by an AIP Logic function that writes a proposal object. The AIP Logic home
  page says "Use your Logic function in Actions or Automations".
- Whether Website hosting and notification side effects work on the dev tier.

## Help received

Level 5: Claude gave a recommended default for each decision, and Roshan accepted all of them.
