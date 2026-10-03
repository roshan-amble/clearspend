import { useState } from "react";
import { client } from "../client";
import { axis, Chart, type Colors } from "../charts";
import { OutcomeText, useCommand } from "../command";
import { expectedOf, useExpansion, type ExpansionData } from "../data/expansion";
import { csSetCommodityTarget } from "../sdk";
import { Ready } from "../Shell";
import { FnRow, FOOD_VAR, foodName, Section, ShareBar } from "../ui";
import { centsFromUsd, comparisonText, marketViews, percentText, perMealText, plot, shortId, usdFromMicros, usdPerUnit } from "../view";
import { priceBoardOption, SpendVolume } from "./Overview";

const FOOD_KEY: Record<string, keyof Colors> = { RICE: "rice", BEANS: "beans", OIL: "oil" };

export function Prices() {
  const { reload } = useExpansion();
  return <Ready>{(data) => <Screen data={data} reload={reload} />}</Ready>;
}

function paidLine(data: ExpansionData, commodity: string) {
  return data.lines.filter((l) => l.commodity === commodity && Number(l.batchCount ?? 0) > 0).sort((a, b) => Number(b.batchCount) - Number(a.batchCount))[0];
}

function Screen({ data, reload }: { readonly data: ExpansionData; readonly reload: () => void }) {
  const foods = [...data.commodities.keys()].sort((a, b) => ["RICE", "BEANS", "OIL"].indexOf(a) - ["RICE", "BEANS", "OIL"].indexOf(b));
  const market = marketViews(data.snapshot.marketIndicatorsJson);
  const [view, setView] = useState<"supplier" | "route">("supplier");
  return (
    <>
      <Section title="Targets and realized cost" sub="¢ per meal" actions={
          <div className="seg" role="tablist" aria-label="Which failures count">
            <button role="tab" type="button" aria-selected={view === "supplier"} onClick={() => setView("supplier")}>
              Supplier view
            </button>
            <button role="tab" type="button" aria-selected={view === "route"} onClick={() => setView("route")}>
              Route view
            </button>
          </div>
        }>
        <section className="card" aria-label="Target against what we pay">
          <div className="card-b" style={{ overflowX: "auto", paddingTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Food</th>
                  <th>Target price</th>
                  <th className="r">Nominal</th>
                  <th className="r">Realized</th>
                  <th className="r">Lowest quote</th>
                  <th>Market, 12-month change</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {foods.map((commodity) => {
                  const line = paidLine(data, commodity);
                  const pm = perMealText(line?.perMealJson);
                  const quotes = data.lines.filter((l) => l.commodity === commodity).map((l) => ({ id: l.supplierLogicalId ?? "", q: comparisonText(l.perMealJson)?.quotedCents ?? null })).filter((x) => x.q !== null).sort((a, b) => Number(a.q) - Number(b.q));
                  const target = data.priceHistory?.commodities.find((c) => c.commodity === commodity)?.targetCentsPer1000 ?? null;
                  const series = market.find((m) => m.commodity === commodity)?.series ?? [];
                  return (
                    <tr key={commodity}>
                      <td style={{ fontWeight: 650, whiteSpace: "nowrap" }}>
                        <span className="dot" style={{ background: FOOD_VAR[commodity], marginRight: 8 }} />
                        {foodName(commodity)}
                      </td>
                      <td>{target === null ? <span className="chip new">Not set</span> : <span className="chip brand mono">{usdPerUnit(target)} $/{data.commodities.get(commodity)?.baseUnit === "ml" ? "L" : "kg"}</span>}</td>
                      <td className="r mono">{pm?.nominal ?? "—"}</td>
                      <td className="r mono" style={{ fontWeight: 650 }}>
                        {(view === "supplier" ? pm?.supplier : pm?.route) ?? "—"}
                      </td>
                      <td className="r mono">{quotes[0] === undefined ? "no quote" : `${quotes[0].q} (${shortId(quotes[0].id)})`}</td>
                      <td className="note">{series.map((s) => `${s.route.toLowerCase()} ${s.change === null ? "unknown" : percentText(s.change)}`).join(" · ")}</td>
                      <td>
                        <SetTarget data={data} commodity={commodity} onChanged={reload} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="howto">Supplier view: supplier-caused failures. Route view: all failures.</p>
          </div>
          <FnRow items={["CsCostLine (nominal, supplier, route)", "CsSupplierProfileVersion.quotedCentsPer1000", "csPriceHistory · targetCentsPer1000", "csSetCommodityTarget"]} />
        </section>
      </Section>

      <Section title="Market prices" sub="WFP retail medians, Androy">
        <div className="grid g3">
          {market.map((m) => (
            <section key={m.commodity} className="card" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="note" style={{ fontWeight: 600 }}>
                Market share · {foodName(m.commodity)}
              </span>
              <div className="kpi-big">{percentText(m.pressureShare)}</div>
              <div style={{ display: "flex", alignItems: "center", paddingTop: 6 }}>
                <ShareBar percent={Number(percentText(m.pressureShare).replace("%", "")) * 10} color={FOOD_VAR[m.commodity] ?? "var(--brand)"} />
              </div>
              <div className="note">{m.pressureFlagged ? "Above" : "Below"} the 10% review threshold · synthetic market size</div>
              <FnRow items={["marketPressure", "CsCostSnapshot.marketIndicatorsJson"]} />
            </section>
          ))}
        </div>
        <section className="card" aria-label="Market price table" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Series</th>
                  <th>Route</th>
                  <th className="r">Latest price</th>
                  <th>Period</th>
                  <th className="r">12-month change</th>
                </tr>
              </thead>
              <tbody>
                {market.flatMap((m) =>
                  m.series.map((s) => (
                    <tr key={`${m.commodity}-${s.series}-${s.route}`}>
                      <td>
                        <span className="dot" style={{ background: FOOD_VAR[m.commodity], marginRight: 8 }} />
                        <b>{s.series}</b>
                      </td>
                      <td>
                        <span className="chip">{s.route === "IMPORT" ? "imported" : "local"}</span>
                      </td>
                      <td className="r mono">{s.lastMedianMicros === undefined ? "—" : `${usdFromMicros(s.lastMedianMicros)} $/${m.commodity === "OIL" ? "L" : "kg"}`}</td>
                      <td className="mono">
                        {s.firstMonth ?? "?"} → {s.lastMonth}
                      </td>
                      <td className="r mono" style={{ color: s.change === null ? "var(--muted)" : s.change.startsWith("-") ? "var(--ok)" : "var(--bad)" }}>
                        {s.change === null ? "unknown" : percentText(s.change)}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="howto" style={{ padding: "0 22px 18px" }}>
            WFP retail medians via HDX. An indicator, not a forecast.
          </p>
          <FnRow items={["CsMarketPrice", "monthlyMedians", "relativeChange"]} />
        </section>
      </Section>

      <Section title="Price history" sub="Unit price, and cost per meal by evidence revision">
        {foods.map((commodity) => (
          <FoodSection key={commodity} data={data} commodity={commodity} />
        ))}
      </Section>

      <Section title="Spend and volume" sub="By month">
        <SpendVolume history={data.priceHistory} error={data.priceHistoryError} />
      </Section>
    </>
  );
}

function FoodSection({ data, commodity }: { readonly data: ExpansionData; readonly commodity: string }) {
  const h = data.priceHistory?.commodities.find((c) => c.commodity === commodity);
  const line = paidLine(data, commodity);
  const points = data.history
    .map(({ snapshot, lines }) => {
      const l = lines.find((x) => x.supplierLogicalId === line?.supplierLogicalId && x.commodity === commodity);
      const pm = l?.perMealJson === undefined ? null : (JSON.parse(l.perMealJson) as Record<string, string | null>);
      return { rev: `rev ${String(snapshot.evidenceRevision)}`, low: plot(pm?.supplierLow), high: plot(pm?.supplierHigh), nominal: plot(pm?.nominal) };
    })
    .filter((p) => p.low !== null);
  return (
    <section className="card" aria-labelledby={`h-${commodity}`} style={{ overflow: "hidden" }}>
      <div style={{ height: 4, background: FOOD_VAR[commodity] }} />
      <div className="card-h">
        <span className="dot" style={{ background: FOOD_VAR[commodity], width: 10, height: 10 }} />
        <h3 id={`h-${commodity}`}>{foodName(commodity)}</h3>
        <span className="sub">{line === undefined ? "No reconciled purchase" : `${shortId(line.supplierLogicalId ?? "")} · ${String(line.batchCount)} batches`}</span>
      </div>
      <div className="card-b grid g21" style={{ gap: 16 }}>
        <div>
          <div className="note" style={{ fontWeight: 600, color: "var(--ink2)" }}>
            Price per {commodity === "OIL" ? "litre" : "kg"}, USD
          </div>
          {h === undefined ? <div className="error-box" role="alert">No price history for this food. {data.priceHistoryError ?? ""}</div> : <Chart height={270} label={`${foodName(commodity)} unit price over time`} deps={[JSON.stringify(h)]} build={(c) => priceBoardOption(c, h, commodity)} />}
        </div>
        <div>
          <div className="note" style={{ fontWeight: 600, color: "var(--ink2)" }}>
            Cost per meal by revision, ¢
          </div>
          {points.length === 0 ? (
            <div className="empty">No reconciled purchase yet.</div>
          ) : (
            <Chart
              height={270}
              label={`${foodName(commodity)} cost per accepted meal by evidence revision`}
              deps={[JSON.stringify(points)]}
              build={(c) => {
                const col = c[FOOD_KEY[commodity] ?? "brand"];
                const lows = points.map((p) => p.low ?? 0);
                const highs = points.map((p) => p.high ?? p.low ?? 0);
                const nominal = points[0]?.nominal ?? Math.min(...lows);
                return {
                  grid: { left: 36, right: 16, top: 20, bottom: 26 },
                  tooltip: { trigger: "axis" },
                  xAxis: { type: "category", data: points.map((p) => p.rev), ...axis(c) },
                  yAxis: { type: "value", min: Math.floor(nominal - 1), max: Math.ceil(Math.max(...highs) + 0.5), ...axis(c) },
                  series: [
                    { name: "Realized low", type: "line", stack: "b", data: lows, symbol: "circle", symbolSize: 6, lineStyle: { color: col, width: 2.5 }, itemStyle: { color: col } },
                    { name: "Range", type: "line", stack: "b", data: highs.map((v, i) => +(v - (lows[i] ?? 0)).toFixed(3)), symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: col, opacity: 0.25 } },
                    { name: "Nominal", type: "line", data: points.map(() => nominal), symbol: "none", lineStyle: { color: c.market2, type: "dashed" } },
                  ],
                };
              }}
            />
          )}
        </div>
      </div>
      <FnRow items={["csPriceHistory", "CsCostSnapshot history", "CsCostLine.perMealJson"]} />
    </section>
  );
}

/** UI4 A: declare a target price for 1 food. A planning value under the D6 guard; it never changes the cost model. */
function SetTarget({ data, commodity, onChanged }: { readonly data: ExpansionData; readonly commodity: string; readonly onChanged: () => void }) {
  const { outcome, run, sending } = useCommand(onChanged);
  const [open, setOpen] = useState(false);
  const [usd, setUsd] = useState("");
  const [rationale, setRationale] = useState("");
  if (!open)
    return (
      <button className="btn sm" type="button" onClick={() => setOpen(true)}>
        Set target
      </button>
    );
  // The person types dollars per kg or L with at most 2 decimals; the Action receives whole cents per 1,000 base units.
  const cents = centsFromUsd(usd);
  return (
    <form
      className="confirm"
      style={{ minWidth: 240 }}
      onSubmit={(event) => {
        event.preventDefault();
        if (cents === null) return;
        void run(
          ({ requestId, actorUserId }) =>
            client(csSetCommodityTarget).applyAction({ ...expectedOf(data), commodity, targetCentsPer1000: cents, rationale, requestId, actorUserId }),
          "Target stored. The cost numbers do not change.",
        );
      }}
    >
      <fieldset disabled={sending}>
        <label htmlFor={`t-${commodity}`}>USD per {data.commodities.get(commodity)?.baseUnit === "ml" ? "L" : "kg"}</label>
        <input id={`t-${commodity}`} inputMode="decimal" placeholder="0.50" value={usd} onChange={(e) => setUsd(e.target.value)} />
        <label htmlFor={`r-${commodity}`}>Rationale</label>
        <input id={`r-${commodity}`} value={rationale} onChange={(e) => setRationale(e.target.value)} />
        <button type="submit" disabled={cents === null || rationale.trim() === ""}>
          Store target
        </button>
      </fieldset>
      <OutcomeText outcome={outcome} />
    </form>
  );
}
