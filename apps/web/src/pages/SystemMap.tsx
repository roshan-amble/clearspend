import { Link } from "react-router-dom";
import * as sdk from "../sdk";
import { Section } from "../ui";

/**
 * Every part of every screen, what it reads, and which Action or function it runs. The status is live: a part whose
 * Action or query function is not in this app's SDK yet says so.
 */
type Part = readonly [component: string, reads: string, runs: string, scenarios: string, needs?: string];

const SCREENS: readonly { readonly name: string; readonly to: string; readonly color: string; readonly parts: readonly Part[] }[] = [
  {
    name: "Overview",
    to: ".",
    color: "var(--brand)",
    parts: [
      ["Decision readiness strip", "CsExpansion counters, CsCostSnapshot.purchasesJson / incidentsJson, CsCostLine.eligibility", "—", "1, 10"],
      ["Ingredient cards: cost for 1 accepted meal, meals per $1", "CsCostLine.perMealJson (nominal, supplier range, mealsPerDollar)", "computeSnapshot (server)", "2, 7"],
      ["Card sparkline: cost by evidence revision", "Every CsCostSnapshot and CsCostLine of the expansion", "—", "4"],
      ["Price board: paid, quoted, market, target", "csPriceHistory", "csPriceHistory (query function)", "7, 8", "csPriceHistory"],
      ["Cost comparison chart", "CsCostLine (supplierLow/High, quoted, eligibility)", "—", "2, 7"],
      ["AI explanation", "CsAiRun (EXPLANATION)", "cs-start-ai-job → csStartAiJob", "9"],
      ["Needs you queue", "CsCostSnapshot.incidentsJson, CsAiRun, CsDecision", "links to the Actions", "10"],
      ["Spend and accepted volume by month", "csPriceHistory", "csPriceHistory (query function)", "1, 2", "csPriceHistory"],
      ["Record a sourcing decision", "CsDecision", "cs-record-sourcing-decision → csRecordSourcingDecision", "9, 10"],
    ],
  },
  {
    name: "Price intelligence",
    to: "prices",
    color: "var(--rice)",
    parts: [
      ["Target vs realized table", "CsCostLine (nominal, supplier, route), quotes, csPriceHistory targets", "—", "2"],
      ["Set a target price (display only)", "CsExpansionCommodity.targetCentsPer1000", "cs-set-commodity-target → csSetCommodityTarget", "—", "csSetCommodityTarget"],
      ["Unit price over time, per food", "csPriceHistory (purchases, quotes, market medians)", "csPriceHistory (query function)", "7, 8", "csPriceHistory"],
      ["Cost for 1 meal by revision, per food", "CsCostSnapshot history", "—", "4"],
      ["Market pressure, per food", "CsCostSnapshot.marketIndicatorsJson", "marketPressure (server)", "8"],
    ],
  },
  {
    name: "Incident review",
    to: "incidents",
    color: "var(--beans)",
    parts: [
      ["Cause status lanes", "CsCostSnapshot.incidentsJson, CsAiRun (CAUSE), CsDecision", "classifyByRule (server)", "3, 4"],
      ["Timeline and documents", "CsPurchaseOrder, CsDelivery, CsIncident.documents, replacesOrderLogicalId", "—", "3, 4"],
      ["AI cause proposal", "CsAiRun, CsCauseProposal", "cs-start-ai-job (CAUSE) → validateCauseOutput", "4"],
      ["Confirm the cause", "CsDecision", "cs-confirm-incident-cause → csConfirmIncidentCause", "4, 9"],
      ["Cost by revision for the supplier", "CsCostSnapshot history", "—", "4"],
      ["Purchases and reconciliation", "CsCostSnapshot.purchasesJson", "reconcilePurchase (server)", "1"],
    ],
  },
  {
    name: "Suppliers & leads",
    to: "leads",
    color: "var(--oil)",
    parts: [
      ["Supplier pipeline", "CsCostLine.eligibility, CsDecision (SELECT_FIELD_VISIT), CsFieldVerification", "supplierEligibility (server)", "6, 9"],
      ["Quote vs claimed capacity", "CsSupplierProfileVersion, CsExpansionCommodity.plannedPerMonth", "—", "6, 7"],
      ["Compare up to 4", "CsCostLine, CsFieldVerification, CsSupplierProfileVersion, CsPurchaseOrder", "—", "7, 9"],
      ["Profile, claims, cited spans, untrusted text", "CsAiRun (EXTRACTION)", "cs-start-ai-job (EXTRACTION) → validateExtractionOutput", "6"],
      ["Select for a field visit", "CsDecision", "cs-select-field-visit → csSelectFieldVisit", "9"],
      ["Record a field verification", "CsFieldVerification", "cs-record-field-verification → csRecordFieldVerification", "9"],
      ["Outreach draft and approval", "CsAiRun (OUTREACH_DRAFT), CsOutreachMessage", "cs-start-ai-job, cs-decide-outreach + notification to Roshan only", "D1"],
    ],
  },
  {
    name: "Data studio (development only)",
    to: "studio",
    color: "var(--target)",
    parts: [
      ["Expansion switcher and new namespace", "CsExpansion, data/fixtures", "cs-import-evidence-batch × 9, cs-record-field-verification", "Reset", "csImportEvidenceBatch"],
      ["Demo scenarios", "data/fixtures, later batches", "cs-import-evidence-batch, cs-record-field-verification", "5, 9", "csImportEvidenceBatch"],
      ["Record grid with versions", "Every evidence type, heads()", "—", "5"],
      ["Edit as a new version, with a dry run", "sourceRowOf, parseEvidenceRows, planImport", "cs-import-evidence-batch", "5", "csImportEvidenceBatch"],
      ["File import with a row preview", "parseEvidenceRows, planImport", "cs-import-evidence-batch", "5", "csImportEvidenceBatch"],
      ["Import batches", "CsImportBatch", "—", "5"],
    ],
  },
];

const SCENARIOS: readonly (readonly [string, string, string, readonly string[]])[] = [
  ["1", "Reconciliation gate", "PO-A5 out, MISSING_INVOICE", ["Overview", "Incidents"]],
  ["2", "Hero cost", "nominal, supplier, route; a range while INC-A4 is unconfirmed", ["Overview", "Prices"]],
  ["3", "Deterministic cause", "INC-A3 by the rule, no AI call", ["Incidents"]],
  ["4", "Cause confirmation", "AI changes nothing; a confirmation changes the supplier metric; history keeps both", ["Incidents", "Prices"]],
  ["5", "Import replay and identity", "replay, version, distinct payments, replacement", ["Studio"]],
  ["6", "Lead extraction", "SUP-L1 French spans, SUP-L2 moisture gap, SUP-L3 capacity, SUP-L5 flagged", ["Leads"]],
  ["7", "Unknown risk", "0 batches = unknown; a quote is never paid", ["Overview", "Leads"]],
  ["8", "Market indicator", "real prices with source and date; not a forecast", ["Overview", "Prices"]],
  ["9", "New evidence, retry, stale", "SUP-L1 eligible, SUP-L4 not; historical AI label; replay; stale fails", ["Leads", "Studio", "Incidents"]],
  ["10", "Full connected demo", "import → inspect → confirm → select → verify → decide → reload → history", ["Overview", "Incidents", "Leads", "Studio"]],
];
const COLUMNS = ["Overview", "Prices", "Incidents", "Leads", "Studio"];

const inSdk = (name: string) => (sdk as Record<string, unknown>)[name] !== undefined;

export function SystemMap() {
  const all = SCREENS.flatMap((s) => s.parts);
  const waiting = all.filter((p) => p[4] !== undefined && !inSdk(p[4]));
  return (
    <>
      <div className="grid g3">
        <section className="card" style={{ padding: "16px 18px" }}>
          <div className="note" style={{ fontWeight: 600 }}>
            PARTS LIVE ON FOUNDRY
          </div>
          <div className="kpi-big" style={{ color: "var(--ok)" }}>
            {all.length - waiting.length}
          </div>
          <div className="note">Each reads stored objects or runs a published Action or function.</div>
        </section>
        <section className="card" style={{ padding: "16px 18px" }}>
          <div className="note" style={{ fontWeight: 600 }}>
            WAITING ON THE APP SDK
          </div>
          <div className="kpi-big" style={{ color: waiting.length === 0 ? "var(--ok)" : "var(--warn)" }}>
            {waiting.length}
          </div>
          <div className="note">{waiting.length === 0 ? "None." : `Needs ${[...new Set(waiting.map((p) => p[4]))].join(", ")} in this app's SDK.`}</div>
        </section>
        <section className="card" style={{ padding: "16px 18px" }}>
          <div className="note" style={{ fontWeight: 600 }}>
            SCENARIOS WITH A SCREEN
          </div>
          <div className="kpi-big" style={{ color: "var(--brand)" }}>
            {SCENARIOS.length} of 10
          </div>
          <div className="note">The brief's section 11 scenarios.</div>
        </section>
      </div>

      <Section title="Demo coverage" sub="Brief section 11 scenarios">
      <section className="card" aria-label="Demo coverage" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Scenario</th>
                <th>Must show</th>
                {COLUMNS.map((c) => (
                  <th key={c} className="r">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCENARIOS.map(([n, title, must, screens]) => (
                <tr key={n}>
                  <td className="mono" style={{ fontWeight: 700 }}>
                    {n}
                  </td>
                  <td style={{ fontWeight: 600 }}>{title}</td>
                  <td className="note">{must}</td>
                  {COLUMNS.map((c) => (
                    <td key={c} className="r">
                      {screens.includes(c) ? <span className="chip ok">✓</span> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </Section>

      <Section title="Components">
      {SCREENS.map((screen) => (
        <section key={screen.name} className="card" style={{ overflow: "hidden" }}>
          <div style={{ height: 4, background: screen.color }} />
          <div className="card-h">
            <h3>{screen.name}</h3>
            <Link className="btn sm ghost" to={screen.to === "." ? ".." : `../${screen.to}`} style={{ marginLeft: "auto" }}>
              Open screen →
            </Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Part</th>
                  <th>Reads</th>
                  <th>Writes or runs</th>
                  <th>Status</th>
                  <th>Scenario</th>
                </tr>
              </thead>
              <tbody>
                {screen.parts.map(([component, reads, runs, scenarios, needs]) => (
                  <tr key={component}>
                    <td style={{ fontWeight: 600 }}>{component}</td>
                    <td className="note">{reads}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {runs}
                    </td>
                    <td>{needs === undefined || inSdk(needs) ? <span className="chip ok">Live</span> : <span className="chip warn">Waiting · {needs}</span>}</td>
                    <td className="num">{scenarios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      </Section>
    </>
  );
}
