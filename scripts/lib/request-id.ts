import { createHash } from "node:crypto";

/**
 * A request ID derived from a stable key, in UUID form. A script that runs again sends the same ID, so the Action
 * answers REPLAYED instead of writing a copy (D6 mechanism 5).
 */
export function stableRequestId(key: string): string {
  const hex = createHash("sha256").update(key, "utf-8").digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
