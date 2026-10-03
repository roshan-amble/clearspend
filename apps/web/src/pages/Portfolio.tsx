import { NUTRIENT_NAME, type Nutrient } from "@clearspend/domain";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { loadPortfolio, useLoad, type CountrySummary } from "../data/portfolio";
import { FnRow, Section } from "../ui";
import { compact, dollarsCents, dollarsText, plot, shareText } from "../view";
import { WorldMap, type MapDatum } from "../WorldMap";

type Metric = "COST" | "URGENT" | "NUTRITION" | "PEOPLE";
const METRICS: Record<Metric, { readonly label: string; readonly low: string; readonly high: string; readonly invert?: boolean }> = {
  URGENT: { label: "Recommended actions", low: "none", high: "many" },
  COST: { label: "Food cost per person", low: "cheaper", high: "costlier" },
  NUTRITION: { label: "Weakest nutrient", low: "gap", high: "met", invert: true },
  PEOPLE: { label: "People reached", low: "fewer", high: "more", invert: true },
};
const ACTIVITY_SHORT: Record<string, string> = { SCHOOL_MEALS: "School meals", GENERAL_DISTRIBUTION: "General distribution", NUTRITION_SUPPORT: "Nutrition" };

function metricOf(c: CountrySummary, metric: Metric): { value: number | null; text: string } {
  const s = c.summary;
  switch (metric) {
    case "COST":
      return { value: plot(s.costPerPersonMonth.low), text: s.costPerPersonMonth.low === null ? "unknown" : `${dollarsCents(s.costPerPersonMonth.low)} a person a month${s.costPerPersonMonth.basis === "QUOTE" ? " (quotes)" : ""}` };
    case "URGENT":
      return { value: s.steps, text: `${s.steps} recommended action${s.steps === 1 ? "" : "s"}` };
    case "NUTRITION":
      return s.worstNutrition === null ? { value: null, text: "unknown" } : { value: Math.min(plot(s.worstNutrition.coverage) ?? 0, 1.2), text: `${NUTRIENT_NAME[s.worstNutrition.nutrient as Nutrient]} ${shareText(s.worstNutrition.coverage)} of target` };
    case "PEOPLE":
      return {
        value: s.peopleReached,
        text: `${s.started ? s.peopleReached.toLocaleString("en-US") : `0 reached, ${s.peoplePlanned.toLocaleString("en-US")} planned`} (${s.activities.map((a) => `${ACTIVITY_SHORT[a.activity] ?? a.activity} ${compact(a.beneficiaries)}`).join(", ")})`,
      };
  }
}

/** The home screen (Roshan, 2026-10-02: "the heatmap first is ideal followed by the cards"): the map, then 1 card for each program. */
export function Portfolio() {
  const { state } = useLoad(loadPortfolio, "portfolio");
  const [metric, setMetric] = useState<Metric>("URGENT");
  const [sort, setSort] = useState<"URGENT" | "COST" | "NAME">("URGENT");
  if (state.kind === "loading") return <p className="loading" role="status">Loading the portfolio from Foundry…</p>;
  if (state.kind === "error")
    return (
      <div className="error-box" role="alert">
        <b>Could not load the portfolio.</b> {state.message}
      </div>
    );
  const countries = state.data.countries;
  const people = countries.reduce((t, c) => t + c.summary.peopleReached, 0);
  const notStarted = countries.filter((c) => !c.summary.started);
  const planned = notStarted.reduce((t, c) => t + c.summary.peoplePlanned, 0);
  const mapData: MapDatum[] = countries.map((c) => {
    const m = metricOf(c, metric);
    return { iso3: c.country.iso3, name: `${c.country.flag} ${c.country.name}`, value: m.value, text: m.text, detail: c.summary.topStep ?? "Nothing recommended", isNew: c.country.status === "NEW" };
  });
  const sorted = [...countries].sort((a, b) => {
    if (a.country.status === "NEW" && b.country.status !== "NEW") return -1;
    if (b.country.status === "NEW" && a.country.status !== "NEW") return 1;
    if (sort === "NAME") return a.country.name.localeCompare(b.country.name);
    if (sort === "COST") return (plot(b.summary.costPerPersonMonth.low) ?? 0) - (plot(a.summary.costPerPersonMonth.low) ?? 0);
    return b.summary.steps - a.summary.steps || a.country.name.localeCompare(b.country.name);
  });
  return (
    <>
      <Section
        title="Program map"
        sub={`${countries.length} programs · ${compact(people)} people reached${planned > 0 ? ` · ${planned.toLocaleString("en-US")} planned in ${notStarted.length} new program${notStarted.length === 1 ? "" : "s"}` : ""} · click a country to open it`}
        actions={
          <div className="seg" role="tablist" aria-label="Map metric">
            {(Object.keys(METRICS) as Metric[]).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={m === metric} onClick={() => setMetric(m)}>
                {METRICS[m].label}
              </button>
            ))}
          </div>
        }
      >
        <section className="card" aria-label="Program map">
          <div className="card-b" style={{ paddingTop: 12 }}>
            <WorldMap data={mapData} metricLabel={METRICS[metric].label} low={METRICS[metric].low} high={METRICS[metric].high} {...(METRICS[metric].invert === true ? { invert: true } : {})} />
          </div>
          <FnRow items={["csPortfolio", "CsCountry", "countryView", "world-atlas 1:110m (Natural Earth)"]} />
        </section>
      </Section>

      <Section
        title="Countries"
        sub={`${countries.length} programs`}
        actions={
          <div className="seg" role="tablist" aria-label="Sort">
            {(["URGENT", "COST", "NAME"] as const).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={s === sort} onClick={() => setSort(s)}>
                {s === "URGENT" ? "Most actions" : s === "COST" ? "Highest cost" : "Name"}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
          {sorted.map((c) => (
            <CountryCard key={c.country.iso3} c={c} />
          ))}
        </div>
      </Section>
    </>
  );
}

function CountryCard({ c }: { readonly c: CountrySummary }) {
  const s = c.summary;
  const isNew = c.country.status === "NEW";
  const chips: ReactNode[] = [];
  if (s.steps > 0) chips.push(<span key="s" className="chip ai">{s.steps} recommended action{s.steps === 1 ? "" : "s"}</span>);
  if (s.investigations.scheduled + s.investigations.open > 0) chips.push(<span key="i" className="chip brand">{s.investigations.scheduled + s.investigations.open} investigation{s.investigations.scheduled + s.investigations.open === 1 ? "" : "s"}</span>);
  return (
    <Link to={`/countries/${c.country.iso3}`} className="card country-card" style={isNew ? { borderColor: "var(--rice)" } : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">
          {c.country.flag}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{c.country.name}</div>
          <div className="note">{c.country.region}</div>
        </div>
        <span className={isNew ? "chip rice" : "chip"} style={{ marginLeft: "auto" }}>
          {isNew ? "New program" : "Active"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {s.activities.map((a) => (
          <span key={a.activity} className={a.activity === "GENERAL_DISTRIBUTION" ? "chip brand" : a.activity === "NUTRITION_SUPPORT" ? "chip ai" : "chip rice"}>
            {ACTIVITY_SHORT[a.activity] ?? a.activity} · {compact(a.beneficiaries)}
          </span>
        ))}
      </div>
      <dl className="kv" style={{ marginTop: 12 }}>
        <dt>{s.started ? "People reached" : "People planned"}</dt>
        <dd>
          {(s.started ? s.peopleReached : s.peoplePlanned).toLocaleString("en-US")}
          {s.started ? "" : " · 0 reached yet"}
        </dd>
        <dt>{s.started ? "Rations a month" : "Rations planned"}</dt>
        <dd>{compact(s.mealsPerMonth)}</dd>
        <dt>Food per person</dt>
        <dd>
          {s.costPerPersonMonth.low === null ? "unknown" : `${dollarsCents(s.costPerPersonMonth.low)} a month`}
          {s.costPerPersonMonth.basis === "QUOTE" ? <span className="chip quote" style={{ marginLeft: 6 }}>quotes</span> : null}
        </dd>
        <dt>Food a month</dt>
        <dd>{dollarsText(s.monthlyCost.low)}</dd>
        <dt>Ingredients with a supplier</dt>
        <dd style={{ color: s.foodsSourced < s.foods ? "var(--warn)" : undefined }}>
          {s.foodsSourced} of {s.foods}
        </dd>
      </dl>
      {s.topStep === null ? null : (
        <p className="note" style={{ margin: "12px 0 0", color: "var(--ink2)" }}>
          {s.topStep}
        </p>
      )}
      {chips.length === 0 ? null : <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>{chips}</div>}
    </Link>
  );
}
