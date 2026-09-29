/**
 * Builds data/public/androy-market-prices.csv from the HDX download (D4: reference data path).
 * It keeps Androy, the 4 market series of D11, retail prices, and the last 24 months.
 * It adds the CsMarketPrice key `marketId:series:date` and the exact micro-dollar price (D3, D4).
 * Run: npm run fixtures:market
 */
import { parseDecimalScaled } from "@clearspend/domain";
import { field, readCsv, writeCsv } from "./lib/csv.js";
import { MARKET_REGION, MARKET_SERIES } from "./lib/market-series.js";
import { HDX_DOWNLOADED_AT, HDX_SOURCE_FILE, HDX_SOURCE_URL, MARKET_PRICES_FILE } from "./lib/paths.js";

const FIRST_DATE = "2024-09-01";

const COLUMNS = [
  "price_id",
  "date",
  "admin1",
  "admin2",
  "market",
  "market_id",
  "commodity",
  "unit",
  "pricetype",
  "currency",
  "price",
  "usdprice",
  "usd_price_micros",
  "source_url",
  "downloaded_at",
] as const;

const series: ReadonlySet<string> = new Set(MARKET_SERIES);
const rows = readCsv(HDX_SOURCE_FILE)
  .filter(
    (row) =>
      row.admin1 === MARKET_REGION &&
      series.has(row.commodity ?? "") &&
      row.pricetype === "Retail" &&
      (row.date ?? "") >= FIRST_DATE,
  )
  .map((row) => {
    const context = `${HDX_SOURCE_FILE}, ${row.date} ${row.market_id} ${row.commodity}`;
    return {
      ...row,
      price_id: `${field(row, "market_id", context)}:${field(row, "commodity", context)}:${field(row, "date", context)}`,
      usd_price_micros: parseDecimalScaled(field(row, "usdprice", context), 6).toString(),
      source_url: HDX_SOURCE_URL,
      downloaded_at: HDX_DOWNLOADED_AT,
    };
  });

const ids = new Set(rows.map((row) => row.price_id));
if (ids.size !== rows.length) {
  throw new Error(`${rows.length - ids.size} rows share a price_id. The CsMarketPrice key must be unique.`);
}

writeCsv(MARKET_PRICES_FILE, COLUMNS, rows);
console.log(`Wrote ${rows.length} rows to ${MARKET_PRICES_FILE}.`);
