/**
 * Real-run check of the investigation Actions (P4) on 1 country (default Laos, so the demo's Madagascar stays clean):
 * tag a market survey, replay it, refuse a duplicate; read the trip options; book the earliest, replay the booking;
 * then tag a supplier audit and show that a stale schedule version and an overlapping trip are both refused.
 * It leaves 1 scheduled and 1 open investigation, which are realistic demo data.
 *
 * Run: npm run test:investigations [-- --country LAO]
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { applyAction, currentUserId, FOUNDRY_URL, fetchObject, ONTOLOGY_RID, searchObjects } from "./lib/foundry.js";

const { values } = parseArgs({ options: { country: { type: "string" } } });
const iso3 = values.country ?? "LAO";
const actorUserId = currentUserId();
let failures = 0;
const check = (ok: boolean, text: string, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${text}${ok || detail === "" ? "" : `: ${detail}`}`);
  if (!ok) failures += 1;
};

async function query<T>(name: string, parameters: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${FOUNDRY_URL}/api/v2/ontologies/${ONTOLOGY_RID}/queries/${name}/execute`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.FOUNDRY_TOKEN ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ parameters }),
  });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
  return JSON.parse(((await response.json()) as { value: string }).value) as T;
}
interface Option {
  readonly investigatorId: string;
  readonly name: string;
  readonly mode: string;
  readonly onGroundStart: string;
  readonly departure: string;
  readonly returnDate: string;
  readonly scheduleVersion: number;
}

// 1. Tag a market survey, replay it, and refuse a second open one.
const tagId = randomUUID();
const tag = { countryIso3: iso3, subjectType: "MARKET", subjectId: "RICE", commodity: "RICE", reason: "test:investigations — survey the local rice market", actorUserId };
const tagged = await applyAction("cs-tag-investigation", { ...tag, requestId: tagId });
check(tagged.ok, "tag a market survey", tagged.ok ? "" : tagged.message);
const replay = await applyAction("cs-tag-investigation", { ...tag, requestId: tagId });
check(!replay.ok && replay.message.includes("REPLAYED"), "the same tag again is REPLAYED");
const duplicate = await applyAction("cs-tag-investigation", { ...tag, requestId: randomUUID() });
check(!duplicate.ok && duplicate.message.includes("already open"), "a second open investigation of the same subject is refused");

// 2. Options, then book the earliest; replay the booking.
const schedule = await query<{ options: Option[] }>("csScheduleOptions", { investigationId: tagId });
const first = schedule.options[0];
check(first !== undefined, `trip options listed (${schedule.options.length})`);
if (first === undefined) process.exit(1);
console.log(`     earliest: ${first.name}, ${first.mode}, on the ground ${first.onGroundStart}`);
const bookId = randomUUID();
const booking = { investigationId: tagId, investigatorId: first.investigatorId, onGroundStart: first.onGroundStart, expectedScheduleVersion: first.scheduleVersion, actorUserId };
const booked = await applyAction("cs-book-investigation", { ...booking, requestId: bookId });
check(booked.ok, "book the earliest trip", booked.ok ? "" : booked.message);
const stored = await fetchObject("CsInvestigation", tagId);
check(stored?.status === "SCHEDULED" && stored?.investigatorId === first.investigatorId, "the investigation is scheduled with that investigator");
const block = await fetchObject("CsInvestigatorBusy", bookId);
check(block?.startDate === first.departure && block?.endDate === first.returnDate, "the busy block covers the whole trip, travel included");
const rebook = await applyAction("cs-book-investigation", { ...booking, requestId: bookId });
check(!rebook.ok && rebook.message.includes("REPLAYED"), "the same booking again is REPLAYED");

// 3. A second investigation: a stale calendar and an overlapping trip are both refused.
const leads = (await searchObjects("CsSupplier", "country", iso3.slice(0, 2))).filter((s) => String(s.logicalId).includes("harbor-leads"));
const lead = String(leads[0]?.logicalId ?? `${iso3.toLowerCase()}/harbor-leads:SUP-L1`);
const secondId = randomUUID();
const second = await applyAction("cs-tag-investigation", { countryIso3: iso3, subjectType: "SUPPLIER", subjectId: lead, commodity: "RICE", reason: "test:investigations — audit the lead before any order", requestId: secondId, actorUserId });
check(second.ok, `tag a supplier audit of ${lead}`, second.ok ? "" : second.message);
const stale = await applyAction("cs-book-investigation", { investigationId: secondId, investigatorId: first.investigatorId, onGroundStart: first.onGroundStart, expectedScheduleVersion: first.scheduleVersion, requestId: randomUUID(), actorUserId });
check(!stale.ok && stale.message.includes("STALE_COMMAND"), "booking with the old schedule version is refused (STALE_COMMAND)");
const overlap = await applyAction("cs-book-investigation", { investigationId: secondId, investigatorId: first.investigatorId, onGroundStart: first.onGroundStart, expectedScheduleVersion: first.scheduleVersion + 1, requestId: randomUUID(), actorUserId });
check(!overlap.ok && overlap.message.includes("no longer free"), "booking the same days again is refused (no double booking)");

if (failures > 0) process.exitCode = 1;
