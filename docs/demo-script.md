# Demo click-through

About 12 minutes. The portfolio map shows where to look. Every country has the same 5 pages: **Ingredients**,
**Suppliers**, **Incidents**, **AI analysis**, **Investigations**. Every click that changes something is a Foundry
Action; nothing is simulated. 21 programs are generated test data (labeled synthetic); Madagascar's market prices are
WFP's real Androy series.

Before the demo, reset the countries you rehearsed on: `npm run demo:reset -- --country KEN --apply` (and `MDG`).

Open http://localhost:8080 and sign in. Turn on **Show functions** (top right) at any point to show which Foundry
object, Action, or function powers each part.

## 1. Portfolio: where should we look?

1. **Program map**, colored by the number of recommended actions; hover a country for its first one. Madagascar has a
   dark outline: the new program. The line above the map: 22 programs, 4.4M people reached, 51,000 planned.
2. **Countries**: 1 card for each program, the most actions first. Madagascar: 0 people reached, 51,000 planned, 0 of
   4 ingredients with a supplier.
3. Click **Madagascar**.

## 2. Madagascar: a new program

1. **Ingredients.** Each ingredient: no supplier yet, the number of offers, the lowest available price, and the
   rations that use it. Click **Rice**: the chart shows the lowest market price each month (nothing is bought yet).
2. **Suppliers**, Rice. The 10% rule: we need 491,960 kg a month; Androy's market is about 400,000 kg; only 40,000 kg
   can be bought locally, so the other 451,960 kg must come from international suppliers. **Next**, chosen by code,
   on each route: international, check SUP-I1 (Indian Ocean Grain Traders, 0.62 $/kg CIF Toliara); local, check
   SUP-L2. The selector **All suppliers · Local · International** shows each route on its own. The plan: 40,000 kg
   local, then 300,000 kg from SUP-I1 and 151,960 kg from SUP-I2, cheapest first.
3. Click **Investigate SUP-L2**, then **Write the visit brief**: AI reads the supplier's own profile and lists what
   it claims (quoted word for word), what is missing, and what the investigator must confirm. Code checked every
   quote. **Tag for investigation**.
4. **Investigations**: the visit is under **To book**. **Recommend who to book**: AI weighs the free trips and names
   1, with the trade-off. **Book**. The calendar shows the block; booking the same person twice is refused.
5. **AI analysis**: under **Serve more and better meals**, each ingredient has a local and an international step,
   because the 10% rule keeps most of it out of Androy's markets; then the nutrition gaps. **Write the analysis**: AI puts them in order and says why each matters. Code refuses an analysis that adds
   a step or states a number the rules did not calculate.

## 3. Kenya: an active program

1. **Portfolio**, then **Kenya**. **Ingredients**: all 5 have a supplier. Beans: we pay 1.00 $/kg to SUP-B; the
   lowest available is SUP-L2's offer at 0.82 $/kg. The chart: what we paid each month against the lowest market
   price.
2. **Suppliers**, Beans: **We pay now** 1.00 $/kg (SUP-B, import; 390,560 kg a month); **Local** SUP-L2 saves $9,851
   a month on the 53,248 kg the 10% rule allows. **Investigate SUP-L2**, brief, tag, then book as before.
3. **Incidents**: grouped by supplier. SUP-A has 1: a failed maize delivery. The 2 documents disagree; **Propose a
   cause** (AI, changes nothing), then confirm a cause with a rationale. The cost history gets a new point, and the
   range closes. (This step cannot be reset: rehearse it on Mali, show it once on Kenya.)
4. **AI analysis**: cut cost (beans, rice), serve more meals (the beans saving pays for about 35,000 more rations a
   month; vitamin A), supplier problems (the maize incident, a single maize supplier).

## 4. The other side: the supplier site

1. Open http://localhost:8081 (start it with `npm run dev:supplier`) and sign in. A supplier sees the programs and
   the foods, and nothing else of ours: no market price, no other offer, no volume, so nothing anchors the price.
2. Offer beans for Madagascar: a business name, a contact, the lowest profitable price, the monthly quantity.
   **Send offer.**
3. **Scope check** (development only): the site's own token asks Foundry for market prices, cost lines, and supplier
   profiles, and is refused, even though the signed-in user is an administrator.
4. Back in ClearSpend, **Madagascar → Suppliers** shows **Offers to review** with what the supplier never saw: the
   price against the local market and the net cost a month. Give a reason, **Accept as lead**. It joins the beans
   list as "offer · supplier site", unverified; no paid cost changes.

## 5. Prove it is real

1. Reload the browser: everything is still there. Foundry is the only database.
2. **Show functions**: each card names its object, Action, or query function.
