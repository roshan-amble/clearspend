/**
 * D4 "Namespaces" (Roshan, 2026-09-29): a demo or test run imports the same fixtures into a fresh namespace.
 * Every source_system gets the prefix `<namespace>/`, and the expansion ID gets the suffix `-<NAMESPACE>`, so no
 * logical ID collides with another namespace. With no namespace, rows are unchanged.
 */
export function namespaceRow(row: Readonly<Record<string, unknown>>, namespace: string | null): Record<string, unknown> {
  if (namespace === null) return { ...row };
  if (!/^[a-z][a-z0-9]{0,15}$/.test(namespace)) {
    throw new Error(`Namespace "${namespace}" must be lower-case letters and digits, starting with a letter.`);
  }
  const out: Record<string, unknown> = { ...row };
  if (typeof row.source_system === "string") out.source_system = `${namespace}/${row.source_system}`;
  if (typeof row.expansion_id === "string") out.expansion_id = namespaceExpansion(row.expansion_id, namespace);
  return out;
}

export function namespaceExpansion(expansionId: string, namespace: string | null): string {
  return namespace === null ? expansionId : `${expansionId}-${namespace.toUpperCase()}`;
}
