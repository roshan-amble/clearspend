import { useState } from "react";
import { auth } from "./client";

/**
 * Development only (D9, P11): what this site's own token may read. Foundry gives the supplier app access to
 * OAuth scopes ∩ the app's restricted resources ∩ the user's permissions, so even an administrator signed in here is
 * refused a market price or a cost line. Each row is 1 real request with this site's token; nothing is written.
 */
const PROBES: readonly { readonly label: string; readonly path: string; readonly method?: "POST"; readonly body?: string; readonly expected: "allowed" | "refused" }[] = [
  { label: "Program names (CsCountry)", path: "objects/CsCountry?pageSize=1", expected: "allowed" },
  { label: "WFP market prices (CsMarketPrice)", path: "objects/CsMarketPrice?pageSize=1", expected: "refused" },
  { label: "Our cost lines (CsCostLine)", path: "objects/CsCostLine?pageSize=1", expected: "refused" },
  { label: "Supplier profiles (CsSupplierProfileVersion)", path: "objects/CsSupplierProfileVersion?pageSize=1", expected: "refused" },
  { label: "Our need and suppliers (query csCountry)", path: "queries/csCountry/execute", method: "POST", body: JSON.stringify({ parameters: { countryIso3: "MDG" } }), expected: "refused" },
  { label: "Other suppliers' offers (CsSupplierBid)", path: "objects/CsSupplierBid?pageSize=5", expected: "refused" },
];

interface Result {
  readonly status: number;
  readonly rows: number | null;
}

export function ScopeCheck() {
  const [results, setResults] = useState<Record<string, Result> | null>(null);
  const [running, setRunning] = useState(false);
  const env = import.meta.env as Record<string, string | undefined>;
  async function run() {
    setRunning(true);
    const token = await auth();
    const out: Record<string, Result> = {};
    for (const probe of PROBES) {
      const response = await fetch(`${env.VITE_FOUNDRY_API_URL}/api/v2/ontologies/${env.VITE_FOUNDRY_ONTOLOGY_RID}/${probe.path}`, {
        method: probe.method ?? "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(probe.body === undefined ? {} : { body: probe.body }),
      });
      const json = (await response.json().catch(() => null)) as { data?: unknown[] } | null;
      out[probe.label] = { status: response.status, rows: response.ok && Array.isArray(json?.data) ? json.data.length : null };
    }
    setResults(out);
    setRunning(false);
  }
  return (
    <section className="card" aria-label="Scope check" style={{ borderStyle: "dashed" }}>
      <div className="card-h">
        <h3>Scope check</h3>
        <span className="chip">development only</span>
        <button className="btn sm" type="button" style={{ marginLeft: "auto" }} disabled={running} onClick={() => void run()}>
          {running ? "Checking…" : "What can this site read?"}
        </button>
      </div>
      {results === null ? null : (
        <table>
          <thead>
            <tr>
              <th>With this site's token</th>
              <th>Foundry answered</th>
              <th>Expected</th>
            </tr>
          </thead>
          <tbody>
            {PROBES.map((probe) => {
              const r = results[probe.label];
              const allowed = r !== undefined && r.status >= 200 && r.status < 300;
              const asExpected = allowed === (probe.expected === "allowed");
              return (
                <tr key={probe.label}>
                  <td>{probe.label}</td>
                  <td className="mono">
                    <span className={allowed ? "chip ok" : "chip bad"}>{allowed ? `allowed${r?.rows === null || r === undefined ? "" : ` · ${r.rows} row${r.rows === 1 ? "" : "s"}`}` : `refused · HTTP ${r?.status}`}</span>
                  </td>
                  <td>
                    <span className={asExpected ? "chip ok" : "chip warn"}>{asExpected ? `as expected: ${probe.expected}` : `NOT as expected: should be ${probe.expected}`}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
