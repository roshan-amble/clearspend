/**
 * Local check of the generated portfolio (scripts/generate-portfolio.ts), before anything is imported: each country's
 * files go through the same domain code as the import Action (parseEvidenceRows, buildSnapshot), then the
 * portfolio rules (recipe cost, nutrition, recommendations). Prints 1 line per country and its recommendations.
 *
 * Run: npm run portfolio:check [-- --country KEN]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  buildSnapshot,
  canonicalJson,
  exactText,
  formatFixed,
  frac,
  groupOf,
  monthlyMedians,
  mul,
  parseEvidenceRows,
  parseRecipe,
  recipeCost,
  recipeNutrition,
  recommendations,
  unitCosts,
  versionIdOf,
  type EvidenceKind,
  type FieldVerificationRef,
  type Json,
  type MarketPrice,
  type PortfolioLine,
} from "@clearspend/domain";
import { readCsv } from "./lib/csv.js";
import { fetchObject, searchObjects } from "./lib/foundry.js";
import { FIXTURE_DIR, MARKET_PRICES_FILE } from "./lib/paths.js";

const DIR = join(FIXTURE_DIR, "..", "portfolio");
const { values } = parseArgs({ options: { country: { type: "string" }, foundry: { type: "boolean" } } });
let mismatches = 0;

const market: MarketPrice[] = [...readCsv(MARKET_PRICES_FILE), ...readCsv(join(DIR, "reference", "market-prices-synthetic.csv"))].map((row) => ({
  market: row.market_id ?? "",
  series: row.commodity ?? "",
  month: (row.date ?? "").slice(0, 7),
  usdMicros: BigInt(row.usd_price_micros ?? "0"),
  admin1: row.admin1 ?? "",
})) as MarketPrice[];
const regionOf = new Map(readCsv(join(DIR, "reference", "countries.csv")).map((c) => [c.country_iso3 ?? "", c] as const));
const meals = readCsv(join(DIR, "reference", "meals.csv"));

function rows(iso3: string, kind: EvidenceKind, file: string) {
  const path = join(DIR, iso3, file);
  if (!existsSync(path)) return [];
  const raw = file.endsWith(".json") ? (JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>[]) : readCsv(path);
  return parseEvidenceRows(kind, raw);
}
const stored = (list: ReturnType<typeof rows>) =>
  list.map((row) => {
    const digest = createHash("sha256").update(canonicalJson(row.props as unknown as Json)).digest("hex");
    return { versionId: versionIdOf(row.logicalId, digest), contentDigest: digest, supersedesVersionId: null, logicalId: row.logicalId, importedAt: "2026-10-01T00:00:00Z", props: row.props };
  });

for (const [iso3, country] of regionOf) {
  if (values.country !== undefined && values.country !== iso3) continue;
  const region = country.program_region ?? "";
  const suppliers = rows(iso3, "suppliers", "suppliers.csv");
  const verifications = new Map<string, FieldVerificationRef[]>();
  const byExternal = new Map(suppliers.map((s) => [s.externalId, s.logicalId] as const));
  for (const v of readCsv(join(DIR, iso3, "field-verifications.csv"))) {
    const id = byExternal.get(v.supplier_id ?? "") as string;
    verifications.set(id, [...(verifications.get(id) ?? []), { rationVersion: 1, result: v.result === "PASS" ? "PASS" : "FAIL", visitedAt: v.visited_at ?? "" }]);
  }
  const snapshot = buildSnapshot({
    suppliers: suppliers.map((row) => ({ logicalId: row.logicalId, route: (row.props as { route: "LOCAL" | "IMPORT" }).route })),
    commodities: rows(iso3, "expansion-commodities", "expansion-commodities.csv").map((row) => row.props) as never,
    orders: stored(rows(iso3, "orders", "orders.csv")) as never,
    payments: stored(rows(iso3, "payments", "payments.csv")) as never,
    invoices: stored(rows(iso3, "invoices", "invoices.csv")) as never,
    deliveries: stored(rows(iso3, "deliveries", "deliveries.csv")) as never,
    incidents: stored(rows(iso3, "incidents", "incidents.json")) as never,
    confirmations: new Map(),
    marketPrices: market.filter((m) => (m as MarketPrice & { admin1: string }).admin1 === region),
    profiles: stored(rows(iso3, "supplier-profiles", "supplier-profiles.json")) as never,
    verifications,
    rationVersion: 1,
  });
  const profileRows = rows(iso3, "supplier-profiles", "supplier-profiles.json").map((r) => r.props as { supplierLogicalId: string; commodity: string; claimedCapacityPerMonth: number });
  const lines: PortfolioLine[] = snapshot.lines.map((l) => ({
    claimedCapacityPerMonth: profileRows.find((p) => p.supplierLogicalId === l.supplierLogicalId && p.commodity === l.commodity)?.claimedCapacityPerMonth ?? null,
    supplierLogicalId: l.supplierLogicalId,
    commodity: l.commodity,
    supplierLowExact: l.line.supplier === null ? null : exactText(l.line.supplier.low),
    supplierHighExact: l.line.supplier === null ? null : exactText(l.line.supplier.high),
    batchCount: l.line.batches,
    unconfirmedFailures: l.line.failures.unconfirmed,
    quotedCentsPer1000: l.quotedCentsPer1000,
    eligibility: l.eligibility,
  }));
  const costs = unitCosts(lines);
  const countryMeals = meals
    .filter((m) => m.country_iso3 === iso3)
    .map((m) => ({ mealId: m.meal_id ?? "", name: m.name ?? "", recipe: parseRecipe(m.ingredients_json ?? "[]"), servings: Number(m.servings_per_month), servingsPerMonth: Number(m.servings_per_month), group: groupOf(m.beneficiary_group) }));
  const commodities = rows(iso3, "expansion-commodities", "expansion-commodities.csv").map((r) => r.props as { commodity: string; marketSeriesLocal: string });
  const recs = recommendations({
    meals: countryMeals,
    ingredients: commodities.map((c) => {
      const medians = monthlyMedians(market.filter((m) => (m as MarketPrice & { admin1: string }).admin1 === region), c.marketSeriesLocal);
      const months = [...medians.keys()].sort();
      const last = months.at(-1);
      const first = months.find((m) => m === `${Number((last ?? "2026-08").slice(0, 4)) - 1}${(last ?? "").slice(4)}`);
      const lastValue = last === undefined ? null : (medians.get(last) ?? null);
      const firstValue = first === undefined ? null : (medians.get(first) ?? null);
      return {
        commodity: c.commodity,
        needPerMonth: countryMeals.reduce((t, m) => t + m.servings * (m.recipe.find((i) => i.commodity === c.commodity)?.quantity ?? 0), 0),
        lines: lines.filter((l) => l.commodity === c.commodity),
        marketLocalMicros: lastValue,
        marketLocalChange: lastValue === null || firstValue === null ? null : frac(lastValue.num * firstValue.den - firstValue.num * lastValue.den, lastValue.den * firstValue.num),
        marketVolumePerMonth: Number((rows(iso3, "expansion-commodities", "expansion-commodities.csv").find((r) => (r.props as { commodity: string }).commodity === c.commodity)?.props as { marketVolumeEstimatePerMonth?: number } | undefined)?.marketVolumeEstimatePerMonth ?? 0) || null,
      };
    }),
  });
  const mealText = countryMeals
    .map((m) => {
      const cost = recipeCost(m.recipe, costs);
      const worst = recipeNutrition(m.recipe, m.group).sort((a, b) => (a.coverage.num * b.coverage.den < b.coverage.num * a.coverage.den ? -1 : 1))[0];
      return `${m.name}: ${cost.low === null ? "?" : formatFixed(cost.low, 1)}${cost.basis === "QUOTE" ? "q" : ""}¢, low ${worst?.nutrient} ${formatFixed(mul(worst!.coverage, frac(100n)), 0)}%`;
    })
    .join(" | ");
  if (values.foundry === true) {
    // Parity with what the import Action stored: every cost line of the current snapshot, field by field.
    const expansion = await fetchObject("CsExpansion", country.expansion_id ?? "");
    const stored = await searchObjects("CsCostLine", "snapshotId", String(expansion?.currentSnapshotId));
    const key = (supplier: string, commodity: string) => `${supplier}|${commodity}`;
    const remote = new Map(stored.map((l) => [key(String(l.supplierLogicalId), String(l.commodity)), l] as const));
    for (const l of lines) {
      const r = remote.get(key(l.supplierLogicalId, l.commodity));
      const same = r !== undefined && (r.supplierLowExact ?? null) === l.supplierLowExact && (r.supplierHighExact ?? null) === l.supplierHighExact && Number(r.batchCount) === l.batchCount && r.eligibility === l.eligibility && (r.quotedCentsPer1000 === undefined || r.quotedCentsPer1000 === null ? null : Number(r.quotedCentsPer1000)) === l.quotedCentsPer1000;
      if (!same) {
        mismatches += 1;
        console.log(`    MISMATCH ${l.supplierLogicalId} ${l.commodity}: local ${l.supplierLowExact}/${l.batchCount}/${l.eligibility}, Foundry ${r?.supplierLowExact}/${r?.batchCount}/${r?.eligibility}`);
      }
    }
    if (stored.length !== lines.length) {
      mismatches += 1;
      console.log(`    MISMATCH ${iso3}: ${lines.length} local lines, ${stored.length} in Foundry`);
    }
  }
  const reconciled = snapshot.purchases.filter((p) => p.result.status === "RECONCILED").length;
  console.log(`${country.flag} ${iso3} ${country.status} purchases ${reconciled}/${snapshot.purchases.length} · ${mealText}`);
  for (const r of recs) console.log(`    ${r.severity.padEnd(6)} ${r.title} — ${r.detail}`);
}
if (values.foundry === true) {
  console.log(mismatches === 0 ? "MATCH: every cost line in Foundry equals the local domain result." : `FAILED: ${mismatches} mismatches.`);
  if (mismatches > 0) process.exitCode = 1;
}
