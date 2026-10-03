import { createClient, type Client } from "@osdk/client";
import { createPublicOauthClient, type PublicOauthClient } from "@osdk/oauth";
import { userIdFromSub } from "./view";

function env(name: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  if (value === undefined || value === "") throw new Error(`${name} is missing. See apps/web/.env.development.`);
  return value;
}

/**
 * D9: Ontology reads and writes, model calls, and Admin read (both amended 2026-09-30: the AI job calls GPT-4o with
 * the signed-in user's token, and each function reads the signed-in user to refuse a request in another person's
 * name). The app acts only as the signed-in user.
 */
const SCOPES = ["api:use-ontologies-read", "api:use-ontologies-write", "api:use-language-models-execute", "api:admin-read"];

export const auth: PublicOauthClient = createPublicOauthClient(
  env("VITE_FOUNDRY_CLIENT_ID"),
  env("VITE_FOUNDRY_API_URL"),
  env("VITE_FOUNDRY_REDIRECT_URL"),
  { scopes: SCOPES },
);

export const client: Client = createClient(env("VITE_FOUNDRY_API_URL"), env("VITE_FOUNDRY_ONTOLOGY_RID"), auth);

/**
 * The signed-in user's ID: the `sub` claim of the app's own token. It is only read, never stored or shown.
 * The server does not trust it: the Action's submission criteria require it to equal the current user (D6 fallback).
 */
export async function currentUserId(): Promise<string> {
  const token = await auth();
  const payload = token.split(".")[1];
  if (payload === undefined) throw new Error("The sign-in token has no payload.");
  const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown };
  if (typeof json.sub !== "string") throw new Error("The sign-in token has no user ID.");
  return userIdFromSub(json.sub);
}
