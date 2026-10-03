# D11: Cost model

Status: approved by Roshan on 2026-09-28. Claude drafted it. Amended by Claude on 2026-09-28 inside the
approved rules: the bean series, and the story numbers that the calibration rule produces. Both amendments are
marked below, for Roshan to see.
Requirements addressed: D1 cost breakdown by cause and by ingredient, D1 quality need 1 (correct numbers),
brief rules C1 to C9.

## The meal

A meal is a list of ingredients. The v1 ration is a declared fixture value, not a nutrition recommendation:

| Commodity | Quantity for each meal | Unit | Market series for the local route | Market series for the import route |
|---|---:|---|---|---|
| Rice | 100 g | kg | `Rice (local)` | `Rice (imported)` |
| Beans | 30 g | kg | `Beans (niebe, red)` | `Beans (niebe, red)` |
| Vegetable oil | 10 ml | L | `Oil (vegetable, packaged)` | `Oil (vegetable, packaged)` |

Androy has prices for all 3 series in all 12 recent months. Oil is priced per litre, so the unit is millilitres,
never grams. The model never mixes units.

**Amendment:** the first draft used `Beans (niebe, white)`. That series has only 2 to 12 reporting markets in
each month since February 2026. `Beans (niebe, red)` has 20 to 32, so the model uses it.

## Formulas

For supplier `s` and commodity `c`, over reconciled purchases only (C2):

```
 nominal(s,c)  = Σ paid for accepted batches              / Σ accepted quantity
 supplier(s,c) = (Σ paid for accepted batches
                + Σ paid for batches with cause SUPPLIER) / Σ accepted quantity
 route(s,c)    = (supplier numerator
                + Σ paid for batches with any other cause) / Σ usable quantity
```

- A batch with an unconfirmed cause gives a range: low without it, high with it (C5).
- **Cost for each meal** = Σ over ingredients of (quantity for each meal × cost for each unit).
- **Breakdown by ingredient** = each term of that sum.
- **Breakdown by cause** = nominal, then the supplier-failure part, then the route-failure part.
- **Quoted cost** uses the same meal formula with quoted prices. It is always labelled "quoted" (C7).
- **Failure risk** shows the batch count. With 0 batches, the risk is "unknown", never 0% (C6).

## Exact arithmetic

- Every intermediate value is an exact fraction: a `BigInt` numerator and denominator. No floating point.
- Rounding happens only in the browser, at display: half-even to 0.1 cent.
- Market prices use micro-dollars from D4. The median across markets is exact on those integers.

## Market pressure (C8)

For each commodity: planned quantity each month ÷ the declared synthetic market volume each month. The declared
threshold is 10%. The panel also shows the 12-month change of the real median price. It is an indicator, not a
forecast.

## Calibration of the synthetic prices

The real Androy retail medians in August 2026 were 0.81 USD per kg for local rice and 0.65 for imported rice.
The brief's synthetic prices do not fit next to them. New rule:

> A synthetic delivered price must be between 60% and 100% of the real regional retail median for the same
> commodity series in the same month.

The fixture test `scripts/fixtures.test.ts` checks every synthetic order and quote against this rule, with the
real median of the same series and month.

**Amendment: the recalibrated story.** The import route contract is 44 cents for each kilogram of rice. It is
inside the rule in every month from March to July 2026. The story keeps its shape, with new numbers:

| Measure, cents for each meal | Rice only | Full meal: rice, beans, oil |
|---|---:|---:|
| Nominal | 4.4 | |
| Supplier view while `INC-A4` is unconfirmed | 5.5 to 5.7 | |
| Supplier view after "transport after handover" | 5.5 | 8.8 |
| Route view | 5.7 | 9.1 |
| Quote of the best local lead, `SUP-L1`, 51 cents for each kg | 5.1 | |

The real data changes the tone of the story. Imported rice has been cheaper than local rice at Androy retail
since February 2026, and local rice rose 14.1% in 12 months. So the best local quote saves only 0.4 to 0.6
cents for each meal against the import route's real cost, and it has 0 batches of history. The honest demo
point is not "local is much cheaper". It is: the real cost of the import route includes its failures, the local
option is close, and buying locally adds pressure to a local price that is already rising.

## Amendment, 2026-09-30: target price is display only (UI4 A)

A target price per food (`CsExpansionCommodity.targetCentsPer1000`, D3 amendment) is shown next to the realized
prices on the price screens. It is never an input to `computeCostLine`, the per-meal cost, eligibility, or any
snapshot, and the price screens never compute a gap against it in the browser.

## Amendment, 2026-10-01: how much can be bought locally (portfolio)

Roshan asked for "an approximation of how much we can get from them without meaningfully inflating local prices".
Claude used the existing C8 rule rather than a new model: our purchases count as market pressure, and the declared
policy reviews any share above 10% of the estimated local market. So the safe local volume is 10% of the market
estimate (CsExpansionCommodity.marketVolumeEstimatePerMonth, synthetic). `localSourcingPlan` (packages/domain,
tested) fills it with local bids, cheapest first, each up to its capacity (confirmed on a visit, else claimed);
imports cover the rest, because imports do not draw on the local market. A food whose full need would pass the line
gets a LOCAL_MARKET_LIMIT recommendation. It is an approximation, not a price forecast, and the screen says so.
Not done: a price-elasticity estimate, which would need local supply and demand data that the program does not have.

## Amendment, 2026-10-01: nutrient references by beneficiary group (P5)

Each ration is measured against its group's reference (BENEFICIARY_GROUPS in packages/domain/src/portfolio.ts):
school children aged 7 to 9 (FAO/WHO; a school meal = 30%), everyone in a general distribution (Sphere Handbook 2018
planning figures: 2,100 kcal, 53 g protein, 32 mg iron, 550 µg vitamin A, 12.4 mg zinc; a full ration = 100%), and
children aged 6 to 23 months (FAO/WHO averaged over the age range; the supplement is assumed to cover 50%). Planning
values, rounded; to verify before any real use. Cost per person a month replaces cost per meal across activities,
because a daily general ration and a school meal are not comparable units.

## Amendment, 2026-10-01: the supplier list and net cost (P8, P9, P10)

- **Could reasonably supply** (base units a month): the supplier's capacity (confirmed on a visit, else claimed), at
  most our need, and for a local supplier at most the safe local volume (10% of the market estimate). Unknown when no
  capacity is stated.
- **Compared price**: what we pay now (the current supplier's unit cost) when a purchase is reconciled; otherwise the
  WFP import median; otherwise the local retail median (P9). A WFP median is a retail price, not a delivered cost.
- **Net cost a month** = (the supplier's price − the compared price) × what it could reasonably supply. Negative is a
  saving. The plan's net cost sums the cheapest-first allocations; the imported rest is at the compared price.
- **Accepted offers** from the supplier site (P10) join the list and the plan as local leads at their own price and
  quantity. They never change a paid cost or the lowest-quote basis of the cost model.

## Amendment, 2026-10-01: reached against planned, and local against international

- **Reached and planned** (Roshan: "why does it say that we have already reached 51000? shouldn't it say 0?"): a
  program whose status is NEW has delivered nothing. Its people reached are 0; its caseload, rations, and food cost are
  plans, and the pages say so. The portfolio total of people reached leaves new programs out and names their plan.
- **Local against international** (Roshan: "i don't see a local international comparison at all"): for each food,
  the international price is what we pay an import supplier now, else the lowest import quote, else WFP's import
  median (a price reference, not a supplier). All international = that price × the need. The mix = the cheapest-first
  local plan at its own prices + the rest at the international price. The page shows both and their difference.
- **First step** of a new program: a supplier for each food. `sourcingSteps` counts, for each food, its leads, offers,
  passed visits, and open investigations, and whether a supplier is paid.

## Amendment, 2026-10-02: the international part of the plan (P20)

- The cheapest-first plan buys locally up to the safe volume (10% of the local market), then the rest from
  international (IMPORT route) offers, cheapest first, each up to its capacity. A current supplier, which already
  delivers the whole need, has no cap. What no offer covers is shown as "not covered by any offer" at the compared
  price.
- The plan's net cost a month = Σ (price − compared price) × planned volume over both parts.
- For each food, code names the next supplier to check overall and on each route (`checks.LOCAL`, `checks.IMPORT`).
  A food that the 10% rule keeps out of the local market gets a local and an international step.

## Help received

Delegated. Claude drafted this record. Roshan reviews it.
