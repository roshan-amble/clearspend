import { createClient, type Client } from "@osdk/client";
import { createPublicOauthClient, type PublicOauthClient } from "@osdk/oauth";

function env(name: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  if (value === undefined || value === "") throw new Error(`${name} is missing. See apps/supplier/.env.development.`);
  return value;
}

/**
 * D9 and P11: Ontology read and write (only within the app's restricted scope), and Admin read, because the submit
 * function refuses an actorUserId that is not the signed-in user. No model calls.
 */
const SCOPES = ["api:use-ontologies-read", "api:use-ontologies-write", "api:admin-read"];

export const auth: PublicOauthClient = createPublicOauthClient(env("VITE_FOUNDRY_CLIENT_ID"), env("VITE_FOUNDRY_API_URL"), env("VITE_FOUNDRY_REDIRECT_URL"), { scopes: SCOPES });

export const client: Client = createClient(env("VITE_FOUNDRY_API_URL"), env("VITE_FOUNDRY_ONTOLOGY_RID"), auth);

/** The signed-in user's ID from the token's `sub`: 16 bytes in base64, as the 36-character UUID text. */
export async function currentUserId(): Promise<string> {
  const token = await auth();
  const payload = token.split(".")[1];
  if (payload === undefined) throw new Error("The sign-in token has no payload.");
  const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown };
  if (typeof json.sub !== "string") throw new Error("The sign-in token has no user ID.");
  const bytes = Uint8Array.from(atob(json.sub.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  if (bytes.length !== 16) throw new Error("The sign-in token's user ID is not 16 bytes.");
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
