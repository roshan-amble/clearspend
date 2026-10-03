/**
 * Portfolio test data (Roshan, 2026-10-01: "at least 20 countries, all test data is fine"). Deterministic: the same
 * seed writes the same files. Every program is synthetic except Madagascar's market prices, which are WFP's real
 * Androy series (already in cs_market_price). Madagascar is the new expansion: menus and leads, but no supplier yet.
 *
 * Writes data/portfolio/<ISO3>/ (the 9 import files and field verifications, checked with the import rules before
 * they are written) and data/portfolio/reference/ (countries, meals, investigators, busy days, market prices).
 *
 * Run: npm run portfolio:generate
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEvidenceRows, type EvidenceKind } from "@clearspend/domain";
import { readCsv, writeCsv } from "./lib/csv.js";
import { FIXTURE_DIR } from "./lib/paths.js";

const OUT = join(FIXTURE_DIR, "..", "portfolio");
const TODAY = "2026-10-01";

// ---------------------------------------------------------------------------------------------------------------
// Deterministic randomness.

let seed = 20261005;
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (low: number, high: number): number => low + (high - low) * random();
const int = (low: number, high: number): number => Math.floor(between(low, high + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

// ---------------------------------------------------------------------------------------------------------------
// Foods. Base prices are rough USD retail medians, for generation only.

interface Food {
  readonly base: "g" | "ml";
  readonly sourceUnit: "kg" | "L";
  readonly maxMoisture: number | null;
  readonly local: string;
  readonly import: string;
  readonly usdLocal: number;
  readonly usdImport: number;
}
const FOODS: Record<string, Food> = {
  RICE: { base: "g", sourceUnit: "kg", maxMoisture: 140, local: "Rice (local)", import: "Rice (imported)", usdLocal: 0.78, usdImport: 0.68 },
  MAIZE: { base: "g", sourceUnit: "kg", maxMoisture: 135, local: "Maize meal (local)", import: "Maize meal (imported)", usdLocal: 0.42, usdImport: 0.5 },
  SORGHUM: { base: "g", sourceUnit: "kg", maxMoisture: 130, local: "Sorghum (local)", import: "Sorghum (imported)", usdLocal: 0.46, usdImport: 0.55 },
  MILLET: { base: "g", sourceUnit: "kg", maxMoisture: 130, local: "Millet (local)", import: "Millet (imported)", usdLocal: 0.52, usdImport: 0.6 },
  BEANS: { base: "g", sourceUnit: "kg", maxMoisture: 130, local: "Beans (local)", import: "Beans (imported)", usdLocal: 1.1, usdImport: 1.25 },
  LENTILS: { base: "g", sourceUnit: "kg", maxMoisture: 130, local: "Lentils (local)", import: "Lentils (imported)", usdLocal: 1.0, usdImport: 1.1 },
  OIL: { base: "ml", sourceUnit: "L", maxMoisture: null, local: "Vegetable oil (local)", import: "Vegetable oil (imported)", usdLocal: 2.2, usdImport: 2.05 },
  CSB: { base: "g", sourceUnit: "kg", maxMoisture: 100, local: "Super Cereal (local)", import: "Super Cereal (imported)", usdLocal: 1.25, usdImport: 1.2 },
  FISH: { base: "g", sourceUnit: "kg", maxMoisture: 150, local: "Dried fish (local)", import: "Dried fish (imported)", usdLocal: 4.2, usdImport: 4.8 },
  MILK: { base: "g", sourceUnit: "kg", maxMoisture: 50, local: "Milk powder (local)", import: "Milk powder (imported)", usdLocal: 6.2, usdImport: 5.6 },
};
/** Madagascar uses WFP's real Androy series where they exist (D11). */
/**
 * Androy's local markets, base units a month (declared, synthetic). Rice is the brief's 400,000 kg. Beans and oil
 * markets are small, so buying the whole need locally would pass the 10% line (C8); Super Cereal is an imported
 * product with almost no local market.
 */
const MDG_MARKET: Record<string, number> = { RICE: 400_000_000, BEANS: 22_000_000, OIL: 9_000_000, CSB: 2_000_000 };
const MDG_SERIES: Record<string, { local: string; import: string }> = {
  RICE: { local: "Rice (local)", import: "Rice (imported)" },
  BEANS: { local: "Beans (niebe, red)", import: "Beans (niebe, red)" },
  OIL: { local: "Oil (vegetable, packaged)", import: "Oil (vegetable, packaged)" },
};

// ---------------------------------------------------------------------------------------------------------------
// Menus: meals share foods across a region, so the same food shows up in many meals.

interface MealSpec {
  readonly name: string;
  readonly days: string;
  readonly daysPerWeek: number;
  readonly recipe: Record<string, number>;
}
const MENUS: Record<string, readonly MealSpec[]> = {
  EAST: [
    { name: "Githeri (maize and beans)", days: "Mon Wed", daysPerWeek: 2, recipe: { MAIZE: 150, BEANS: 40, OIL: 10 } },
    { name: "Rice and beans", days: "Tue Thu", daysPerWeek: 2, recipe: { RICE: 120, BEANS: 40, OIL: 10 } },
    { name: "Fortified porridge", days: "Fri", daysPerWeek: 1, recipe: { CSB: 80, OIL: 5 } },
  ],
  SAHEL: [
    { name: "Sorghum couscous with cowpeas", days: "Mon Wed", daysPerWeek: 2, recipe: { SORGHUM: 150, BEANS: 40, OIL: 10 } },
    { name: "Rice with dried fish", days: "Tue Thu", daysPerWeek: 2, recipe: { RICE: 120, FISH: 15, OIL: 10 } },
    { name: "Millet porridge", days: "Fri", daysPerWeek: 1, recipe: { MILLET: 100, CSB: 30, OIL: 5 } },
  ],
  SOUTH: [
    { name: "Nsima with beans", days: "Mon Wed Fri", daysPerWeek: 3, recipe: { MAIZE: 150, BEANS: 40, OIL: 10 } },
    { name: "Fortified porridge", days: "Tue", daysPerWeek: 1, recipe: { CSB: 80, OIL: 5 } },
    { name: "Rice and beans", days: "Thu", daysPerWeek: 1, recipe: { RICE: 120, BEANS: 40, OIL: 10 } },
  ],
  LATAM: [
    { name: "Rice and beans", days: "Mon Wed Fri", daysPerWeek: 3, recipe: { RICE: 120, BEANS: 50, OIL: 10 } },
    { name: "Corn atol with milk", days: "Tue Thu", daysPerWeek: 2, recipe: { MAIZE: 60, MILK: 15 } },
  ],
  ASIA: [
    { name: "Dal bhat (rice and lentils)", days: "Mon Wed Fri", daysPerWeek: 3, recipe: { RICE: 150, LENTILS: 40, OIL: 10 } },
    { name: "Fortified porridge with milk", days: "Tue", daysPerWeek: 1, recipe: { CSB: 60, MILK: 10 } },
    { name: "Rice with dried fish", days: "Thu", daysPerWeek: 1, recipe: { RICE: 150, FISH: 15, OIL: 5 } },
  ],
  MDG: [
    { name: "Vary sy tsaramaso (rice and beans)", days: "Mon Tue Wed Thu", daysPerWeek: 4, recipe: { RICE: 100, BEANS: 30, OIL: 10 } },
    { name: "Rice porridge with Super Cereal", days: "Fri", daysPerWeek: 1, recipe: { RICE: 60, CSB: 40, OIL: 5 } },
  ],
};

// ---------------------------------------------------------------------------------------------------------------
// Countries. `priceLevel` scales every market; `markups` set what the program pays against the local market.

interface CountrySpec {
  readonly iso3: string;
  readonly iso2: string;
  readonly name: string;
  readonly flag: string;
  readonly region: string;
  readonly hub: "NBO" | "DKR" | "JNB" | "PTY" | "BKK";
  readonly currency: string;
  readonly fx: number;
  readonly language: "en" | "fr" | "pt" | "es";
  readonly menu: keyof typeof MENUS;
  readonly students: number;
  readonly priceLevel: number;
  /** Paid price ÷ local market for a food; others get 0.9 to 1.12. */
  readonly markups?: Record<string, number>;
  readonly ruleFailure?: string;
  readonly unconfirmedFailure?: string;
  readonly missingInvoice?: string;
  readonly secondSupplier?: readonly string[];
  readonly leads?: readonly { readonly commodity: string; readonly quoteFactor: number; readonly capacityFactor: number }[];
  readonly marketTrend?: Record<string, number>;
  readonly localInvestigators: number;
}

const COUNTRIES: readonly CountrySpec[] = [
  { iso3: "KEN", iso2: "KE", name: "Kenya", flag: "🇰🇪", region: "Turkana", hub: "NBO", currency: "KES", fx: 129, language: "en", menu: "EAST", students: 96000, priceLevel: 1.05, markups: { RICE: 1.32 }, unconfirmedFailure: "MAIZE", leads: [{ commodity: "RICE", quoteFactor: 0.92, capacityFactor: 1.3 }, { commodity: "BEANS", quoteFactor: 0.84, capacityFactor: 0.8 }], localInvestigators: 2 },
  { iso3: "ETH", iso2: "ET", name: "Ethiopia", flag: "🇪🇹", region: "Afar", hub: "NBO", currency: "ETB", fx: 120, language: "en", menu: "EAST", students: 142000, priceLevel: 0.95, ruleFailure: "MAIZE", secondSupplier: ["MAIZE"], localInvestigators: 2 },
  { iso3: "SOM", iso2: "SO", name: "Somalia", flag: "🇸🇴", region: "Bay", hub: "NBO", currency: "SOS", fx: 571, language: "en", menu: "EAST", students: 38000, priceLevel: 1.3, markups: { OIL: 1.28 }, marketTrend: { RICE: 0.18 }, localInvestigators: 1 },
  { iso3: "SSD", iso2: "SS", name: "South Sudan", flag: "🇸🇸", region: "Jonglei", hub: "NBO", currency: "SSP", fx: 1300, language: "en", menu: "EAST", students: 54000, priceLevel: 1.45, markups: { BEANS: 1.36 }, unconfirmedFailure: "BEANS", localInvestigators: 0 },
  { iso3: "UGA", iso2: "UG", name: "Uganda", flag: "🇺🇬", region: "Karamoja", hub: "NBO", currency: "UGX", fx: 3700, language: "en", menu: "EAST", students: 120000, priceLevel: 0.85, leads: [{ commodity: "MAIZE", quoteFactor: 0.86, capacityFactor: 1.5 }], localInvestigators: 2 },
  { iso3: "RWA", iso2: "RW", name: "Rwanda", flag: "🇷🇼", region: "Eastern", hub: "NBO", currency: "RWF", fx: 1400, language: "en", menu: "EAST", students: 61000, priceLevel: 0.95, localInvestigators: 1 },
  { iso3: "NER", iso2: "NE", name: "Niger", flag: "🇳🇪", region: "Tillabéri", hub: "DKR", currency: "XOF", fx: 600, language: "fr", menu: "SAHEL", students: 88000, priceLevel: 1.0, ruleFailure: "SORGHUM", markups: { FISH: 1.24 }, localInvestigators: 1 },
  { iso3: "MLI", iso2: "ML", name: "Mali", flag: "🇲🇱", region: "Mopti", hub: "DKR", currency: "XOF", fx: 600, language: "fr", menu: "SAHEL", students: 104000, priceLevel: 0.98, unconfirmedFailure: "RICE", leads: [{ commodity: "SORGHUM", quoteFactor: 0.82, capacityFactor: 1.2 }], localInvestigators: 2 },
  { iso3: "TCD", iso2: "TD", name: "Chad", flag: "🇹🇩", region: "Lac", hub: "DKR", currency: "XAF", fx: 600, language: "fr", menu: "SAHEL", students: 47000, priceLevel: 1.2, markups: { RICE: 1.22, OIL: 1.19 }, marketTrend: { SORGHUM: 0.22 }, localInvestigators: 0 },
  { iso3: "BFA", iso2: "BF", name: "Burkina Faso", flag: "🇧🇫", region: "Sahel", hub: "DKR", currency: "XOF", fx: 600, language: "fr", menu: "SAHEL", students: 73000, priceLevel: 1.05, missingInvoice: "MILLET", localInvestigators: 1 },
  { iso3: "NGA", iso2: "NG", name: "Nigeria", flag: "🇳🇬", region: "Borno", hub: "DKR", currency: "NGN", fx: 1550, language: "en", menu: "SAHEL", students: 150000, priceLevel: 1.1, secondSupplier: ["RICE", "SORGHUM"], leads: [{ commodity: "FISH", quoteFactor: 0.8, capacityFactor: 1.1 }], localInvestigators: 2 },
  { iso3: "MOZ", iso2: "MZ", name: "Mozambique", flag: "🇲🇿", region: "Cabo Delgado", hub: "JNB", currency: "MZN", fx: 64, language: "pt", menu: "SOUTH", students: 69000, priceLevel: 1.08, unconfirmedFailure: "MAIZE", markups: { BEANS: 1.21 }, localInvestigators: 1 },
  { iso3: "MWI", iso2: "MW", name: "Malawi", flag: "🇲🇼", region: "Dedza", hub: "JNB", currency: "MWK", fx: 1740, language: "en", menu: "SOUTH", students: 112000, priceLevel: 0.9, leads: [{ commodity: "MAIZE", quoteFactor: 0.88, capacityFactor: 2.0 }, { commodity: "BEANS", quoteFactor: 0.9, capacityFactor: 0.6 }], localInvestigators: 2 },
  { iso3: "ZMB", iso2: "ZM", name: "Zambia", flag: "🇿🇲", region: "Western", hub: "JNB", currency: "ZMW", fx: 27, language: "en", menu: "SOUTH", students: 58000, priceLevel: 0.92, ruleFailure: "BEANS", localInvestigators: 1 },
  { iso3: "ZWE", iso2: "ZW", name: "Zimbabwe", flag: "🇿🇼", region: "Masvingo", hub: "JNB", currency: "USD", fx: 1, language: "en", menu: "SOUTH", students: 77000, priceLevel: 1.15, markups: { MAIZE: 1.3 }, marketTrend: { MAIZE: 0.16 }, localInvestigators: 1 },
  { iso3: "COD", iso2: "CD", name: "DR Congo", flag: "🇨🇩", region: "Kasaï", hub: "JNB", currency: "CDF", fx: 2800, language: "fr", menu: "SOUTH", students: 131000, priceLevel: 1.25, unconfirmedFailure: "RICE", missingInvoice: "CSB", localInvestigators: 0 },
  { iso3: "HTI", iso2: "HT", name: "Haiti", flag: "🇭🇹", region: "Nord-Ouest", hub: "PTY", currency: "HTG", fx: 132, language: "fr", menu: "LATAM", students: 66000, priceLevel: 1.35, markups: { RICE: 1.18 }, marketTrend: { RICE: 0.24, BEANS: 0.12 }, localInvestigators: 1 },
  { iso3: "GTM", iso2: "GT", name: "Guatemala", flag: "🇬🇹", region: "Alta Verapaz", hub: "PTY", currency: "GTQ", fx: 7.8, language: "es", menu: "LATAM", students: 84000, priceLevel: 1.0, leads: [{ commodity: "BEANS", quoteFactor: 0.87, capacityFactor: 1.4 }], localInvestigators: 2 },
  { iso3: "BGD", iso2: "BD", name: "Bangladesh", flag: "🇧🇩", region: "Cox's Bazar", hub: "BKK", currency: "BDT", fx: 119, language: "en", menu: "ASIA", students: 148000, priceLevel: 0.85, secondSupplier: ["RICE"], localInvestigators: 2 },
  { iso3: "NPL", iso2: "NP", name: "Nepal", flag: "🇳🇵", region: "Karnali", hub: "BKK", currency: "NPR", fx: 134, language: "en", menu: "ASIA", students: 52000, priceLevel: 1.12, markups: { LENTILS: 1.26 }, ruleFailure: "RICE", localInvestigators: 1 },
  { iso3: "LAO", iso2: "LA", name: "Laos", flag: "🇱🇦", region: "Phongsaly", hub: "BKK", currency: "LAK", fx: 21800, language: "en", menu: "ASIA", students: 36000, priceLevel: 1.05, leads: [{ commodity: "RICE", quoteFactor: 0.9, capacityFactor: 0.9 }], localInvestigators: 1 },
];
// The brief's size: about 10,000 kg of rice a month. The new program starts with the 2026-27 school year.
const MDG = { iso3: "MDG", iso2: "MG", name: "Madagascar", flag: "🇲🇬", region: "Androy", hub: "JNB" as const, currency: "MGA", fx: 4500, students: 6000, expansionId: "EXP-MDG-ANDROY-2027" };

// ---------------------------------------------------------------------------------------------------------------
// Names for fictional suppliers, people, and documents.

const SUPPLIER_WORDS = ["Grain", "Harvest", "Agro", "Pulses", "Mills", "Trading", "Foods", "Produce", "Commodities", "Supply"];
const SUPPLIER_SUFFIX: Record<string, string[]> = { en: ["Ltd", "Co.", "Traders", "Cooperative"], fr: ["SARL", "Coopérative", "Négoce", "SA"], pt: ["Lda", "Cooperativa", "Comercial"], es: ["S.A.", "Cooperativa", "Comercial"] };
const PEOPLE: Record<string, string[]> = {
  NBO: ["Amina Kiprop", "Daniel Otieno", "Hanna Bekele", "Yusuf Abdi", "Grace Achieng", "Moses Okello", "Liya Tesfaye", "Joseph Mugisha", "Faith Wanjiru"],
  DKR: ["Aïssata Diallo", "Moussa Traoré", "Fatou Ndiaye", "Ibrahim Maïga", "Mariam Ouédraogo", "Chinedu Okafor", "Halima Sow", "Abdoulaye Kané"],
  JNB: ["Thandi Nkosi", "Hery Rakotomalala", "Chipo Banda", "Fernando Matsinhe", "Tendai Moyo", "Grace Mwale", "Jean-Pierre Kabila", "Lindiwe Dube"],
  PTY: ["Marie-Claude Joseph", "Carlos Xol", "Rosa Caal", "Jean Baptiste", "Lucía Pérez"],
  BKK: ["Rahima Begum", "Sanjay Thapa", "Bounmy Phommachanh", "Anika Rahman", "Prakash Gurung"],
};
/** 2 fictional local investigators' names for each country, in order. */
const LOCAL_NAMES: Record<string, readonly string[]> = {
  MDG: ["Hery Rakotomalala", "Voahangy Rasoanaivo"], KEN: ["Wanjiku Mwangi", "Brian Kiprono"], ETH: ["Hanna Bekele", "Abebe Girma"], SOM: ["Yusuf Abdi", "Hodan Warsame"],
  SSD: ["Deng Garang", "Akuol Majok"], UGA: ["Moses Okello", "Rose Nakato"], RWA: ["Joseph Mugisha", "Aline Uwase"], NER: ["Ibrahim Maïga", "Hadiza Issoufou"],
  MLI: ["Moussa Traoré", "Aminata Coulibaly"], TCD: ["Mahamat Saleh", "Achta Djibrine"], BFA: ["Mariam Ouédraogo", "Yacouba Sawadogo"], NGA: ["Chinedu Okafor", "Halima Bello"],
  MOZ: ["Fernando Matsinhe", "Ana Cossa"], MWI: ["Grace Mwale", "Chikondi Phiri"], ZMB: ["Chipo Banda", "Mutale Mwansa"], ZWE: ["Tendai Moyo", "Rudo Chikwanha"],
  COD: ["Jean-Pierre Kabila", "Esther Mbuyi"], HTI: ["Marie-Claude Joseph", "Jean Baptiste"], GTM: ["Carlos Xol", "Rosa Caal"], BGD: ["Rahima Begum", "Anika Rahman"],
  NPL: ["Sanjay Thapa", "Prakash Gurung"], LAO: ["Bounmy Phommachanh", "Somphone Keo"],
};
/** Fly-in investigators, by hub. */
const HUB_NAMES: Record<string, readonly string[]> = {
  NBO: ["Amina Kiprop", "Daniel Otieno", "Faith Wanjiru"],
  DKR: ["Fatou Ndiaye", "Abdoulaye Kané", "Halima Sow"],
  JNB: ["Thandi Nkosi", "Lindiwe Dube"],
  PTY: ["Lucía Pérez", "Mateo Herrera"],
  BKK: ["Nok Srisuk", "Arjun Mehta"],
};
const HUB_CITY: Record<string, string> = { NBO: "Nairobi", DKR: "Dakar", JNB: "Johannesburg", PTY: "Panama City", BKK: "Bangkok" };

// ---------------------------------------------------------------------------------------------------------------

type Row = Record<string, string | number>;
const month = (m: number) => `2026-${String(m).padStart(2, "0")}`;
const at = (m: number, day: number) => `${month(m)}-${String(day).padStart(2, "0")}T08:00:00Z`;
const MONTHS = [3, 4, 5, 6, 7, 8];

function marketSeries(spec: { region: string; iso3: string; fx: number; currency: string }, food: Food, commodity: string, level: number, trend: number): Row[] {
  const rows: Row[] = [];
  const marketId = `SYN-${spec.iso3}`;
  for (const route of ["local", "import"] as const) {
    const series = route === "local" ? food.local : food.import;
    let price = (route === "local" ? food.usdLocal : food.usdImport) * level;
    // 24 months to 2026-08; the trend is the change over the last 12 months.
    const months: string[] = [];
    for (let i = 23; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(2026, 7 - i, 15));
      months.push(d.toISOString().slice(0, 10));
    }
    const startOfYear = price;
    months.forEach((date, index) => {
      const seasonal = 1 + 0.05 * Math.sin((index / 12) * 2 * Math.PI);
      const drift = index < 12 ? 1 : 1 + (trend * (index - 11)) / 12;
      const usd = Math.max(0.05, startOfYear * seasonal * drift * between(0.97, 1.03));
      price = usd;
      const micros = Math.round(usd * 1_000_000);
      rows.push({
        price_id: `${marketId}:${series}:${date}`,
        date,
        admin1: spec.region,
        admin2: spec.region,
        market: `${spec.region} market (synthetic)`,
        market_id: marketId,
        commodity: series,
        unit: food.sourceUnit === "L" ? "L" : "KG",
        pricetype: "Retail",
        currency: spec.currency,
        price: (usd * spec.fx).toFixed(2),
        usdprice: (micros / 1_000_000).toFixed(2),
        usd_price_micros: micros,
        source_url: "synthetic:clearspend-portfolio-generator",
        downloaded_at: TODAY,
      });
    });
    void commodity;
  }
  return rows;
}

const latestMicros = (rows: Row[], series: string, date: string): number => {
  const row = rows.find((r) => r.commodity === series && r.date === date);
  if (row === undefined) throw new Error(`No market row for ${series} ${date}.`);
  return Number(row.usd_price_micros);
};

function checkAndWrite(dir: string, kind: EvidenceKind | "field-verifications", file: string, columns: readonly string[] | null, rows: readonly Row[]): void {
  if (kind !== "field-verifications") parseEvidenceRows(kind, rows);
  const path = join(dir, file);
  if (columns === null) writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`, "utf-8");
  else writeCsv(path, columns, rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))));
}

const COLUMNS = {
  expansion: ["expansion_id", "name", "region", "ration_version", "period_start", "period_end", "visibility_level"],
  commodities: ["expansion_id", "commodity", "unit", "quantity_per_meal", "max_moisture_permille", "planned_per_month", "market_volume_estimate_per_month", "market_volume_label", "market_series_local", "market_series_import"],
  suppliers: ["source_system", "supplier_id", "name", "route", "country"],
  orders: ["source_system", "order_id", "expansion_id", "supplier_id", "commodity", "unit", "quantity", "unit_price_cents", "total_cents", "currency", "replaces_order_id", "replaces_incident_id", "recorded_at"],
  payments: ["source_system", "payment_id", "order_id", "amount_cents", "currency", "paid_at"],
  invoices: ["source_system", "invoice_id", "order_id", "commodity", "unit", "quantity", "unit_price_cents", "total_cents", "currency", "recorded_at"],
  deliveries: ["source_system", "receipt_id", "order_id", "commodity", "unit", "quantity_received", "received_at", "handover_at", "moisture_permille", "acceptance_result"],
  verifications: ["source_system", "verification_id", "supplier_id", "ration_version", "visited_at", "verifier", "result", "moisture_permille", "confirmed_capacity_kg_per_month", "notes"],
};

const servingsOf = (students: number, daysPerWeek: number): number => Math.round((students * daysPerWeek * 52) / 12);

function profileText(language: string, name: string, food: string, quoteUsd: string, capacity: number, region: string): string {
  const kg = capacity.toLocaleString("en-US");
  switch (language) {
    case "fr":
      return `${name} (fictif). ${food} de la région ${region}. Prix : ${quoteUsd.replace(".", ",")} USD le kg, livré au dépôt du programme. Capacité : ${kg} kg par mois. Contrôle qualité au chargement.`;
    case "pt":
      return `${name} (fictício). ${food} da província de ${region}. Preço: ${quoteUsd.replace(".", ",")} USD por kg, entregue no armazém do programa. Capacidade: ${kg} kg por mês.`;
    case "es":
      return `${name} (ficticio). ${food} de ${region}. Precio: ${quoteUsd} USD por kg, entregado en la bodega del programa. Capacidad: ${kg} kg al mes.`;
    default:
      return `${name} (fictional). ${food} from ${region}. Price: ${quoteUsd} USD per kg, delivered to the program depot. Capacity: ${kg} kg a month. Quality checked at loading.`;
  }
}

// ---------------------------------------------------------------------------------------------------------------

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "reference"), { recursive: true });
const countryRows: Row[] = [];
const mealRows: Row[] = [];
const marketRows: Row[] = [];

for (const spec of COUNTRIES) {
  const dir = join(OUT, spec.iso3);
  mkdirSync(dir, { recursive: true });
  const expansionId = `EXP-${spec.iso3}-2026`;
  const erp = `${spec.iso3.toLowerCase()}/harbor-erp`;
  const leadsSource = `${spec.iso3.toLowerCase()}/harbor-leads`;
  const field = `${spec.iso3.toLowerCase()}/harbor-field`;
  const menu = MENUS[spec.menu] as readonly MealSpec[];

  // Meals, and the monthly need of each food in base units.
  const need: Record<string, number> = {};
  const mainQuantity: Record<string, number> = {};
  menu.forEach((meal, index) => {
    const servings = servingsOf(spec.students, meal.daysPerWeek);
    mealRows.push({
      meal_id: `${spec.iso3}-M${index + 1}`,
      country_iso3: spec.iso3,
      expansion_id: expansionId,
      name: meal.name,
      servings_per_month: servings,
      days_served: meal.days,
      ingredients_json: JSON.stringify(Object.entries(meal.recipe).map(([commodity, quantity]) => ({ commodity, quantity }))),
      activity: "SCHOOL_MEALS",
      beneficiary_group: "SCHOOL_CHILD",
      beneficiaries: spec.students,
    });
    for (const [commodity, quantity] of Object.entries(meal.recipe)) {
      need[commodity] = (need[commodity] ?? 0) + servings * quantity;
      mainQuantity[commodity] = Math.max(mainQuantity[commodity] ?? 0, quantity);
    }
  });
  const foods = Object.keys(need);

  // Market prices for the program's region.
  const marketFor: Record<string, Row[]> = {};
  for (const commodity of foods) {
    const rows = marketSeries(spec, FOODS[commodity] as Food, commodity, spec.priceLevel * between(0.9, 1.1), spec.marketTrend?.[commodity] ?? between(-0.06, 0.08));
    marketFor[commodity] = rows;
    marketRows.push(...rows);
  }

  checkAndWrite(dir, "expansion", "expansion.csv", COLUMNS.expansion, [
    { expansion_id: expansionId, name: `Harbor Meals school meals - ${spec.region}`, region: spec.region, ration_version: 1, period_start: "2026-03-01", period_end: "2026-12-31", visibility_level: "PRIVATE" },
  ]);
  checkAndWrite(
    dir,
    "expansion-commodities",
    "expansion-commodities.csv",
    COLUMNS.commodities,
    foods.map((commodity) => {
      const food = FOODS[commodity] as Food;
      return {
        expansion_id: expansionId,
        commodity,
        unit: food.base,
        quantity_per_meal: mainQuantity[commodity] as number,
        max_moisture_permille: food.maxMoisture ?? "",
        planned_per_month: need[commodity] as number,
        market_volume_estimate_per_month: Math.round((need[commodity] as number) * between(18, 60)),
        market_volume_label: "synthetic",
        market_series_local: food.local,
        market_series_import: food.import,
      };
    }),
  );

  // Suppliers: 1 current supplier for each food, sometimes 2; and the leads.
  const suppliers: Row[] = [];
  const supplierFor: Record<string, string[]> = {};
  let letter = 0;
  const nextId = () => `SUP-${String.fromCharCode(65 + letter++)}`;
  for (const commodity of foods) {
    const count = spec.secondSupplier?.includes(commodity) ? 2 : 1;
    supplierFor[commodity] = [];
    for (let n = 0; n < count; n += 1) {
      const id = nextId();
      const route = commodity === "CSB" || commodity === "MILK" || random() < 0.35 ? "IMPORT" : "LOCAL";
      suppliers.push({ source_system: erp, supplier_id: id, name: `${spec.region} ${pick(SUPPLIER_WORDS)} ${pick(SUPPLIER_SUFFIX[spec.language] ?? ["Ltd"])} (fictional)`, route, country: spec.iso2 });
      (supplierFor[commodity] as string[]).push(id);
    }
  }
  const leads = (spec.leads ?? []).map((lead, index) => ({ ...lead, id: `SUP-L${index + 1}` }));
  for (const lead of leads) {
    suppliers.push({ source_system: leadsSource, supplier_id: lead.id, name: `${pick(["Nouvelle", "New", "Green", "Unity", "Sunrise", "Lakeside"])} ${pick(SUPPLIER_WORDS)} ${pick(SUPPLIER_SUFFIX[spec.language] ?? ["Ltd"])} (fictional)`, route: "LOCAL", country: spec.iso2 });
  }
  checkAndWrite(dir, "suppliers", "suppliers.csv", COLUMNS.suppliers, suppliers);

  const profiles: Row[] = leads.map((lead) => {
    const food = FOODS[lead.commodity] as Food;
    const marketUsd = latestMicros(marketFor[lead.commodity] as Row[], food.local, "2026-08-15") / 1_000_000;
    const quote = Math.round(marketUsd * lead.quoteFactor * 100);
    const capacity = Math.round(((need[lead.commodity] as number) / 1000) * lead.capacityFactor);
    const supplier = suppliers.find((s) => s.supplier_id === lead.id) as Row;
    return {
      source_system: leadsSource,
      supplier_id: lead.id,
      commodity: lead.commodity,
      language: spec.language,
      quoted_price_cents_per_kg: quote,
      claimed_capacity_kg_per_month: capacity,
      submitted_at: at(9, int(2, 20)),
      text: profileText(spec.language, String(supplier.name).replace(" (fictional)", ""), lead.commodity.charAt(0) + lead.commodity.slice(1).toLowerCase(), (quote / 100).toFixed(2), capacity, spec.region),
    };
  });
  checkAndWrite(dir, "supplier-profiles", "supplier-profiles.json", null, profiles);

  // Purchases: 1 order of each food each month, split between suppliers when there are 2.
  const orders: Row[] = [];
  const payments: Row[] = [];
  const invoices: Row[] = [];
  const deliveries: Row[] = [];
  const incidents: Row[] = [];
  let seq = 0;
  const markupOf: Record<string, number> = {};
  for (const commodity of foods) markupOf[commodity] = spec.markups?.[commodity] ?? between(0.9, 1.12);
  const addOrder = (commodity: string, supplierId: string, m: number, day: number, quantityUnits: number, replaces?: { order: string; incident: string }) => {
    seq += 1;
    const id = String(seq).padStart(3, "0");
    const food = FOODS[commodity] as Food;
    const marketUsd = latestMicros(marketFor[commodity] as Row[], food.local, `${month(m)}-15`) / 1_000_000;
    const unitCents = Math.max(1, Math.round(marketUsd * (markupOf[commodity] as number) * 100));
    const total = unitCents * quantityUnits;
    orders.push({ source_system: erp, order_id: `PO-${id}`, expansion_id: expansionId, supplier_id: supplierId, commodity, unit: food.sourceUnit, quantity: quantityUnits, unit_price_cents: unitCents, total_cents: total, currency: "USD", replaces_order_id: replaces?.order ?? "", replaces_incident_id: replaces?.incident ?? "", recorded_at: at(m, day) });
    return { id, food, unitCents, total };
  };
  const ruleMonth = spec.ruleFailure === undefined ? null : int(4, 6);
  const damageMonth = spec.unconfirmedFailure === undefined ? null : int(5, 7);
  for (const commodity of foods) {
    const ids = supplierFor[commodity] as string[];
    const units = Math.max(1, Math.round((need[commodity] as number) / 1000));
    for (const m of MONTHS) {
      const supplierId = ids.length > 1 && (m === 4 || m === 7) ? (ids[1] as string) : (ids[0] as string);
      const { id, food, unitCents, total } = addOrder(commodity, supplierId, m, 5, units);
      const failsAtReceipt = spec.ruleFailure === commodity && m === ruleMonth;
      const moisture = food.maxMoisture === null ? "" : failsAtReceipt ? food.maxMoisture + int(15, 30) : food.maxMoisture - int(5, 18);
      deliveries.push({ source_system: erp, receipt_id: `DEL-${id}`, order_id: `PO-${id}`, commodity, unit: food.sourceUnit, quantity_received: units, received_at: at(m, 14), handover_at: at(m, 14), moisture_permille: moisture, acceptance_result: failsAtReceipt ? "FAIL" : "PASS" });
      const skipInvoice = spec.missingInvoice === commodity && m === 8;
      if (!skipInvoice) invoices.push({ source_system: erp, invoice_id: `INV-${id}`, order_id: `PO-${id}`, commodity, unit: food.sourceUnit, quantity: units, unit_price_cents: unitCents, total_cents: total, currency: "USD", recorded_at: at(m, 12) });
      payments.push({ source_system: erp, payment_id: `PAY-${id}`, order_id: `PO-${id}`, amount_cents: total, currency: "USD", paid_at: at(m, 25) });

      if (failsAtReceipt) {
        const incident = `INC-${String(incidents.length + 1).padStart(2, "0")}`;
        incidents.push({ source_system: erp, incident_id: incident, order_id: `PO-${id}`, reported_at: at(m, 14).replace("08:00", "10:00"), affected_quantity_kg: units, documents: [{ document_id: `DOC-${incident}-LAB`, author_role: "receiving_lab", recorded_at: at(m, 14).replace("08:00", "09:30"), text: `Receipt test for PO-${id}: moisture ${Number(moisture) / 10}% against a maximum of ${(food.maxMoisture ?? 0) / 10}%. The lot is rejected and returned to the supplier.` }] } as unknown as Row);
        const r = addOrder(commodity, ids[0] as string, m, 20, units, { order: `PO-${id}`, incident });
        deliveries.push({ source_system: erp, receipt_id: `DEL-${r.id}`, order_id: `PO-${r.id}`, commodity, unit: food.sourceUnit, quantity_received: units, received_at: at(m, 27), handover_at: at(m, 27), moisture_permille: food.maxMoisture === null ? "" : food.maxMoisture - 10, acceptance_result: "PASS" });
        invoices.push({ source_system: erp, invoice_id: `INV-${r.id}`, order_id: `PO-${r.id}`, commodity, unit: food.sourceUnit, quantity: units, unit_price_cents: r.unitCents, total_cents: r.total, currency: "USD", recorded_at: at(m, 26) });
        payments.push({ source_system: erp, payment_id: `PAY-${r.id}`, order_id: `PO-${r.id}`, amount_cents: r.total, currency: "USD", paid_at: at(m, 28) });
      }
      if (spec.unconfirmedFailure === commodity && m === damageMonth) {
        const incident = `INC-${String(incidents.length + 1).padStart(2, "0")}`;
        const lost = Math.max(1, Math.round(units * between(0.12, 0.25)));
        incidents.push({
          source_system: erp,
          incident_id: incident,
          order_id: `PO-${id}`,
          reported_at: at(m, 22),
          affected_quantity_kg: lost,
          documents: [
            { document_id: `DOC-${incident}-WAREHOUSE`, author_role: "warehouse_manager", recorded_at: at(m, 20), text: `Bags from PO-${id} arrived damp at the school cluster warehouse in ${spec.region}, and many bags were torn. About ${lost.toLocaleString("en-US")} ${food.sourceUnit} cannot be used. In my view the supplier's packaging was not fit for the season.` },
            { document_id: `DOC-${incident}-TRANSPORT`, author_role: "transport_contractor", recorded_at: at(m, 19), text: `The program truck loaded PO-${id} at the depot on ${month(m)}-14, after the handover. Heavy rain closed the road for 3 days and the truck waited uncovered. It reached the school cluster warehouse on ${month(m)}-18.` },
          ],
        } as unknown as Row);
        const r = addOrder(commodity, ids[0] as string, m, 24, lost, { order: `PO-${id}`, incident });
        deliveries.push({ source_system: erp, receipt_id: `DEL-${r.id}`, order_id: `PO-${r.id}`, commodity, unit: food.sourceUnit, quantity_received: lost, received_at: at(m, 28), handover_at: at(m, 28), moisture_permille: food.maxMoisture === null ? "" : food.maxMoisture - 12, acceptance_result: "PASS" });
        invoices.push({ source_system: erp, invoice_id: `INV-${r.id}`, order_id: `PO-${r.id}`, commodity, unit: food.sourceUnit, quantity: lost, unit_price_cents: r.unitCents, total_cents: r.total, currency: "USD", recorded_at: at(m, 27) });
        payments.push({ source_system: erp, payment_id: `PAY-${r.id}`, order_id: `PO-${r.id}`, amount_cents: r.total, currency: "USD", paid_at: at(m, 28) });
      }
    }
  }
  checkAndWrite(dir, "orders", "orders.csv", COLUMNS.orders, orders);
  checkAndWrite(dir, "payments", "payments.csv", COLUMNS.payments, payments);
  checkAndWrite(dir, "invoices", "invoices.csv", COLUMNS.invoices, invoices);
  checkAndWrite(dir, "deliveries", "deliveries.csv", COLUMNS.deliveries, deliveries);
  checkAndWrite(dir, "incidents", "incidents.json", null, incidents);
  checkAndWrite(
    dir,
    "field-verifications",
    "field-verifications.csv",
    COLUMNS.verifications,
    Object.entries(supplierFor).flatMap(([commodity, ids]) =>
      ids.map((id) => ({
        source_system: field,
        verification_id: `FV-${id}-2026-02`,
        supplier_id: id,
        ration_version: 1,
        visited_at: at(2, int(2, 26)),
        verifier: "field-verifier",
        result: "PASS",
        moisture_permille: (FOODS[commodity] as Food).maxMoisture === null ? "" : ((FOODS[commodity] as Food).maxMoisture as number) - int(8, 20),
        confirmed_capacity_kg_per_month: Math.round(((need[commodity] as number) / 1000) * between(1.2, 2.5)),
        notes: `Current ${commodity.toLowerCase()} supplier. Storage and packaging checked.`,
      })),
    ),
  );

  countryRows.push({ country_iso3: spec.iso3, name: spec.name, flag: spec.flag, program_region: spec.region, expansion_id: expansionId, status: "ACTIVE", schools: Math.round(spec.students / int(260, 380)), students: spec.students, hub: spec.hub, currency: spec.currency, synthetic: "true" });
}

// Madagascar: the new expansion. Real WFP Androy prices; menus and leads; no supplier yet.
{
  const dir = join(OUT, MDG.iso3);
  mkdirSync(dir, { recursive: true });
  const expansionId = MDG.expansionId;
  // Its own source system: lead profiles belong to the expansion whose import first stored them (D4).
  const leadsSource = "mdg-androy/harbor-leads";
  const need: Record<string, number> = {};
  const mainQuantity: Record<string, number> = {};
  (MENUS.MDG as readonly MealSpec[]).forEach((meal, index) => {
    const servings = servingsOf(MDG.students, meal.daysPerWeek);
    mealRows.push({ meal_id: `MDG-M${index + 1}`, country_iso3: "MDG", expansion_id: expansionId, name: meal.name, servings_per_month: servings, days_served: meal.days, ingredients_json: JSON.stringify(Object.entries(meal.recipe).map(([commodity, quantity]) => ({ commodity, quantity }))), activity: "SCHOOL_MEALS", beneficiary_group: "SCHOOL_CHILD", beneficiaries: MDG.students });
    for (const [commodity, quantity] of Object.entries(meal.recipe)) {
      need[commodity] = (need[commodity] ?? 0) + servings * quantity;
      mainQuantity[commodity] = Math.max(mainQuantity[commodity] ?? 0, quantity);
    }
  });
  const foods = Object.keys(need);
  // Super Cereal has no WFP series in Androy: a synthetic import series, labeled as such.
  marketRows.push(...marketSeries({ region: "Androy", iso3: "MDG", fx: MDG.fx, currency: MDG.currency }, FOODS.CSB as Food, "CSB", 1.1, 0.03).filter((row) => row.commodity === (FOODS.CSB as Food).import));
  checkAndWrite(dir, "expansion", "expansion.csv", COLUMNS.expansion, [{ expansion_id: expansionId, name: "Harbor Meals school meals - Androy", region: "Androy", ration_version: 1, period_start: "2026-11-01", period_end: "2027-10-31", visibility_level: "PRIVATE" }]);
  checkAndWrite(
    dir,
    "expansion-commodities",
    "expansion-commodities.csv",
    COLUMNS.commodities,
    foods.map((commodity) => {
      const food = FOODS[commodity] as Food;
      const series = MDG_SERIES[commodity] ?? { local: food.import, import: food.import };
      return { expansion_id: expansionId, commodity, unit: food.base, quantity_per_meal: mainQuantity[commodity] as number, max_moisture_permille: food.maxMoisture ?? "", planned_per_month: need[commodity] as number, market_volume_estimate_per_month: MDG_MARKET[commodity] as number, market_volume_label: "synthetic", market_series_local: series.local, market_series_import: series.import };
    }),
  );
  // The 6 rice leads of the brief, then new leads for beans, oil, and Super Cereal.
  const baseSuppliers = readCsv(join(FIXTURE_DIR, "suppliers.csv")).filter((s) => s.source_system === "harbor-leads");
  const baseProfiles = JSON.parse(readFileSync(join(FIXTURE_DIR, "supplier-profiles.json"), "utf-8")) as Row[];
  const extra = [
    { id: "SUP-L7", commodity: "BEANS", name: "Tsaramaso Androy (fictif)", language: "fr", quote: 64, capacity: 3000, text: "Tsaramaso Androy (fictif). Haricots rouges secs, récolte 2026. Prix : 0,64 USD le kg, livré à Ambovombe. Capacité : 3 000 kg par mois. Sacs neufs de 50 kg." },
    { id: "SUP-L8", commodity: "BEANS", name: "South Pulses Trading (fictional)", language: "en", quote: 58, capacity: 1500, text: "South Pulses Trading (fictional). Red beans, sorted and cleaned. Price: 0.58 USD per kg at our Tsihombe store; transport not included. Capacity: 1,500 kg a month." },
    { id: "SUP-L9", commodity: "BEANS", name: "Coopérative Mahafaly (fictif)", language: "fr", quote: 69, capacity: 5000, text: "Coopérative Mahafaly (fictif). Haricots niébé et haricots rouges. Prix : 0,69 USD le kg livré. Capacité : 5 000 kg par mois. Analyse d'humidité sur demande." },
    { id: "SUP-L10", commodity: "OIL", name: "Huilerie du Sud (fictif)", language: "fr", quote: 205, capacity: 1200, text: "Huilerie du Sud (fictif). Huile végétale enrichie en vitamine A, bidons de 20 L. Prix : 2,05 USD le litre livré. Capacité : 1 200 L par mois." },
    { id: "SUP-L11", commodity: "OIL", name: "Indian Ocean Oils (fictional)", language: "en", quote: 189, capacity: 4000, text: "Indian Ocean Oils (fictional). Imported refined vegetable oil, not fortified. Price: 1.89 USD per litre CIF Toliara. Capacity: 4,000 L a month." },
    { id: "SUP-L12", commodity: "CSB", name: "Nutrition Imports SA (fictional)", language: "en", quote: 128, capacity: 8000, text: "Nutrition Imports SA (fictional). Super Cereal (corn-soya blend), WFP specification. Price: 1.28 USD per kg delivered to Ambovombe. Capacity: 8,000 kg a month." },
    { id: "SUP-L13", commodity: "CSB", name: "Farine Enrichie Madagasikara (fictif)", language: "fr", quote: 119, capacity: 2500, text: "Farine Enrichie Madagasikara (fictif). Farine de maïs et soja enrichie. Prix : 1,19 USD le kg. Capacité : 2 500 kg par mois. Certificat de conformité demandé en cours." },
  ];
  // International suppliers (Roshan, 2026-10-02, P20): Androy's markets are small, so most of every ingredient must
  // be imported. Each quotes near WFP's import median, delivered to the program, with a large capacity.
  const international = [
    { id: "SUP-I1", commodity: "RICE", country: "ZA", name: "Indian Ocean Grain Traders (fictional)", language: "en", quote: 62, capacity: 300000, text: "Indian Ocean Grain Traders (fictional), Durban. Long-grain white rice, 5% broken, 50 kg bags. Price: 0.62 USD per kg CIF Toliara; inland transport to Ambovombe quoted separately. Capacity: 300,000 kg a month. Lead time 6 to 8 weeks from order. Moisture at most 14% on the export certificate." },
    { id: "SUP-I2", commodity: "RICE", country: "MG", name: "Comptoir d'Importation de Toliara (fictif)", language: "fr", quote: 66, capacity: 600000, text: "Comptoir d'Importation de Toliara (fictif). Riz importé du Pakistan et de Thaïlande, sacs de 50 kg. Prix : 0,66 USD le kg livré au dépôt d'Ambovombe. Capacité : 600 000 kg par mois. Délai : 4 semaines. Stock tampon à Toliara." },
    { id: "SUP-I3", commodity: "BEANS", country: "TZ", name: "Tanzania Pulses Corridor (fictional)", language: "en", quote: 53, capacity: 60000, text: "Tanzania Pulses Corridor (fictional), Dar es Salaam. Red kidney beans, machine cleaned. Price: 0.53 USD per kg CIF Toliara. Capacity: 60,000 kg a month. Shipments every 3 weeks; phytosanitary certificate with each lot." },
    { id: "SUP-I4", commodity: "BEANS", country: "ET", name: "Ethiopian Bean Exporters (fictional)", language: "en", quote: 57, capacity: 100000, text: "Ethiopian Bean Exporters (fictional), Addis Ababa. Haricot and red beans. Price: 0.57 USD per kg delivered to Ambovombe. Capacity: 100,000 kg a month. Lead time 8 weeks." },
    { id: "SUP-I5", commodity: "OIL", country: "ZA", name: "Durban Edible Oils (fictional)", language: "en", quote: 210, capacity: 40000, text: "Durban Edible Oils (fictional). Refined sunflower oil fortified with vitamin A, 20 L jerrycans. Price: 2.10 USD per litre CIF Toliara. Capacity: 40,000 L a month. Fortification certificate for every batch." },
    { id: "SUP-I6", commodity: "OIL", country: "KE", name: "Mombasa Oil Refiners (fictional)", language: "en", quote: 218, capacity: 25000, text: "Mombasa Oil Refiners (fictional). Vegetable oil fortified with vitamin A and D. Price: 2.18 USD per litre delivered to Ambovombe. Capacity: 25,000 L a month." },
    { id: "SUP-I7", commodity: "CSB", country: "ZA", name: "Southern Africa Fortified Foods (fictional)", language: "en", quote: 122, capacity: 80000, text: "Southern Africa Fortified Foods (fictional), Johannesburg. Super Cereal (corn-soya blend) to the WFP specification, 25 kg bags. Price: 1.22 USD per kg CIF Toliara. Capacity: 80,000 kg a month. Lead time 6 weeks." },
  ];
  const suppliers: Row[] = [
    ...baseSuppliers.map((s) => ({ source_system: leadsSource, supplier_id: s.supplier_id as string, name: s.name as string, route: "LOCAL", country: "MG" })),
    ...extra.map((e) => ({ source_system: leadsSource, supplier_id: e.id, name: e.name, route: e.commodity === "CSB" && e.language === "en" ? "IMPORT" : "LOCAL", country: "MG" })),
    ...international.map((e) => ({ source_system: leadsSource, supplier_id: e.id, name: e.name, route: "IMPORT", country: e.country })),
  ];
  checkAndWrite(dir, "suppliers", "suppliers.csv", COLUMNS.suppliers, suppliers);
  checkAndWrite(dir, "supplier-profiles", "supplier-profiles.json", null, [
    ...baseProfiles.map((p) => ({ ...p, source_system: leadsSource })),
    ...extra.map((e) => ({ source_system: leadsSource, supplier_id: e.id, commodity: e.commodity, language: e.language, quoted_price_cents_per_kg: e.quote, claimed_capacity_kg_per_month: e.capacity, submitted_at: at(9, int(5, 25)), text: e.text })),
    // Fixed dates, so the extra leads above keep their generated dates and profile versions.
    ...international.map((e, index) => ({ source_system: leadsSource, supplier_id: e.id, commodity: e.commodity, language: e.language, quoted_price_cents_per_kg: e.quote, claimed_capacity_kg_per_month: e.capacity, submitted_at: `2026-09-${String(10 + index).padStart(2, "0")}T08:00:00Z`, text: e.text })),
  ]);
  for (const [kind, file, columns] of [
    ["orders", "orders.csv", COLUMNS.orders],
    ["payments", "payments.csv", COLUMNS.payments],
    ["invoices", "invoices.csv", COLUMNS.invoices],
    ["deliveries", "deliveries.csv", COLUMNS.deliveries],
  ] as const) {
    checkAndWrite(dir, kind, file, columns, []);
  }
  checkAndWrite(dir, "incidents", "incidents.json", null, []);
  checkAndWrite(dir, "field-verifications", "field-verifications.csv", COLUMNS.verifications, []);
  countryRows.unshift({ country_iso3: "MDG", name: MDG.name, flag: MDG.flag, program_region: MDG.region, expansion_id: expansionId, status: "NEW", schools: 20, students: MDG.students, hub: MDG.hub, currency: MDG.currency, synthetic: "true" });
}

// Investigators and their busy days, from 2026-10-01 for about 10 weeks.
const investigatorRows: Row[] = [];
const busyRows: Row[] = [];
const used = new Set<string>();
const personFrom = (hub: string): string => {
  const pool = (PEOPLE[hub] as string[]).filter((name) => !used.has(name));
  const name = pick(pool.length === 0 ? (PEOPLE[hub] as string[]) : pool);
  used.add(name);
  return name;
};
const addBusy = (id: string, start: number, length: number, reason: string) => {
  const s = new Date(Date.UTC(2026, 9, 1 + start));
  const e = new Date(Date.UTC(2026, 9, 1 + start + length - 1));
  busyRows.push({ busy_id: `${id}-B${busyRows.filter((b) => b.investigator_id === id).length + 1}`, investigator_id: id, start_date: s.toISOString().slice(0, 10), end_date: e.toISOString().slice(0, 10), reason, investigation_id: "" });
};
let inv = 0;
const allCountries = [{ ...MDG, localInvestigators: 1 }, ...COUNTRIES];
for (const country of allCountries) {
  for (let n = 0; n < country.localInvestigators; n += 1) {
    inv += 1;
    const id = `INV-${String(inv).padStart(3, "0")}`;
    const isMdg = country.iso3 === "MDG";
    investigatorRows.push({ investigator_id: id, name: (LOCAL_NAMES[country.iso3] as readonly string[])[n] ?? personFrom(country.hub), home_country_iso3: country.iso3, base_city: country.region, hub: country.hub, kind: "LOCAL", skills: n === 0 ? "SUPPLIER_AUDIT MARKET_SURVEY" : pick(["SUPPLIER_AUDIT", "MARKET_SURVEY", "SUPPLIER_AUDIT MARKET_SURVEY"]) });
    if (isMdg) {
      // Madagascar's only local investigator is on another program until mid-October.
      addBusy(id, 0, 15, "Another program: Atsimo-Andrefana school census");
      addBusy(id, 24, 5, "Leave");
    } else {
      addBusy(id, int(0, 6), int(3, 9), pick(["Another program", "Leave", "Training", "Distribution monitoring"]));
      addBusy(id, int(16, 30), int(4, 10), pick(["Another program", "Leave", "Distribution monitoring"]));
    }
  }
}
for (const [hub, count] of [["NBO", 3], ["DKR", 3], ["JNB", 2], ["PTY", 2], ["BKK", 2]] as const) {
  for (let n = 0; n < count; n += 1) {
    inv += 1;
    const id = `INV-${String(inv).padStart(3, "0")}`;
    const home = { NBO: "KEN", DKR: "SEN", JNB: "ZAF", PTY: "PAN", BKK: "THA" }[hub];
    investigatorRows.push({ investigator_id: id, name: (HUB_NAMES[hub] as readonly string[])[n] ?? personFrom(hub), home_country_iso3: home, base_city: HUB_CITY[hub] as string, hub, kind: "REGIONAL", skills: "SUPPLIER_AUDIT MARKET_SURVEY" });
    if (hub === "JNB" && n === 0) {
      // The earliest fly-in for Madagascar: free from the 6th.
      addBusy(id, 0, 5, "Another program: Mozambique market survey");
    } else {
      addBusy(id, int(0, 10), int(4, 12), pick(["Another program", "Leave", "Regional training"]));
      addBusy(id, int(20, 40), int(5, 12), pick(["Another program", "Leave"]));
    }
  }
}

// WFP-style activities beyond school meals (Roshan, 2026-10-01: "the WFP is not exclusively for students").
// General food distribution: a full daily ration for refugees and displaced people (the 2,100 kcal planning figure),
// in the region's staple. Nutrition support: Super Cereal for children aged 6 to 23 months. Synthetic caseloads.
const GENERAL_RATION: Record<string, Record<string, number>> = {
  EAST: { MAIZE: 420, BEANS: 60, OIL: 25, CSB: 50 },
  SOUTH: { MAIZE: 420, BEANS: 60, OIL: 25, CSB: 50 },
  SAHEL: { SORGHUM: 420, BEANS: 60, OIL: 25, CSB: 50 },
  ASIA: { RICE: 420, LENTILS: 60, OIL: 25, CSB: 50 },
  LATAM: { RICE: 400, BEANS: 60, OIL: 25 },
  MDG: { RICE: 400, BEANS: 60, OIL: 25, CSB: 50 },
};
const CASELOADS: Record<string, { readonly general: number; readonly nutrition: number; readonly who: string }> = {
  MDG: { general: 40000, nutrition: 5000, who: "drought-affected households" },
  KEN: { general: 180000, nutrition: 22000, who: "refugees in Kakuma and Kalobeyei" },
  ETH: { general: 250000, nutrition: 40000, who: "displaced people and refugees" },
  SOM: { general: 120000, nutrition: 30000, who: "displaced people" },
  SSD: { general: 200000, nutrition: 35000, who: "displaced people" },
  UGA: { general: 150000, nutrition: 18000, who: "refugees" },
  RWA: { general: 60000, nutrition: 8000, who: "refugees" },
  NER: { general: 90000, nutrition: 20000, who: "displaced people" },
  MLI: { general: 70000, nutrition: 15000, who: "displaced people" },
  TCD: { general: 160000, nutrition: 25000, who: "refugees around Lake Chad" },
  BFA: { general: 110000, nutrition: 18000, who: "displaced people" },
  NGA: { general: 200000, nutrition: 40000, who: "displaced people in Borno" },
  MOZ: { general: 80000, nutrition: 12000, who: "displaced people in Cabo Delgado" },
  MWI: { general: 45000, nutrition: 10000, who: "refugees in Dzaleka" },
  ZMB: { general: 0, nutrition: 9000, who: "" },
  ZWE: { general: 0, nutrition: 12000, who: "" },
  COD: { general: 180000, nutrition: 30000, who: "displaced people" },
  HTI: { general: 40000, nutrition: 0, who: "displaced people" },
  GTM: { general: 0, nutrition: 0, who: "" },
  BGD: { general: 300000, nutrition: 30000, who: "Rohingya refugees in Cox's Bazar" },
  NPL: { general: 0, nutrition: 8000, who: "" },
  LAO: { general: 0, nutrition: 6000, who: "" },
};
for (const [iso3, load] of Object.entries(CASELOADS)) {
  const spec = COUNTRIES.find((c) => c.iso3 === iso3);
  const menu = iso3 === "MDG" ? "MDG" : (spec?.menu as string);
  const expansionId = iso3 === "MDG" ? MDG.expansionId : `EXP-${iso3}-2026`;
  if (load.general > 0) {
    const ration = GENERAL_RATION[menu] as Record<string, number>;
    mealRows.push({
      meal_id: `${iso3}-G1`,
      country_iso3: iso3,
      expansion_id: expansionId,
      name: `General ration for ${load.who}`,
      servings_per_month: load.general * 30,
      days_served: "Every day (monthly distribution)",
      ingredients_json: JSON.stringify(Object.entries(ration).map(([commodity, quantity]) => ({ commodity, quantity }))),
      activity: "GENERAL_DISTRIBUTION",
      beneficiary_group: "GENERAL_POPULATION",
      beneficiaries: load.general,
    });
  }
  if (load.nutrition > 0) {
    mealRows.push({
      meal_id: `${iso3}-N1`,
      country_iso3: iso3,
      expansion_id: expansionId,
      name: "Super Cereal for children aged 6 to 23 months",
      servings_per_month: load.nutrition * 30,
      days_served: "Every day (monthly distribution)",
      ingredients_json: JSON.stringify([{ commodity: "CSB", quantity: 100 }]),
      activity: "NUTRITION_SUPPORT",
      beneficiary_group: "YOUNG_CHILD",
      beneficiaries: load.nutrition,
    });
  }
}

const reference = join(OUT, "reference");
writeCsv(join(reference, "countries.csv"), Object.keys(countryRows[0] as Row), countryRows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))));
writeCsv(join(reference, "meals.csv"), Object.keys(mealRows[0] as Row), mealRows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))));
writeCsv(join(reference, "investigators.csv"), Object.keys(investigatorRows[0] as Row), investigatorRows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))));
writeCsv(join(reference, "investigator-busy.csv"), Object.keys(busyRows[0] as Row), busyRows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))));
writeCsv(join(reference, "market-prices-synthetic.csv"), Object.keys(marketRows[0] as Row), marketRows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))));
console.log(`Wrote ${countryRows.length} countries, ${mealRows.length} meals, ${investigatorRows.length} investigators, ${busyRows.length} busy blocks, ${marketRows.length} synthetic market rows to ${OUT}.`);
