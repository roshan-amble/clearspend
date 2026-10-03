/**
 * D2 decision 6: a script uploads reference data to its backing dataset. Foundry Datasets API v2: open a SNAPSHOT
 * transaction, upload 1 CSV file, commit, and keep the dataset's schema on the new version. The token comes from
 * FOUNDRY_TOKEN and goes only into the Authorization header.
 */
import { FOUNDRY_URL } from "./foundry.js";

const token = (): string => {
  const value = process.env.FOUNDRY_TOKEN;
  if (value === undefined || value === "") throw new Error("Set FOUNDRY_TOKEN first. Never paste it into a file.");
  return value;
};

async function call(method: string, path: string, body?: string, contentType = "application/json"): Promise<unknown> {
  const response = await fetch(`${FOUNDRY_URL}${path}`, { method, headers: { Authorization: `Bearer ${token()}`, "Content-Type": contentType }, ...(body === undefined ? {} : { body }) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path.split("?")[0]}: HTTP ${response.status} ${text.slice(0, 600)}`);
  return text === "" ? null : (JSON.parse(text) as unknown);
}

export async function getSchema(datasetRid: string): Promise<unknown> {
  return call("GET", `/api/v2/datasets/${datasetRid}/getSchema?preview=true&branchName=master`);
}

/** The full schema of the latest version, with its CSV reader settings (the v2 API returns only the fields). */
async function fullSchema(datasetRid: string): Promise<{ readonly schema: Record<string, unknown> }> {
  return (await call("GET", `/foundry-metadata/api/schemas/datasets/${datasetRid}/branches/master`)) as { schema: Record<string, unknown> };
}

/**
 * Replaces the dataset's rows with 1 CSV file. A new version starts without a schema, so the previous version's full
 * schema (fields and the CSV reader settings) is written onto it; the file must keep the same header.
 */
export async function uploadCsvSnapshot(
  datasetRid: string,
  fileName: string,
  csv: string,
  /** Columns the file adds at the end; appended to the schema when it does not have them yet. */
  addFields: readonly { readonly name: string; readonly type: "STRING" | "LONG"; readonly description: string }[] = [],
): Promise<string> {
  const { schema } = await fullSchema(datasetRid);
  const fields = schema.fieldSchemaList as { name: string }[];
  for (const field of addFields) {
    if (fields.some((f) => f.name === field.name)) continue;
    fields.push({ type: field.type, name: field.name, nullable: null, userDefinedTypeClass: null, customMetadata: { description: field.description }, arraySubtype: null, precision: null, scale: null, mapKeyType: null, mapValueType: null, subSchemas: null } as unknown as { name: string });
  }
  if (schema.dataFrameReaderClass !== "com.palantir.foundry.spark.input.TextDataFrameReader") {
    throw new Error(`${datasetRid} has no CSV reader settings to carry over (${String(schema.dataFrameReaderClass)}).`);
  }
  const transaction = (await call("POST", `/api/v2/datasets/${datasetRid}/transactions?branchName=master`, JSON.stringify({ transactionType: "SNAPSHOT" }))) as { rid: string };
  await call("POST", `/api/v2/datasets/${datasetRid}/files/${encodeURIComponent(fileName)}/upload?transactionRid=${transaction.rid}`, csv, "application/octet-stream");
  await call("POST", `/api/v2/datasets/${datasetRid}/transactions/${transaction.rid}/commit`);
  await call("POST", `/foundry-metadata/api/schemas/datasets/${datasetRid}/branches/master?endTransactionRid=${transaction.rid}`, JSON.stringify(schema));
  return transaction.rid;
}

export async function readCsvTable(datasetRid: string, rowLimit = 5): Promise<string> {
  const response = await fetch(`${FOUNDRY_URL}/api/v2/datasets/${datasetRid}/readTable?format=CSV&branchName=master&rowLimit=${rowLimit}`, { headers: { Authorization: `Bearer ${token()}` } });
  const text = await response.text();
  if (!response.ok) throw new Error(`readTable: HTTP ${response.status} ${text.slice(0, 400)}`);
  return text;
}
