/**
 * Demo reset (P12): removes what a rehearsal of the portfolio click-through wrote for 1 country, through the real
 * Action `cs-reset-country-demo`: its investigations, the calendar blocks of their bookings, its AI RANKING and BOOKING
 * runs, and its supplier offers. It touches no evidence, cost, decision, or incident, and no other country.
 *
 * Run: npm run demo:reset -- --country KEN          (shows what it would remove, removes nothing)
 *      npm run demo:reset -- --country KEN --apply  (removes it)
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { applyAction, currentUserId, searchObjects } from "./lib/foundry.js";

const { values } = parseArgs({ options: { country: { type: "string" }, apply: { type: "boolean" } } });
const country = values.country;
if (country === undefined) throw new Error("Name the country: npm run demo:reset -- --country KEN");

async function state(): Promise<{ readonly lines: string[]; readonly total: number }> {
  const [record] = await searchObjects("CsCountry", "countryIso3", country as string);
  if (record === undefined) throw new Error(`${country} is not in the portfolio.`);
  const investigations = await searchObjects("CsInvestigation", "countryIso3", country as string);
  const ids = new Set(investigations.map((i) => String(i.investigationId)));
  const busy = (await Promise.all([...ids].map((id) => searchObjects("CsInvestigatorBusy", "investigationId", id)))).flat();
  const runs = (await searchObjects("CsAiRun", "expansionId", String(record.expansionId))).filter((r) => r.job === "RANKING" || r.job === "BRIEF" || r.job === "BOOKING" || r.job === "ANALYSIS");
  const bids = await searchObjects("CsSupplierBid", "countryIso3", country as string);
  const lines = [
    ...investigations.map((i) => `investigation ${String(i.subjectType)} ${String(i.subjectId)} ${String(i.commodity)} ${String(i.status)}`),
    ...busy.map((b) => `calendar block ${String(b.investigatorId)} ${String(b.startDate)} to ${String(b.endDate)}`),
    ...runs.map((r) => `AI run ${String(r.job)} ${String(r.subjectId)} ${String(r.status)}`),
    ...bids.map((b) => `offer ${String(b.businessName)} ${String(b.commodity)} ${String(b.status)}`),
  ];
  return { lines, total: lines.length };
}

const before = await state();
console.log(`${country}: ${before.total} record(s) from rehearsals.`);
for (const line of before.lines) console.log(`  ${line}`);
if (values.apply !== true) {
  console.log("Nothing removed. Add --apply to remove them.");
  process.exit(0);
}
const result = await applyAction("cs-reset-country-demo", { countryIso3: country, requestId: randomUUID(), actorUserId: currentUserId() });
if (!result.ok) {
  console.log(`FAIL: ${result.message}`);
  process.exit(1);
}
const after = await state();
console.log(after.total === 0 ? `Removed ${before.total}. ${country} is clean.` : `FAIL: ${after.total} record(s) remain:\n${after.lines.join("\n")}`);
process.exit(after.total === 0 ? 0 : 1);
