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

/** The user ID in FOUNDRY_TOKEN (its `sub` claim). The token itself is never printed. */
export function currentUserId(): string {
  const payload = token().split(".")[1];
  const sub = payload === undefined ? undefined : (JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as { sub?: unknown }).sub;
  if (typeof sub !== "string") throw new Error("FOUNDRY_TOKEN has no user ID.");
  // `sub` is the user's UUID as 16 bytes in base64. Actions use the 36-character UUID text.
  const hex = Buffer.from(sub, "base64").toString("hex");
  if (hex.length !== 32) throw new Error("FOUNDRY_TOKEN's user ID is not 16 bytes.");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const headers = (): Record<string, string> => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

export type ApplyResult = { readonly ok: true } | { readonly ok: false; readonly status: number; readonly message: string };

/**
 * Applies 1 Action and waits for its edits (VALIDATE_AND_EXECUTE).
 * A refusal by submission criteria is HTTP 200 with `validation.result` INVALID, and nothing is written.
 * So HTTP 200 alone is not success (found 2026-09-30).
 */
export async function applyAction(actionApiName: string, parameters: Readonly<Record<string, unknown>>): Promise<ApplyResult> {
  const response = await fetch(`${FOUNDRY_URL}/api/v2/ontologies/${ONTOLOGY_RID}/actions/${actionApiName}/apply`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ parameters, options: { mode: "VALIDATE_AND_EXECUTE", returnEdits: "NONE" } }),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, status: response.status, message: `HTTP ${response.status}: ${text.slice(0, 2000)}` };
  const body = (text === "" ? {} : JSON.parse(text)) as {
    validation?: { result?: string; submissionCriteria?: { configuredFailureMessage?: string; result?: string }[]; parameters?: unknown };
  };
  if (body.validation?.result === "INVALID") {
    const reasons = (body.validation.submissionCriteria ?? [])
      .filter((criterion) => criterion.result === "INVALID")
      .map((criterion) => criterion.configuredFailureMessage ?? "a submission criterion is unmet");
    return { ok: false, status: response.status, message: `INVALID: ${[...reasons, JSON.stringify(body.validation.parameters ?? {})].join("; ").slice(0, 2000)}` };
  }
  return { ok: true };
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
