/**
 * The Foundry REST calls that the scripts make. The token comes from FOUNDRY_TOKEN, goes only into the
 * Authorization header, and is never logged or written to a file (CLAUDE.md hard rules).
 */
export const FOUNDRY_URL = "https://roshan-amble.usw-3.palantirfoundry.com";
export const ONTOLOGY_RID = "ri.ontology.main.ontology.17eb06bc-5728-411d-bcd2-772e1b451f20";

function token(): string {
  const value = process.env.FOUNDRY_TOKEN;
  if (value === undefined || value === "") throw new Error("Set FOUNDRY_TOKEN first. Never paste it into a file.");
  return value;
}

const headers = (): Record<string, string> => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

export type ApplyResult = { readonly ok: true } | { readonly ok: false; readonly status: number; readonly message: string };

/** Applies 1 Action and waits for its edits (VALIDATE_AND_EXECUTE). */
export async function applyAction(actionApiName: string, parameters: Readonly<Record<string, unknown>>): Promise<ApplyResult> {
  const response = await fetch(`${FOUNDRY_URL}/api/v2/ontologies/${ONTOLOGY_RID}/actions/${actionApiName}/apply`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ parameters, options: { mode: "VALIDATE_AND_EXECUTE", returnEdits: "NONE" } }),
  });
  if (response.ok) return { ok: true };
  const body = await response.text();
  return { ok: false, status: response.status, message: `HTTP ${response.status}: ${body.slice(0, 2000)}` };
}

/** Reads 1 object by its primary key, or null when it does not exist. */
export async function fetchObject(objectType: string, primaryKey: string): Promise<Record<string, unknown> | null> {
  const url = `${FOUNDRY_URL}/api/v2/ontologies/${ONTOLOGY_RID}/objects/${objectType}/${encodeURIComponent(primaryKey)}`;
  const response = await fetch(url, { headers: headers() });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Reading ${objectType} ${primaryKey}: HTTP ${response.status} ${(await response.text()).slice(0, 500)}`);
  return (await response.json()) as Record<string, unknown>;
}

/** Every object of a type whose property equals a value. */
export async function searchObjects(objectType: string, field: string, value: string): Promise<Record<string, unknown>[]> {
  const url = `${FOUNDRY_URL}/api/v2/ontologies/${ONTOLOGY_RID}/objects/${objectType}/search`;
  const objects: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  do {
    const response = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ where: { type: "eq", field, value }, pageSize: 1000, ...(pageToken === undefined ? {} : { pageToken }) }),
    });
    if (!response.ok) throw new Error(`Searching ${objectType}: HTTP ${response.status} ${(await response.text()).slice(0, 500)}`);
    const page = (await response.json()) as { data: Record<string, unknown>[]; nextPageToken?: string };
    objects.push(...page.data);
    pageToken = page.nextPageToken;
  } while (pageToken !== undefined);
  return objects;
}
