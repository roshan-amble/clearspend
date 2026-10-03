import type { Osdk } from "@osdk/client";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ExplanationView, StartAiJob } from "../Ai";
import { axis, Chart, type Colors } from "../charts";
import { expectedOf, latestDecision, latestRun, useExpansion, type ExpansionData, type PriceHistoryJson } from "../data/expansion";
import { SourcingDecision } from "../Forms";
import type { CsCostLine } from "../sdk";
import { Ready } from "../Shell";
import { FnRow, FOOD_CHIP, FOOD_VAR, foodName, Icon, Section } from "../ui";
import { comparisonText, marketViews, perMealText, percentText, plot, shortId, shortTime, thousands, usdFromCents, usdFromMicros, usdPerUnit } from "../view";

const FOOD_KEY: Record<string, keyof Colors> = { RICE: "rice", BEANS: "beans", OIL: "oil" };

/** The paid line of 1 food: the supplier with the most reconciled batches. */
function paidLine(data: ExpansionData, commodity: string): Osdk.Instance<CsCostLine> | undefined {
  return data.lines.filter((l) => l.commodity === commodity && Number(l.batchCount ?? 0) > 0).sort((a, b) => Number(b.batchCount) - Number(a.batchCount))[0];
}

export function Overview() {
  const { reload } = useExpansion();
  return <Ready>{(data) => <Screen data={data} reload={reload} />}</Ready>;
}

function Screen({ data, reload }: { readonly data: ExpansionData; readonly reload: () => void }) {
  const [food, setFood] = useState("RICE");
  const [deciding, setDeciding] = useState(false);
  const expected = expectedOf(data);
  const revision = expected.expectedEvidenceRevision;
  const foods = [...data.commodities.keys()].sort((a, b) => ["RICE", "BEANS", "OIL"].indexOf(a) - ["RICE", "BEANS", "OIL"].indexOf(b));
  const unconfirmed = data.incidents.filter((i) => i.status === "UNCONFIRMED" || i.status === "AI_PROPOSED");
  const leadLines = data.lines.filter((l) => l.commodity === "RICE" && data.profiles.has(l.supplierLogicalId ?? ""));
  const visited = leadLines.filter((l) => l.eligibility === "VERIFIED_PASS" || l.eligibility === "VERIFIED_FAIL");
  const rice = marketViews(data.snapshot.marketIndicatorsJson).find((m) => m.commodity === "RICE");
  // The decision on this page is the rice supplier, so only rice suppliers with a passed field visit can be chosen (C9).
  const eligible = [...new Set(data.lines.filter((l) => l.commodity === "RICE" && l.eligibility === "VERIFIED_PASS").map((l) => l.supplierLogicalId ?? ""))];
  const decision = latestDecision(data, "SOURCING_DECISION");
  const decisionStale = decision !== undefined && Number(decision.evidenceRevision) !== revision;
  const reconciled = data.purchases.filter((p) => p.status === "RECONCILED").length;
  const leftOut = data.purchases.length - reconciled;
  const openChecks = (leftOut > 0 ? 1 : 0) + (unconfirmed.length > 0 ? 1 : 0) + (visited.length === 0 && leadLines.length > 0 ? 1 : 0) + (rice?.pressureFlagged === true ? 1 : 0);
  const nameOf = (id: string) => `${shortId(id)} · ${data.suppliers.get(id)?.name ?? ""}`;
  const headline =
    decision === undefined
      ? openChecks === 0
        ? "Undecided · all checks clear"
        : `Undecided · ${openChecks} open check${openChecks === 1 ? "" : "s"}`
      : decisionStale
        ? `Needs review · ${shortId(decision.subjectId ?? "")} chosen at revision ${String(decision.evidenceRevision)}`
        : `Decided · ${nameOf(decision.subjectId ?? "")}`;
  const explanation = latestRun(data, "EXPLANATION", expected.expansionId);

  return (
    <>
      <Section title="Rice sourcing decision" sub="Checks before a supplier can be chosen" actions={
          <>
            <Link className="btn" to="leads">
              Compare suppliers
            </Link>
            <button className="btn primary" type="button" onClick={() => setDeciding((v) => !v)} aria-expanded={deciding}>
              <Icon name="check" size={15} /> Record decision
            </button>
          </>
        }>
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18, background: "linear-gradient(135deg,var(--surface) 0%,var(--brand-soft) 100%)" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.015em" }}>{headline}</div>
            {decision === undefined ? null : (
              <div className="note" style={{ marginTop: 4 }}>
                “{decision.rationale}” · {shortTime(decision.createdAt)}
              </div>
            )}
          </div>
          {deciding ? (
            <div className="card" style={{ padding: 18, maxWidth: 560 }}>
              <SourcingDecision {...expected} eligible={eligible.map((id) => ({ logicalId: id, label: nameOf(id) }))} onChanged={reload} />
            </div>
          ) : null}
          <div className="stepper">
            <div className={leftOut === 0 ? "step ok" : "step warn"}>
              <span className="k">
                <Icon name={leftOut === 0 ? "check" : "alert"} size={12} /> Reconciliation
              </span>
              <b>
                {reconciled} of {data.purchases.length} reconciled
              </b>
              <span className="note">{leftOut === 0 ? "All purchases" : `${leftOut} excluded`}</span>
            </div>
            <div className={unconfirmed.length === 0 ? "step ok" : "step warn"}>
              <span className="k">
                <Icon name={unconfirmed.length === 0 ? "check" : "alert"} size={12} /> Incidents
              </span>
              <b>{unconfirmed.length === 0 ? "All causes confirmed" : `${unconfirmed.map((i) => shortId(i.incidentLogicalId)).join(", ")} unconfirmed`}</b>
              <Link className="note" to="incidents">
                {unconfirmed.length === 0 ? "Incident review →" : "Cost is a range →"}
              </Link>
            </div>
            <div className={visited.length === 0 && leadLines.length > 0 ? "step warn" : "step ok"}>
              <span className="k">
                <Icon name="users" size={12} /> Leads
              </span>
              <b>
                {visited.length} of {leadLines.length} visited
              </b>
              <Link className="note" to="leads">
                {visited.length === 0 ? "Quotes only →" : "Suppliers & leads →"}
              </Link>
            </div>
            <div className={rice?.pressureFlagged === true ? "step warn" : "step ok"}>
              <span className="k">
                <Icon name={rice?.pressureFlagged === true ? "alert" : "check"} size={12} /> Market share
              </span>
              <b>{rice === undefined ? "Unknown" : percentText(rice.pressureShare)}</b>
              <span className="note">Review threshold 10%</span>
            </div>
            <div className="step todo">
              <span className="k">
                <Icon name="clock" size={12} /> Eligible
              </span>
              <b>{eligible.length === 0 ? "None" : eligible.map(shortId).join(", ")}</b>
              <span className="note">Passed field verification</span>
            </div>
          </div>
          <FnRow items={["CsExpansion · evidenceRevision", "CsCostSnapshot.purchasesJson / incidentsJson", "CsCostLine.eligibility", "csRecordSourcingDecision"]} />
        </div>
      </Section>

      <Section title="Cost per meal" sub="Realized cost per accepted meal">
        <div className="grid g3">
          {foods.map((commodity) => (
            <IngredientCard key={commodity} data={data} commodity={commodity} />
          ))}
        </div>
      </Section>

      <Section title="Rice suppliers" sub="Realized cost and local quotes, ¢ per meal" actions={
          <Link className="btn sm ghost" to="leads">
            Comparison →
          </Link>
        }>
        <div className="grid g21">
          <CostComparison data={data} food="RICE" />
          <section className="card ai-card" aria-labelledby="ai1" style={{ alignSelf: "start" }}>
            <div className="card-h">
              <span className="ico" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                <Icon name="spark" size={15} />
              </span>
              <h3 id="ai1">AI explanation</h3>
              <span className="chip ai" style={{ marginLeft: "auto" }}>
                AI · changes nothing
              </span>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {explanation === undefined ? <p className="note">No explanation yet.</p> : <ExplanationView run={explanation} evidenceRevision={revision} />}
              <StartAiJob expansionId={expected.expansionId} job="EXPLANATION" subjectId={expected.expansionId} label={explanation === undefined ? "Explain this comparison" : "Explain again"} onChanged={reload} />
            </div>
            <FnRow items={["csStartAiJob · EXPLANATION", "CsAiRun", "validateExplanationOutput"]} />
          </section>
        </div>
      </Section>

      <Section title="Price history" sub="Purchases, quotes, WFP market prices, and target" actions={
          <div className="seg" role="tablist" aria-label="Food">
            {foods.map((f) => (
              <button key={f} role="tab" type="button" aria-selected={f === food} onClick={() => setFood(f)}>
                <span className="dot" style={{ background: FOOD_VAR[f] }} />
                {foodName(f)}
              </button>
            ))}
          </div>
        }>
        <PriceBoard history={data.priceHistory} error={data.priceHistoryError} food={food} />
      </Section>

      <Section title="Work and activity">
        <div className="grid g2">
          <NeedsYou data={data} />
          <Activity data={data} />
        </div>
      </Section>
    </>
  );
}

function IngredientCard({ data, commodity }: { readonly data: ExpansionData; readonly commodity: string }) {
  const color = FOOD_VAR[commodity] ?? "var(--brand)";
  const line = paidLine(data, commodity);
  const spec = data.commodities.get(commodity);
  const text = comparisonText(line?.perMealJson);
  const perMeal = perMealText(line?.perMealJson);
  const unit = spec?.baseUnit === "ml" ? "ml" : "g";
  const failed = line === undefined ? [] : [
    Number(line.supplierFailures ?? 0) > 0 ? `${String(line.supplierFailures)} supplier` : null,
    Number(line.otherFailures ?? 0) > 0 ? `${String(line.otherFailures)} other` : null,
    Number(line.unconfirmedFailures ?? 0) > 0 ? `${String(line.unconfirmedFailures)} unconfirmed` : null,
  ].filter((x): x is string => x !== null);
  return (
    <article className="card" style={{ overflow: "hidden" }}>
      <div style={{ height: 4, background: color }} />
      <div className="card-h">
        <span className="dot" style={{ background: color, width: 10, height: 10 }} />
        <h3>{foodName(commodity)}</h3>
        <span className={`chip ${FOOD_CHIP[commodity] ?? ""}`} style={{ marginLeft: "auto" }}>
          {spec?.quantityPerMeal} {unit} / meal
        </span>
      </div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {line === undefined ? (
          <p className="note">No reconciled purchase.</p>
        ) : (
          <>
            <div>
              <div className="kpi-big">
                {text?.paidCents ?? "Unknown"}
                <span className="kpi-unit" style={{ marginLeft: 4 }}>
                  ¢
                </span>
              </div>
            </div>
            <dl className="kv">
              <dt>Supplier</dt>
              <dd>
                {shortId(line.supplierLogicalId ?? "")} · {String(line.batchCount)} batches
              </dd>
              <dt>Nominal</dt>
              <dd>{perMeal?.nominal}¢</dd>
              <dt>Meals per $1</dt>
              <dd>{text?.paidMealsPerDollar ?? "Unknown"}</dd>
            </dl>
            <p className="note" style={{ margin: 0 }}>
              Failed batches: {failed.length === 0 ? "none" : failed.join(", ")}
            </p>
          </>
        )}
      </div>
      <FnRow items={["CsCostLine.perMealJson", "CsCostLine (batchCount, failures)"]} />
    </article>
  );
}

function PriceBoard({ history, error, food }: { readonly history: PriceHistoryJson | null; readonly error: string | null; readonly food: string }) {
  const h = history?.commodities.find((c) => c.commodity === food);
  return (
    <section className="card" aria-label={`${foodName(food)} price over time`}>
      <div className="card-b" style={{ paddingTop: 20 }}>
        {h === undefined ? (
          <div className="error-box" role="alert">
            Could not load the price history from csPriceHistory. {error}
          </div>
        ) : (
          <>
            <Chart height={360} label={`${foodName(food)} unit price over time`} deps={[food, JSON.stringify(h)]} build={(c) => priceBoardOption(c, h, food)} />
            <div className="legend">
              <span>
                <span className="dot" style={{ background: FOOD_VAR[food], width: 10, height: 10 }} /> Purchase, reconciled
              </span>
              <span>
                <span className="dot" style={{ border: `2px solid ${FOOD_VAR[food] ?? "var(--brand)"}`, width: 10, height: 10 }} /> Purchase, not reconciled
              </span>
              <span style={{ color: "var(--ai)" }}>◆ Quote</span>
              <span>— WFP local · - - WFP imported</span>
              <span style={{ color: "var(--info)" }}>┄ {h.targetCentsPer1000 === null ? "Target not set" : `Target ${usdPerUnit(h.targetCentsPer1000)} $`}</span>
            </div>
          </>
        )}
      </div>
      <FnRow items={["csPriceHistory", "CsPurchaseOrder.unitPriceCents", "CsSupplierProfileVersion.quotedCentsPer1000", "CsMarketPrice", "CsExpansionCommodity.targetCentsPer1000"]} />
    </section>
  );
}

export function priceBoardOption(c: Colors, h: PriceHistoryJson["commodities"][number], food: string) {
  const col = c[FOOD_KEY[food] ?? "brand"];
  const unit = h.baseUnit === "ml" ? "USD/L" : "USD/kg";
  const series: Record<string, unknown>[] = h.market.map((m, i) => ({
    name: `WFP ${m.series} (${m.route.toLowerCase()})`,
    type: "line",
    data: m.points.map((p) => [`${p.month}-15`, plot(p.medianMicros, 1) === null ? null : Number(usdFromMicros(p.medianMicros))]),
    showSymbol: false,
    smooth: 0.2,
    lineStyle: { color: c.market, width: 2, type: i === 0 ? "solid" : "dashed" },
    itemStyle: { color: c.market },
    areaStyle: i === 0 ? { color: c.marketFill } : undefined,
  }));
  series.push(
    { name: "Paid", type: "scatter", data: h.purchases.filter((p) => p.reconciled).map((p) => [p.recordedAt, p.unitPriceCentsPer1000 / 100, shortId(p.orderLogicalId)]), symbolSize: 12, itemStyle: { color: col, borderColor: c.surface, borderWidth: 2 } },
    { name: "Paid, not reconciled", type: "scatter", data: h.purchases.filter((p) => !p.reconciled).map((p) => [p.recordedAt, p.unitPriceCentsPer1000 / 100, shortId(p.orderLogicalId)]), symbolSize: 11, itemStyle: { color: c.surface, borderColor: col, borderWidth: 2 } },
    {
      name: "Quote",
      type: "scatter",
      symbol: "diamond",
      data: h.quotes.map((q) => [q.submittedAt, q.quotedCentsPer1000 / 100, shortId(q.supplierLogicalId)]),
      symbolSize: 13,
      itemStyle: { color: c.quote, borderColor: c.surface, borderWidth: 1.5 },
      label: { show: true, formatter: (p: { data: unknown[] }) => String(p.data[2]), position: "right", color: c.ai, fontSize: 10, textBorderWidth: 0 },
      labelLayout: { hideOverlap: true },
    },
  );
  if (h.targetCentsPer1000 !== null) {
    series.push({ name: "Target", type: "line", data: [], markLine: { silent: true, symbol: "none", lineStyle: { color: c.target, type: [6, 4], width: 1.5 }, label: { formatter: `Target ${usdPerUnit(h.targetCentsPer1000)}`, color: c.info, fontSize: 10, position: "insideStartTop" }, data: [{ yAxis: h.targetCentsPer1000 / 100 }] } });
  }
  return {
    grid: { left: 44, right: 56, top: 16, bottom: 64 },
    tooltip: { trigger: "item" },
    dataZoom: [{ type: "slider", height: 22, bottom: 8, borderColor: c.line, fillerColor: c.brandFill, labelFormatter: "" }, { type: "inside" }],
    xAxis: { type: "time", ...axis(c) },
    yAxis: { type: "value", name: unit, nameTextStyle: { color: c.muted, fontSize: 10 }, scale: true, ...axis(c) },
    series,
  };
}

function CostComparison({ data, food }: { readonly data: ExpansionData; readonly food: string }) {
  const lines = data.lines.filter((l) => l.commodity === food);
  const rows = lines
    .map((l) => ({ id: shortId(l.supplierLogicalId ?? ""), pm: l.perMealJson === undefined ? null : (JSON.parse(l.perMealJson) as Record<string, string | null>), eligible: l.eligibility === "VERIFIED_PASS", batches: Number(l.batchCount ?? 0) }))
    .sort((a, b) => b.batches - a.batches || (plot(b.pm?.quoted) ?? 0) - (plot(a.pm?.quoted) ?? 0));
  return (
    <section className="card" aria-labelledby="cmp">
      <div className="card-h">
        <h3 id="cmp">Cost per meal by supplier</h3>
        <span className="sub">¢</span>
      </div>
      <div className="card-b">
        <Chart
          height={Math.max(160, rows.length * 40 + 50)}
          label={`Cost for 1 accepted meal of ${food.toLowerCase()} by supplier`}
          deps={[food, JSON.stringify(rows)]}
          build={(c) => {
            const col = c[FOOD_KEY[food] ?? "brand"];
            const ids = rows.map((r) => r.id).reverse();
            const values = rows.flatMap((r) => [plot(r.pm?.supplierLow), plot(r.pm?.supplierHigh), plot(r.pm?.quoted), plot(r.pm?.nominal)]).filter((v): v is number => v !== null);
            return {
              grid: { left: 64, right: 110, top: 10, bottom: 28 },
              tooltip: { trigger: "item" },
              xAxis: { type: "value", min: Math.floor(Math.min(...values) - 0.5), max: Math.ceil(Math.max(...values) + 0.3), name: "¢", nameTextStyle: { color: c.muted }, ...axis(c) },
              yAxis: { type: "category", data: ids, ...axis(c), splitLine: { show: false } },
              series: [
                { type: "bar", stack: "a", data: ids.map((id) => { const r = rows.find((x) => x.id === id); return plot(r?.pm?.supplierLow) ?? "-"; }), itemStyle: { color: "transparent" }, barWidth: 16, tooltip: { show: false } },
                { name: "Paid range", type: "bar", stack: "a", data: ids.map((id) => { const r = rows.find((x) => x.id === id); const lo = plot(r?.pm?.supplierLow); const hi = plot(r?.pm?.supplierHigh); return lo === null || hi === null ? "-" : Math.max(hi - lo, 0.04); }), barWidth: 16, itemStyle: { color: col, borderRadius: 4 } },
                { name: "Nominal", type: "scatter", symbol: "rect", symbolSize: [3, 22], data: rows.filter((r) => plot(r.pm?.nominal) !== null && r.batches > 0).map((r) => [plot(r.pm?.nominal), r.id]), itemStyle: { color: c.market2 } },
                { name: "Quote, not paid", type: "scatter", symbol: "diamond", symbolSize: 14, data: rows.filter((r) => plot(r.pm?.quoted) !== null).map((r) => [plot(r.pm?.quoted), r.id]), itemStyle: { color: c.surface, borderColor: c.quote, borderWidth: 2 }, label: { show: true, formatter: (p: { data: number[] }) => `${p.data[0]?.toFixed(1)} quoted`, position: "right", color: c.ai, fontSize: 10, textBorderWidth: 0 } },
              ],
            };
          }}
        />
        <div className="legend">
          <span>
            <span style={{ display: "inline-block", width: 18, height: 10, borderRadius: 3, background: FOOD_VAR[food] }} /> Realized cost
          </span>
          <span>
            <span style={{ display: "inline-block", width: 3, height: 14, background: "var(--market-2)" }} /> Nominal cost
          </span>
          <span style={{ color: "var(--ai)" }}>◇ Quote</span>
        </div>
      </div>
      <FnRow items={["CsCostLine.perMealJson (supplierLow/High, nominal, quoted)", "CsCostLine.eligibility"]} />
    </section>
  );
}

function NeedsYou({ data }: { readonly data: ExpansionData }) {
  const items: { to: string; icon: string; tone: string; title: string; sub: string; level: string }[] = [];
  for (const incident of data.incidents.filter((i) => i.status === "UNCONFIRMED" || i.status === "AI_PROPOSED")) {
    items.push({ to: "incidents", icon: "alert", tone: "warn", title: `Confirm the cause of ${shortId(incident.incidentLogicalId)}`, sub: "The cost stays a range until a person decides", level: "High" });
  }
  const notExtracted = [...data.profiles.values()].filter((p) => latestRun(data, "EXTRACTION", p.versionId ?? "")?.status !== "SUCCEEDED");
  if (notExtracted.length > 0) items.push({ to: "leads", icon: "spark", tone: "ai", title: `Extract claims from ${notExtracted.length} profile${notExtracted.length === 1 ? "" : "s"}`, sub: "AI · claims, not facts", level: "Medium" });
  const unselected = data.lines.filter((l) => l.eligibility === "LEAD" && data.profiles.has(l.supplierLogicalId ?? "") && latestDecision(data, "SELECT_FIELD_VISIT", l.supplierLogicalId) === undefined);
  if (unselected.length > 0) items.push({ to: "leads", icon: "users", tone: "oil", title: "Select leads for field visits", sub: `${unselected.length} leads have quotes only`, level: "Medium" });
  const drafts = data.aiRuns.filter((r) => r.job === "OUTREACH_DRAFT" && r.status === "SUCCEEDED" && !data.decisions.some((d) => d.subjectId === r.aiRunId));
  if (drafts.length > 0) items.push({ to: "leads", icon: "send", tone: "brand", title: `Approve ${drafts.length} outreach draft${drafts.length === 1 ? "" : "s"}`, sub: "Notifies only you in the demo", level: "Low" });
  const decision = latestDecision(data, "SOURCING_DECISION");
  if (decision !== undefined && Number(decision.evidenceRevision) !== Number(data.expansion.evidenceRevision)) items.unshift({ to: ".", icon: "alert", tone: "bad", title: "Review the sourcing decision", sub: "The evidence changed since it was made", level: "High" });
  const soft: Record<string, string> = { warn: "var(--warn-soft)", ai: "var(--ai-soft)", oil: "var(--oil-soft)", brand: "var(--brand-soft)", bad: "var(--bad-soft)" };
  const ink: Record<string, string> = { warn: "var(--warn)", ai: "var(--ai)", oil: "var(--oil-ink)", brand: "var(--brand)", bad: "var(--bad)" };
  return (
    <section className="card" aria-labelledby="q">
      <div className="card-h">
        <h3 id="q">Open items</h3>
        <span className={items.length === 0 ? "chip ok" : "chip warn"} style={{ marginLeft: "auto" }}>
          {items.length === 0 ? "Nothing open" : `${items.length} open`}
        </span>
      </div>
      <div className="card-b list">
        {items.length === 0 ? <p className="note">Every cause is settled and every lead is handled.</p> : null}
        {items.map((item) => (
          <Link key={item.title} className="row row-link" to={item.to}>
            <span className="ico" style={{ background: soft[item.tone], color: ink[item.tone] }}>
              <Icon name={item.icon} size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{item.title}</b>
              <div className="note">{item.sub}</div>
            </div>
            <span className={item.level === "High" ? "chip bad" : item.level === "Medium" ? "chip warn" : "chip"}>{item.level}</span>
          </Link>
        ))}
      </div>
      <FnRow items={["CsCostSnapshot.incidentsJson", "CsAiRun", "CsDecision", "CsCostLine.eligibility"]} />
    </section>
  );
}

export function SpendVolume({ history, error }: { readonly history: PriceHistoryJson | null; readonly error: string | null }) {
  const rice = history?.commodities.find((c) => c.commodity === "RICE");
  const months = [...new Set(history?.commodities.flatMap((c) => c.months.map((m) => m.month)) ?? [])].sort();
  return (
    <section className="card" aria-labelledby="sp">
      <div className="card-h">
        <h3 id="sp">Spend and rice volume</h3>
        <span className="sub">USD by food · rice kg by outcome</span>
      </div>
      <div className="card-b grid g2" style={{ gap: 12 }}>
        {history === null ? (
          <div className="error-box" role="alert" style={{ gridColumn: "1/-1" }}>
            Could not load the monthly series from csPriceHistory. {error}
          </div>
        ) : (
          <>
            <Chart
              height={240}
              label="Paid spend by month and food"
              deps={[JSON.stringify(history)]}
              build={(c) => ({
                grid: { left: 52, right: 8, top: 28, bottom: 24 },
                legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10, color: c.muted } },
                tooltip: { trigger: "axis", valueFormatter: (v: number) => `$${usdFromCents(Math.round(v * 100))}` },
                xAxis: { type: "category", data: months, ...axis(c) },
                yAxis: { type: "value", ...axis(c) },
                series: [
                  ...history.commodities.map((h) => ({ name: foodName(h.commodity), type: "bar", stack: "s", data: months.map((m) => (h.months.find((x) => x.month === m)?.paidCents ?? 0) / 100), itemStyle: { color: c[FOOD_KEY[h.commodity] ?? "brand"] } })),
                  { name: "Not reconciled", type: "bar", stack: "s", data: months.map((m) => history.commodities.reduce((t, h) => t + (h.months.find((x) => x.month === m)?.unreconciledCents ?? 0), 0) / 100), itemStyle: { color: "transparent", borderColor: c.rice, borderType: "dashed", borderWidth: 1.5 } },
                ],
              })}
            />
            <Chart
              height={240}
              label="Rice accepted and failed kilograms by delivery month"
              deps={[JSON.stringify(rice)]}
              build={(c) => {
                const m = rice?.months ?? [];
                return {
                  grid: { left: 52, right: 8, top: 28, bottom: 24 },
                  legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10, color: c.muted } },
                  tooltip: { trigger: "axis", valueFormatter: (v: number) => `${v.toLocaleString("en-US")} kg` },
                  xAxis: { type: "category", data: m.map((x) => x.month), ...axis(c) },
                  yAxis: { type: "value", ...axis(c) },
                  series: [
                    { name: "Accepted", type: "bar", stack: "k", data: m.map((x) => x.acceptedBase / 1000), itemStyle: { color: c.rice } },
                    { name: "Failed · supplier", type: "bar", stack: "k", data: m.map((x) => x.failedSupplierBase / 1000), itemStyle: { color: c.bad } },
                    { name: "Failed · other", type: "bar", stack: "k", data: m.map((x) => x.failedOtherBase / 1000), itemStyle: { color: c.market } },
                    { name: "Failed · unconfirmed", type: "bar", stack: "k", data: m.map((x) => x.failedUnconfirmedBase / 1000), itemStyle: { color: c.warn, decal: { symbol: "rect", dashArrayX: [1, 0], dashArrayY: [3, 3], rotation: -0.78, color: "rgba(0,0,0,.25)" } } },
                  ],
                };
              }}
            />
          </>
        )}
      </div>
      <FnRow items={["csPriceHistory (monthly series)", "CsPayment", "CsDelivery", "CsIncident"]} />
    </section>
  );
}

function Activity({ data }: { readonly data: ExpansionData }) {
  const events = [
    ...data.imports.map((b) => ({ at: b.importedAt ?? "", key: b.importBatchId ?? "", who: "script", title: `Import · ${b.fileName}`, sub: `${String(b.accepted)} accepted · ${String(b.replayed)} replayed · ${String(b.versioned)} corrected`, rev: String(b.evidenceRevisionAfter) })),
    ...data.decisions.map((d) => ({ at: d.createdAt ?? "", key: d.decisionId ?? "", who: "person", title: `${(d.decisionType ?? "").replaceAll("_", " ").toLowerCase()} · ${shortId(d.subjectId ?? "")}`, sub: `“${d.rationale ?? ""}”`, rev: String(d.evidenceRevision) })),
    ...data.verifications.map((v) => ({ at: v.createdAt ?? "", key: v.verificationId ?? "", who: "person", title: `Field verification · ${shortId(v.supplierLogicalId ?? "")} ${v.result}`, sub: v.moisturePermille === undefined ? `${thousands(Number(v.confirmedCapacityPerMonth ?? 0))} kg a month confirmed` : `moisture ${Number(v.moisturePermille) / 10}%`, rev: String(v.evidenceRevision) })),
    ...data.aiRuns.map((r) => ({ at: r.startedAt ?? "", key: r.aiRunId ?? "", who: "ai", title: `AI ${(r.job ?? "").toLowerCase().replaceAll("_", " ")} · ${shortId(r.subjectId ?? "").split("@")[0]}`, sub: r.status ?? "", rev: String(r.evidenceRevision) })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  return (
    <section className="card" aria-labelledby="act">
      <div className="card-h">
        <h3 id="act">Activity</h3>
      </div>
      <div className="card-b list">
        {events.map((e) => (
          <div className="row" key={e.key}>
            <span className="avatar" style={{ background: e.who === "ai" ? "var(--ai-soft)" : e.who === "person" ? "var(--oil-soft)" : "var(--soft)", color: e.who === "ai" ? "var(--ai)" : e.who === "person" ? "var(--oil-ink)" : "var(--ink2)" }}>
              <Icon name={e.who === "ai" ? "spark" : e.who === "person" ? "users" : "gear"} size={13} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ textTransform: "none" }}>{e.title}</b>
              <div className="note" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.sub} · {shortTime(e.at)}
              </div>
            </div>
            <span className="chip mono">rev {e.rev}</span>
          </div>
        ))}
      </div>
      <FnRow items={["CsImportBatch", "CsDecision", "CsFieldVerification", "CsAiRun"]} />
    </section>
  );
}
