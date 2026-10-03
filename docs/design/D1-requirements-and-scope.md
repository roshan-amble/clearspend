# D1: Requirements and scope

Status: approved by Roshan on 2026-09-28, with 1 question deferred to D7. See "Open questions".
Author: Roshan Amble. Claude wrote down Roshan's choices from the guided session on 2026-09-27.
Requirements addressed: brief sections 1 to 3 and 10.
Context and constraints: [platform-facts.md](platform-facts.md). Region: Androy, Madagascar.

## Users and their decisions (choice 1.1 B)

| Role | Decides | Writes |
|---|---|---|
| Supply chain manager | Which suppliers to contact and verify. Which AI proposals to approve. | Starts AI jobs, approves AI proposals, approves outreach, records sourcing decisions |
| Finance manager | Nothing in the app. Reads costs and decisions. | None |
| Field verifier | The result of an in-person supplier visit | Records field verification results |

## What the app can write (choice 1.2 C)

- ClearSpend never writes money. No payments and no purchase orders, ever. This holds even when a user's
  own permissions allow a purchase: the app's scope contains no purchase Action.
- Allowed writes: decision records, AI job runs, approvals of AI proposals, field verification results,
  and outreach messages to suppliers.
- Each write goes through a server-side permission check.
- An AI output changes nothing until a person approves it.
- An outreach message goes out only after a person approves it. In the demo, messages go only to test
  inboxes that Roshan controls, never to a real business.

## Cost breakdown (choice 1.3: both)

- **By cause:** the price paid, failed batches that the supplier caused, and failures after handover.
- **By ingredient:** the share of each food in the cost of 1 meal. A meal has more than 1 ingredient.

Consequence: the ration is a list of ingredients with quantities. The Androy price data has 10 foods with
prices in all 12 recent months, for example rice, beans, maize, cassava, and vegetable oil. Oil is priced per
litre, not per kilogram, so the cost model needs a defined unit conversion (D11).

## Quality needs, in order (choice 1.4)

1. **Precise price discovery.** Correct numbers, exact to the cent, with no rounding errors.
2. **Production-standard authentication and backend.** Strict permissions for each role, server-side checks
   on every write, and no secrets in the browser.
3. **"AI-managed dashboard".** Open. Its meaning is not agreed yet. See "Open questions".

## Scale (choice 1.5 B)

Build a prototype: 1 nonprofit, 1 region, a few foods, about 10 suppliers, and a few users.
No design choice may break at a real nonprofit's size: about 5 regions, 20 foods, 500 suppliers,
10,000 purchases each year, and 20 users. Many nonprofits and 1,000 times the data are for D10 only.

## Non-goals (choice 1.6)

- No payments and no purchase orders.
- No messages to real businesses in the demo. This replaces the brief's "no messages to suppliers in v1",
  because choice 1.2 C allows outreach.
- No real supplier data.
- No public view in v1.
- No quality score from the AI.
- No market forecast.

## Consequences and accepted risks

- The scope is larger than brief v3: several ingredients instead of 1, and outreach messages that go out.
  The brief's scope and time sections need an update when step 1 closes.
- Outreach creates 2 risks for step 8: a message that goes out twice, and a message to a real business.
- Unknown: whether the Foundry tier can send email from an Action. Claude checks before step 6.

## Open questions

- Deferred to D7: what does "AI-managed dashboard" mean? It must not conflict with need 1, correct numbers.
  Options given: A, the AI writes explanations and highlights; B, A plus rankings shown as proposals;
  C, the AI calculates or changes numbers.
- Deferred to D7: the third quality need, from traceable decisions, honest uncertainty, speed, or availability.

## Amendment, 2026-10-01: a portfolio of country programs (P1)

Roshan widened the scope from 1 expansion to a portfolio: 22 country programs, each an expansion on the same cost
engine, Actions, and D6 rules. Madagascar (Androy) is the new program: menus and 13 supplier leads, no supplier yet,
so the story is the supplier decisions. The other 21 programs carry generated purchase histories (synthetic, labeled)
with failures, unconfirmed causes, prices above market, and cheaper leads, so the portfolio has something to say.
New in scope: meals with recipes shared across foods, nutrition against a reference, deterministic recommendations,
and investigations booked with field investigators. Still out of scope: payments, purchase orders, and messages to
anyone but Roshan (D1 hard limits unchanged).

## Amendment, 2026-10-01: WFP-style activities (P5, P6)

Harbor Meals stays the name, now described as a WFP-style food assistance organization. Each country program runs up
to 3 activities: school meals, general food distribution (a full daily ration for refugees and displaced people),
and nutrition support (Super Cereal for children aged 6 to 23 months). The portfolio counts people reached across
activities, not students. Caseloads are synthetic. The purchase histories did not change: the general and nutrition
rations add food needs on top of the same cost data, so large general distributions can outgrow local markets, which
the sourcing plan then shows.

## Help received

Level 4 on all parts: Claude gave options with costs, and no recommendation. Roshan chose each option.
