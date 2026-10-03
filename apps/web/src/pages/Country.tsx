import { FOOD_NAME, priceUnit, STEP_GROUP_NAME, type AnalysisOutput, type CountryView, type Step } from "@clearspend/domain";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Failed, outputOf, RunBadges, StartAiJob } from "../Ai";
import { axis, Chart } from "../charts";
import { ExpansionProvider } from "../data/expansion";
import { loadCountry, loadLatestRun, loadPriceChart, useLoad } from "../data/portfolio";
import { FnRow, FOOD_VAR, Icon, Section } from "../ui";
import { dollarsText, plot, shareText, shortId, thousands, usdPerKgText } from "../view";
import { Incidents } from "./Incidents";
import { Investigations } from "./Investigations";

export const food = (commodity: string): string => {
  const name = FOOD_NAME[commodity] ?? commodity.toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};

interface CountryContext {
  readonly view: CountryView;
  readonly reload: () => void;
}
export const useCountry = (): CountryContext => useOutletContext<CountryContext>();

/**
 * P17 (Roshan, 2026-10-02): every country has 5 pages and nothing else: Ingredients, Suppliers, Incidents, AI
 * analysis, Investigations. The header says where the program stands; the pages load the country once.
 */
export function CountryLayout() {
  const { iso3 = "" } = useParams();
  const { state, reload } = useLoad(() => loadCountry(iso3), iso3);
  if (state.kind === "loading") return <p className="loading" role="status">Loading {iso3} from Foundry…</p>;
  if (state.kind === "error")
    return (
      <div className="error-box" role="alert">
        <b>Could not load {iso3}.</b> {state.message}
      </div>
    );
  const view = state.data;
  const { country, summary } = view;
  const incidents = view.recommendations.filter((r) => r.kind === "UNCONFIRMED_FAILURE" || r.kind === "SUPPLIER_FAILURES").length;
  const investigations = summary.investigations.open + summary.investigations.scheduled;
  const tabs = [
    { to: "ingredients", label: "Ingredients", badge: null },
    { to: "suppliers", label: "Suppliers", badge: summary.bidsToReview > 0 ? { n: summary.bidsToReview, tone: "warn" } : null },
    { to: "incidents", label: "Incidents", badge: incidents > 0 ? { n: incidents, tone: "bad" } : null },
    { to: "analysis", label: "AI analysis", badge: summary.steps > 0 ? { n: summary.steps, tone: "ai" } : null },
    { to: "investigations", label: "Investigations", badge: investigations > 0 ? { n: investigations, tone: "brand" } : null },
  ] as const;
  return (
    <>
      <section className="card" style={{ padding: "18px 24px", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">
          {country.flag}
        </span>
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 24, fontWeight: 750, letterSpacing: "-.02em" }}>
            {country.name}{" "}
            <span className={summary.started ? "chip" : "chip rice"} style={{ verticalAlign: "middle" }}>
              {summary.started ? "active" : "new program"}
            </span>
          </div>
          <div className="note" style={{ color: "var(--ink2)", marginTop: 2 }}>
            {country.region} ·{" "}
            {summary.started
              ? `${summary.peopleReached.toLocaleString("en-US")} people reached · ${dollarsText(summary.monthlyCost.low)} of food a month`
              : `0 people reached · ${summary.peoplePlanned.toLocaleString("en-US")} planned · nothing delivered yet`}{" "}
            · {summary.foodsSourced} of {summary.foods} ingredients with a supplier
          </div>
        </div>
      </section>
      <nav className="tabs" aria-label={`${country.name} pages`}>
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? "on" : "")}>
            {t.label}
            {t.badge === null ? null : (
              <span className={`chip ${t.badge.tone}`} style={{ marginLeft: 8 }}>
                {t.badge.n}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet context={{ view, reload } satisfies CountryContext} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 1. Ingredients: what we buy, from whom, at what price, against the lowest price available.

const IDEAL_SOURCE: Record<string, string> = { LOCAL_MARKET: "local market (WFP)", IMPORT_MARKET: "import market (WFP)", OFFER: "offer" };

export function IngredientsPage() {
  const { view } = useCountry();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(view.ingredients.find((i) => i.inUse.length > 0)?.commodity ?? view.ingredients[0]?.commodity ?? "");
  const ingredient = view.ingredients.find((i) => i.commodity === selected);
  return (
    <>
      <Section title="Ingredients" sub="What we buy, from whom, and against the lowest price available · click a row for its price chart">
        <section className="card" aria-label="Ingredients" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="rows">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Supplied by</th>
                  <th className="r">Need a month</th>
                  <th className="r">We pay</th>
                  <th className="r">Lowest available</th>
                  <th className="r">Over the lowest price</th>
                  <th>Used in</th>
                </tr>
              </thead>
              <tbody>
                {view.ingredients.map((ing) => {
                  const unit = ing.commodity === "OIL" ? "L" : "kg";
                  const per = priceUnit(ing.commodity);
                  const offers = ing.suppliers.filter((s) => s.role !== "CURRENT").length;
                  return (
                    <tr key={ing.commodity} onClick={() => setSelected(ing.commodity)} style={{ cursor: "pointer", background: ing.commodity === selected ? "var(--brand-soft)" : undefined }}>
                      <td style={{ fontWeight: 650, whiteSpace: "nowrap" }}>
                        <span className="dot" style={{ background: FOOD_VAR[ing.commodity] ?? "var(--brand-2)", marginRight: 8 }} />
                        {food(ing.commodity)}
                      </td>
                      <td>
                        {ing.inUse.length === 0 ? (
                          <span className="chip warn">
                            no supplier yet · {offers} offer{offers === 1 ? "" : "s"}
                          </span>
                        ) : (
                          ing.inUse.map((s) => (
                            <div key={s.supplierLogicalId} style={{ whiteSpace: "nowrap" }}>
                              <b>{shortId(s.supplierLogicalId)}</b> <span className="note">{s.name.replace(" (fictional)", "")}</span>{" "}
                              <span className={s.route === "LOCAL" ? "chip ok" : "chip"}>{s.route === "LOCAL" ? "local" : "import"}</span>
                            </div>
                          ))
                        )}
                      </td>
                      <td className="r mono" style={{ whiteSpace: "nowrap" }}>
                        {thousands(ing.needPerMonth)} {unit}
                      </td>
                      <td className="r mono" style={{ whiteSpace: "nowrap" }}>
                        {ing.unitCost === null || ing.unitCost.basis !== "PAID" ? <span className="note">not buying yet</span> : `${usdPerKgText(ing.unitCost.low)} $/${per}`}
                      </td>
                      <td className="r mono" style={{ whiteSpace: "nowrap" }}>
                        {ing.ideal === null ? "—" : `${usdPerKgText(ing.ideal.centsPerUnit)} $/${per}`}
                        {ing.ideal === null ? null : (
                          <div className="note">
                            {IDEAL_SOURCE[ing.ideal.source]}
                            {ing.ideal.supplierLogicalId === null ? "" : ` · ${shortId(ing.ideal.supplierLogicalId)}`}
                          </div>
                        )}
                      </td>
                      <td className="r mono" style={{ whiteSpace: "nowrap", fontWeight: 650, color: (plot(ing.gapShare) ?? 0) > 0 ? "var(--bad)" : "var(--ok)" }}>
                        {ing.gapShare === null ? <span className="note">—</span> : (plot(ing.gapShare) ?? 0) > 0 ? `+${shareText(ing.gapShare)}` : "at the lowest"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {ing.rations.map((r) => (
                            <span key={r.mealId} className="chip" title={r.name}>
                              {r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <FnRow items={["csCountry → ingredients (inUse, ideal, gapPerMonth, rations)", "CsCostLine", "CsMarketPrice"]} />
        </section>
      </Section>

      {ingredient === undefined ? null : (
        <Section
          title={`${food(ingredient.commodity)}: our price against the lowest`}
          sub="Each month: what we paid, and the lowest market price"
          actions={
            <button type="button" className="btn sm" onClick={() => navigate(`../suppliers?food=${ingredient.commodity}`)}>
              {food(ingredient.commodity)} suppliers →
            </button>
          }
        >
          <PriceChart expansionId={view.country.expansionId} ingredient={ingredient} />
        </Section>
      )}
    </>
  );
}

function PriceChart({ expansionId, ingredient }: { readonly expansionId: string; readonly ingredient: CountryView["ingredients"][number] }) {
  const { state } = useLoad(() => loadPriceChart(expansionId), `chart:${expansionId}`);
  const per = priceUnit(ingredient.commodity);
  const series = state.kind === "ready" ? (state.data.find((c) => c.commodity === ingredient.commodity)?.chart ?? []) : [];
  const dollars = (exact: string | null) => (exact === null ? null : (plot(exact) ?? 0) / 100);
  const offer = ingredient.ideal?.source === "OFFER" ? (plot(ingredient.ideal.centsPerUnit) ?? 0) * 10 : null;
  return (
    <section className="card" aria-label="Price chart">
      <div className="card-b" style={{ paddingTop: 14 }}>
        {state.kind === "loading" ? <p className="loading">Loading the price history…</p> : null}
        {state.kind === "error" ? (
          <div className="error-box" role="alert">
            {state.message}
          </div>
        ) : null}
        {state.kind === "ready" && series.length === 0 ? <div className="empty">No price history for {food(ingredient.commodity).toLowerCase()} yet.</div> : null}
        {series.length === 0 ? null : (
          <Chart
            label={`${food(ingredient.commodity)} price by month`}
            height={300}
            deps={[ingredient.commodity, series.length, offer]}
            build={(c) => ({
              grid: { left: 52, right: 24, top: 36, bottom: 32 },
              legend: { top: 0, textStyle: { color: c.muted } },
              tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (typeof v === "number" ? `${v.toFixed(2)} $/${per}` : "—") },
              xAxis: { type: "category", data: series.map((p) => p.month), ...axis(c) },
              yAxis: { type: "value", name: `$/${per}`, nameTextStyle: { color: c.muted }, scale: true, ...axis(c) },
              series: [
                { name: "We paid", type: "line", data: series.map((p) => dollars(p.ours)), connectNulls: true, symbolSize: 7, lineStyle: { width: 2.5, color: c.brand }, itemStyle: { color: c.brand } },
                {
                  name: "Lowest market price",
                  type: "line",
                  data: series.map((p) => dollars(p.lowest)),
                  connectNulls: true,
                  symbol: "none",
                  lineStyle: { width: 2, type: "dashed", color: c.ok },
                  itemStyle: { color: c.ok },
                  ...(offer === null ? {} : { markLine: { symbol: "none", label: { formatter: "Cheapest offer now", color: c.ai }, lineStyle: { color: c.ai, type: "dotted" }, data: [{ yAxis: offer }] } }),
                },
              ],
            })}
          />
        )}
      </div>
      <FnRow items={["csPriceHistory → chart", "priceChart", "CsPurchaseOrder", "CsMarketPrice"]} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Incidents and 5. Investigations: the existing screens, for this country only.

export function IncidentsPage() {
  const { view } = useCountry();
  return (
    <ExpansionProvider key={view.country.expansionId} expansionId={view.country.expansionId}>
      <Incidents />
    </ExpansionProvider>
  );
}

export function InvestigationsPage() {
  const { view, reload } = useCountry();
  return <Investigations countryIso3={view.country.iso3} onChanged={reload} />;
}

// ---------------------------------------------------------------------------------------------------------------
// 4. AI analysis: the recommended steps that rules found, ordered and explained by AI (P18).

export function stepHref(step: Step): string {
  switch (step.link.type) {
    case "SUPPLIERS":
      return step.link.commodity === "" ? "../suppliers" : `../suppliers?food=${step.link.commodity}${step.link.supplierLogicalId === null ? "" : `&investigate=${encodeURIComponent(step.link.supplierLogicalId)}`}`;
    case "INGREDIENTS":
      return "../ingredients";
    case "INCIDENTS":
      return "../incidents";
    case "INVESTIGATIONS":
      return `../investigations?select=${step.link.investigationId}`;
  }
}

export function AnalysisPage() {
  const { view } = useCountry();
  const expansionId = view.country.expansionId;
  const { state, reload } = useLoad(() => loadLatestRun(expansionId, "ANALYSIS", expansionId), `analysis:${expansionId}`);
  const run = state.kind === "ready" ? state.data : null;
  const analysis = outputOf<AnalysisOutput>(run ?? undefined);
  const why = new Map((analysis?.steps ?? []).map((s) => [s.stepId, s.why] as const));
  const rank = new Map((analysis?.steps ?? []).map((s, i) => [s.stepId, i] as const));
  // The analysis is current only while it covers exactly the steps the rules find now.
  const current = analysis !== null && view.steps.every((s) => why.has(s.id)) && analysis.steps.every((s) => view.steps.some((v) => v.id === s.stepId));
  const groups = view.stepGroups
    .map((group) => ({ group, steps: view.steps.filter((s) => s.group === group).sort((a, b) => (current ? (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) : 0)) }))
    .filter((g) => g.steps.length > 0);
  let n = 0;
  return (
    <>
      <Section title="AI analysis" sub="Rules find every step and its numbers; AI orders and explains them">
        <section className="card" aria-label="AI summary" style={{ borderColor: "var(--ai-line)" }}>
          <div className="card-h">
            <h3>Summary</h3>
            <span className="chip ai">
              <Icon name="spark" size={11} /> AI
            </span>
            {run !== null && view.evidenceRevision !== null ? <RunBadges run={run} evidenceRevision={view.evidenceRevision} /> : null}
            <span style={{ marginLeft: "auto" }}>
              {view.steps.length === 0 ? null : <StartAiJob expansionId={expansionId} job="ANALYSIS" subjectId={expansionId} label={run === null ? "Write the analysis" : "Write it again"} onChanged={reload} />}
            </span>
          </div>
          <div className="card-b">
            {state.kind === "loading" ? <p className="loading">Loading…</p> : null}
            {view.steps.length === 0 ? <div className="empty">The rules found nothing to improve on the current evidence.</div> : null}
            {view.steps.length > 0 && state.kind === "ready" && run === null ? (
              <p className="note" style={{ margin: 0 }}>
                AI reads the {view.steps.length} steps below and the program's figures, puts them in the order to do them, and says why each matters. It cannot add a step or a
                number: code refuses its answer if it does.
              </p>
            ) : null}
            {run !== null && analysis === null ? <Failed run={run} /> : null}
            {analysis !== null && current ? <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{analysis.summary}</p> : null}
            {analysis !== null && !current ? (
              <p className="note" style={{ margin: 0, color: "var(--warn)" }}>
                The steps changed since this analysis was written: write it again. Below, the steps in the rules' order.
              </p>
            ) : null}
          </div>
          <FnRow items={["cs-start-ai-job · ANALYSIS → csStartAiJob", "analysisInput", "validateAnalysisOutput", "CsAiRun"]} />
        </section>
      </Section>

      {groups.map(({ group, steps }) => (
        <Section key={group} title={STEP_GROUP_NAME[group]} sub={`${steps.length} step${steps.length === 1 ? "" : "s"}`}>
          <section className="card" aria-label={STEP_GROUP_NAME[group]} style={{ overflow: "hidden" }}>
            {steps.map((step) => {
              n += 1;
              const reason = current ? why.get(step.id) : undefined;
              return (
                <div key={step.id} className="step-row">
                  <span className="step-n">{n}</span>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 14.5 }}>{step.title}</b>
                    <div className="note" style={{ marginTop: 2 }}>
                      {step.detail}
                    </div>
                    {reason === undefined ? null : (
                      <div className="step-why">
                        <Icon name="spark" size={11} /> {reason}
                      </div>
                    )}
                  </div>
                  <Link className="btn sm" to={stepHref(step)}>
                    {step.action} →
                  </Link>
                </div>
              );
            })}
            <FnRow items={["csCountry → steps", "countrySteps", "recommendations"]} />
          </section>
        </Section>
      ))}
    </>
  );
}
