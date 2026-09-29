import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FIXTURE_DIR = join(REPO_ROOT, "data", "fixtures");
export const HDX_SOURCE_FILE = join(REPO_ROOT, "data", "public", "wfp_food_prices_mdg.csv");
export const MARKET_PRICES_FILE = join(REPO_ROOT, "data", "public", "androy-market-prices.csv");

export const HDX_SOURCE_URL = "https://data.humdata.org/dataset/wfp-food-prices-for-madagascar";
/** Roshan downloaded the file in a browser on this date (docs/design/platform-facts.md). */
export const HDX_DOWNLOADED_AT = "2026-09-27";
