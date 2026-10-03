/**
 * Uploads the portfolio reference data (scripts/generate-portfolio.ts) to the backing datasets of CsCountry, CsMeal,
 * CsInvestigator, and CsInvestigatorBusy, and rewrites cs_market_price with the real WFP Androy rows plus the
 * synthetic series of the other programs (D2 decision 6: a script uploads reference data).
 *
 * The busy dataset holds only the generated blocks; a booking is an Action edit on top of it, so an upload keeps
 * every booking. Run: npm run portfolio:upload
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { uploadCsvSnapshot } from "./lib/dataset.js";
import { FIXTURE_DIR, MARKET_PRICES_FILE } from "./lib/paths.js";

const REFERENCE = join(FIXTURE_DIR, "..", "portfolio", "reference");

/** Backing datasets (docs/foundry-resources.md). */
const UPLOADS: readonly { readonly name: string; readonly datasetRid: string; readonly csv: () => string; readonly addFields?: Parameters<typeof uploadCsvSnapshot>[3] }[] = [
  { name: "cs_country", datasetRid: "ri.foundry.main.dataset.704b64c8-3347-4dd9-b4eb-935ec11842e5", csv: () => readFileSync(join(REFERENCE, "countries.csv"), "utf-8") },
  {
    name: "cs_meal",
    datasetRid: "ri.foundry.main.dataset.97d6120b-13f4-4453-a88e-e01a9a632d20",
    csv: () => readFileSync(join(REFERENCE, "meals.csv"), "utf-8"),
    // Added 2026-10-01 (WFP-style activities).
    addFields: [
      { name: "activity", type: "STRING", description: "SCHOOL_MEALS, GENERAL_DISTRIBUTION, or NUTRITION_SUPPORT." },
      { name: "beneficiary_group", type: "STRING", description: "SCHOOL_CHILD, GENERAL_POPULATION, or YOUNG_CHILD." },
      { name: "beneficiaries", type: "LONG", description: "People this ration reaches." },
    ],
  },
  { name: "cs_investigator", datasetRid: "ri.foundry.main.dataset.26dcf678-95ff-4301-8b71-ce83814b3ca4", csv: () => readFileSync(join(REFERENCE, "investigators.csv"), "utf-8") },
  { name: "cs_investigator_busy", datasetRid: "ri.foundry.main.dataset.5aefcf25-8e19-49e7-b1ae-ce5699175302", csv: () => readFileSync(join(REFERENCE, "investigator-busy.csv"), "utf-8") },
  {
    name: "cs_market_price",
    datasetRid: "ri.foundry.main.dataset.a7150324-76d8-4635-9b6a-f21bf7b4bd60",
    csv: () => {
      const real = readFileSync(MARKET_PRICES_FILE, "utf-8").trimEnd();
      const [header, ...synthetic] = readFileSync(join(REFERENCE, "market-prices-synthetic.csv"), "utf-8").trimEnd().split("\n");
      if (header !== real.split("\n")[0]) throw new Error("The synthetic market file's header differs from the real one.");
      return `${real}\n${synthetic.join("\n")}\n`;
    },
  },
];

for (const upload of UPLOADS) {
  const csv = upload.csv();
  const rows = csv.trimEnd().split("\n").length - 1;
  const transaction = await uploadCsvSnapshot(upload.datasetRid, `${upload.name}.csv`, csv, upload.addFields ?? []);
  console.log(`${upload.name}: ${rows} rows, transaction ${transaction}.`);
}
