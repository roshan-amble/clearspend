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

## Help received

Delegated. Claude drafted this record. Roshan reviews it.
