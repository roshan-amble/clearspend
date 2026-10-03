import type { ExtractionOutput } from "@clearspend/domain";
import type { Osdk } from "@osdk/client";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExtractionView, OutreachDraft, outputOf, StartAiJob } from "../Ai";
import { axis, Chart } from "../charts";
import { expectedOf, latestDecision, latestRun, useExpansion, type ExpansionData } from "../data/expansion";
import { RecordVerification, SelectFieldVisit } from "../Forms";
import type { CsCostLine } from "../sdk";
import { Ready } from "../Shell";
import { FnRow, FOOD_VAR, foodName, Icon, Section } from "../ui";
import { comparisonText, plot, shortId, shortTime, thousands, usdPerUnit } from "../view";

export function Leads() {
  const { reload } = useExpansion();
  return <Ready>{(data) => <Screen data={data} reload={reload} />}</Ready>;
}

type Stage = "LEAD" | "SELECTED" | "PASS" | "FAIL" | "CURRENT";

/** One supplier of 1 food: a lead with a profile, or a current supplier with purchases. Every value is stored. */
interface Row {
  readonly line: Osdk.Instance<CsCostLine>;
  readonly supplierId: string;
  readonly name: string;
  readonly stage: Stage;
  readonly profile: ExpansionData["profiles"] extends ReadonlyMap<string, infer P> ? P | undefined : never;
  readonly extraction: ExtractionOutput | null;
  readonly verification: ExpansionData["verifications"][number] | undefined;
  readonly quoted: number | null;
  readonly paidLow: number | null;
  readonly paidHigh: number | null;
}

function rowsOf(data: ExpansionData, commodity: string): Row[] {
  return data.lines
    .filter((line) => line.commodity === commodity)
    .map((line) => {
      const supplierId = line.supplierLogicalId ?? "";
      const profile = data.profiles.get(supplierId);
      const run = profile?.versionId === undefined ? undefined : latestRun(data, "EXTRACTION", profile.versionId);
      const verification = data.verifications.filter((v) => v.supplierLogicalId === supplierId && v.rationVersion === data.expansion.rationVersion).at(-1);
      const pm = line.perMealJson === undefined ? null : (JSON.parse(line.perMealJson) as Record<string, string | null>);
      const stage: Stage =
        line.eligibility === "VERIFIED_PASS" && profile === undefined
          ? "CURRENT"
          : line.eligibility === "VERIFIED_PASS"
            ? "PASS"
            : line.eligibility === "VERIFIED_FAIL"
              ? "FAIL"
              : latestDecision(data, "SELECT_FIELD_VISIT", supplierId) !== undefined
                ? "SELECTED"
                : profile === undefined
                  ? "CURRENT"
                  : "LEAD";
      return {
        line,
        supplierId,
        name: data.suppliers.get(supplierId)?.name ?? shortId(supplierId),
        stage,
        profile,
        extraction: outputOf<ExtractionOutput>(run),
        verification,
        quoted: plot(pm?.quoted),
        paidLow: plot(pm?.supplierLow),
        paidHigh: plot(pm?.supplierHigh),
      };
    })
    // The current supplier first, then the leads in ID order (SUP-L1, SUP-L2, …), so the page opens on the story's first lead.
    .sort((a, b) => Number(a.profile !== undefined) - Number(b.profile !== undefined) || a.supplierId.localeCompare(b.supplierId, "en", { numeric: true }));
}

const STAGES: readonly { key: Stage; title: string; sub: string; tone: string }[] = [
  { key: "LEAD", title: "Leads", sub: "quotes only", tone: "var(--quote-soft)" },
  { key: "SELECTED", title: "Selected for visit", sub: "rationale recorded", tone: "var(--brand-soft)" },
  { key: "PASS", title: "Verified pass", sub: "eligible to decide", tone: "var(--ok-soft)" },
  { key: "FAIL", title: "Verified fail", sub: "kept, not eligible", tone: "var(--bad-soft)" },
  { key: "CURRENT", title: "Current supplier", sub: "paid, reconciled", tone: "var(--rice-soft)" },
];

const STAGE_CHIP: Record<Stage, ReactNode> = {
  LEAD: <span className="chip">Lead</span>,
  SELECTED: <span className="chip brand">Selected for visit</span>,
  PASS: (
    <span className="chip ok">
      <Icon name="check" size={11} /> Eligible
    </span>
  ),
  FAIL: <span className="chip bad">Failed visit · not eligible</span>,
  CURRENT: (
    <span className="chip ok">
      <Icon name="check" size={11} /> Current · eligible
    </span>
  ),
};

function Screen({ data, reload }: { readonly data: ExpansionData; readonly reload: () => void }) {
  const foods = [...new Set(data.lines.filter((l) => data.profiles.has(l.supplierLogicalId ?? "")).map((l) => l.commodity ?? ""))].sort();
  const [food, setFood] = useState(foods[0] ?? "RICE");
  const rows = rowsOf(data, food);
  const leads = rows.filter((r) => r.profile !== undefined);
  const [compare, setCompare] = useState<readonly string[]>(() => leads.slice(0, 3).map((r) => r.supplierId));
  const [focusId, setFocusId] = useState(leads[0]?.supplierId ?? "");
  const benchmark = rows.find((r) => r.stage === "CURRENT");
  const focus = leads.find((r) => r.supplierId === focusId) ?? leads[0];
  const commodity = data.commodities.get(food);
  const need = commodity?.plannedPerMonth === undefined ? undefined : Number(commodity.plannedPerMonth);
  const columns = [...(benchmark === undefined ? [] : [benchmark]), ...leads.filter((r) => compare.includes(r.supplierId))];
  const pick = (food_: string) => {
    setFood(food_);
    const next = rowsOf(data, food_).filter((r) => r.profile !== undefined);
    setCompare(next.slice(0, 3).map((r) => r.supplierId));
    setFocusId(next[0]?.supplierId ?? "");
  };

  const needText = need === undefined ? "an unknown amount" : `${thousands(need)} ${commodity?.baseUnit === "ml" ? "L" : "kg"}`;
  return (
    <>
      <Section title="Pipeline" sub={`${foodName(food)} · need ${needText} a month`} actions={
          foods.length < 2 ? undefined : (
            <div className="seg" role="tablist" aria-label="Food">
              {foods.map((f) => (
                <button key={f} type="button" role="tab" aria-selected={f === food} onClick={() => pick(f)}>
                  <span className="dot" style={{ background: FOOD_VAR[f] }} />
                  {foodName(f)}
                </button>
              ))}
            </div>
          )
        }>
        <section className="card" aria-label="Supplier pipeline">
          <div className="card-b" style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 20 }}>
            {STAGES.map((stage, index) => {
              const items = rows.filter((r) => r.stage === stage.key);
              return (
                <div key={stage.key} style={{ display: "contents" }}>
                  {index === 0 || index === 3 ? null : (
                    <div aria-hidden="true" style={{ alignSelf: "center", color: "var(--muted)", fontSize: 18 }}>
                      →
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 150, borderRadius: 12, padding: "14px 16px", background: stage.tone }}>
                    <div className="note" style={{ fontWeight: 650, color: "var(--ink2)" }}>
                      {stage.title}
                    </div>
                    <div className="kpi-big" style={{ fontSize: 28, margin: "4px 0" }}>
                      {stage.key === "CURRENT" ? (items.map((r) => shortId(r.supplierId)).join(", ") || "None") : items.length}
                    </div>
                    <div className="note">{stage.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <FnRow items={["CsCostLine.eligibility", "supplierEligibility", "CsDecision · SELECT_FIELD_VISIT", "CsFieldVerification"]} />
        </section>
      </Section>

      <Section title="Comparison" sub="Current supplier and leads">
        <Matrix data={data} columns={columns} leads={leads} compare={compare} setCompare={setCompare} focusId={focus?.supplierId ?? ""} setFocusId={setFocusId} reload={reload} />
      </Section>

      <Section title="Quote vs capacity" sub={`Dashed line: need of ${needText} a month`}>
        <section className="card" aria-label="Quote against claimed capacity">
          <div className="card-b" style={{ paddingTop: 20 }}>
            <Bubble rows={rows} need={need} />
          </div>
          <FnRow items={["CsSupplierProfileVersion", "CsCostLine.perMealJson", "CsExpansionCommodity.plannedPerMonth"]} />
        </section>
      </Section>

      {focus === undefined ? <div className="empty">No leads for {foodName(food).toLowerCase()} yet. Import supplier profiles in the data studio.</div> : <LeadDetail key={focus.supplierId} data={data} row={focus} leads={leads} setFocusId={setFocusId} reload={reload} />}
    </>
  );
}

function Bubble({ rows, need }: { readonly rows: readonly Row[]; readonly need: number | undefined }) {
  const leads = rows
    .filter((r) => r.profile !== undefined && r.quoted !== null)
    .map((r) => ({ id: shortId(r.supplierId), x: r.quoted ?? 0, y: Number(r.profile?.claimedCapacityPerMonth ?? 0) / 1000, ok: need === undefined ? null : Number(r.profile?.claimedCapacityPerMonth ?? 0) >= need, text: comparisonText(r.line.perMealJson)?.quotedCents ?? "" }));
  const current = rows
    .filter((r) => r.profile === undefined && r.paidLow !== null && r.verification?.confirmedCapacityPerMonth !== undefined)
    .map((r) => ({ id: shortId(r.supplierId), x: r.paidLow ?? 0, y: Number(r.verification?.confirmedCapacityPerMonth ?? 0) / 1000, text: comparisonText(r.line.perMealJson)?.paidCents ?? "" }));
  if (leads.length === 0) return <div className="empty">No quotes to place.</div>;
  return (
    <Chart
      height={320}
      label="Each lead's quoted cost for 1 meal against its claimed monthly capacity"
      deps={[JSON.stringify(leads), JSON.stringify(current), need]}
      build={(c) => ({
        grid: { left: 56, right: 20, top: 34, bottom: 40 },
        tooltip: { formatter: (p: { data: { value: number[]; text: string; id: string; kind: string } }) => `${p.data.id}: ${p.data.text}¢ ${p.data.kind}, ${p.data.value[1]?.toLocaleString("en-US")} kg ${p.data.kind === "paid" ? "confirmed" : "claimed"}` },
        xAxis: { type: "value", name: "¢ for 1 meal", nameLocation: "middle", nameGap: 26, scale: true, nameTextStyle: { color: c.muted, fontSize: 11 }, ...axis(c) },
        yAxis: { type: "value", name: "kg / month", nameTextStyle: { color: c.muted, fontSize: 11 }, ...axis(c) },
        series: [
          {
            type: "scatter",
            data: leads.map((l) => ({ value: [l.x, l.y], id: l.id, text: l.text, kind: "quoted", itemStyle: { color: l.ok === false ? c.bad : c.ok, opacity: 0.8 } })),
            symbolSize: (v: number[]) => 10 + Math.sqrt(v[1] ?? 0) / 7,
            itemStyle: { borderColor: c.surface, borderWidth: 2 },
            label: { show: true, formatter: (p: { data: { id: string } }) => p.data.id, position: "top", fontSize: 10, color: c.ink, textBorderWidth: 0 },
            ...(need === undefined
              ? {}
              : { markLine: { silent: true, symbol: "none", lineStyle: { color: c.ink, type: "dashed" }, label: { formatter: `need ${thousands(need)} kg`, position: "insideEndTop", fontSize: 10, color: c.muted, textBorderWidth: 0 }, data: [{ yAxis: need / 1000 }] } }),
          },
          {
            type: "scatter",
            data: current.map((l) => ({ value: [l.x, l.y], id: l.id, text: l.text, kind: "paid" })),
            symbol: "rect",
            symbolSize: 14,
            itemStyle: { color: c.rice },
            label: { show: true, formatter: (p: { data: { id: string } }) => `${p.data.id} · paid`, position: "left", fontSize: 10, color: c.ink, textBorderWidth: 0 },
          },
        ],
      })}
    />
  );
}

function Cell({ main, sub, tone }: { readonly main: ReactNode; readonly sub?: ReactNode; readonly tone?: string }) {
  return (
    <td style={tone === undefined ? undefined : { background: tone }}>
      <div className="num" style={{ fontWeight: 650 }}>
        {main}
      </div>
      {sub === undefined ? null : <div className="note">{sub}</div>}
    </td>
  );
}

function moistureClaim(row: Row): string | null {
  const claim = row.extraction?.claims.find((c) => c.field === "TEST_VALUE" || /moisture|humidit/i.test(c.value));
  return claim === undefined ? null : claim.value;
}

function Matrix(props: {
  readonly data: ExpansionData;
  readonly columns: readonly Row[];
  readonly leads: readonly Row[];
  readonly compare: readonly string[];
  readonly setCompare: (ids: readonly string[]) => void;
  readonly focusId: string;
  readonly setFocusId: (id: string) => void;
  readonly reload: () => void;
}) {
  const { data, columns } = props;
  const unit = (r: Row) => (data.commodities.get(r.line.commodity ?? "")?.baseUnit === "ml" ? "L" : "kg");
  const lastOrder = (r: Row) =>
    [...data.orders.values()].filter((o) => o.supplierLogicalId === r.supplierId && o.commodity === r.line.commodity).sort((a, b) => (a.recordedAt ?? "").localeCompare(b.recordedAt ?? "")).at(-1);
  const [adding, setAdding] = useState(false);
  const spare = props.leads.filter((r) => !props.compare.includes(r.supplierId));
  return (
    <section className="card" aria-labelledby="mx" style={{ overflow: "hidden" }}>
      <div className="card-h">
        <h3 id="mx">Suppliers</h3>
        <span className="sub">{columns[0]?.stage === "CURRENT" ? `Benchmark: ${shortId(columns[0].supplierId)}` : "No current supplier"}</span>
        {spare.length === 0 || props.compare.length >= 3 ? null : adding ? (
          <select
            aria-label="Add a lead to compare"
            style={{ marginLeft: "auto" }}
            value=""
            onChange={(event) => {
              props.setCompare([...props.compare, event.target.value]);
              setAdding(false);
            }}
          >
            <option value="" disabled>
              Choose a lead
            </option>
            {spare.map((r) => (
              <option key={r.supplierId} value={r.supplierId}>
                {shortId(r.supplierId)} · {r.name}
              </option>
            ))}
          </select>
        ) : (
          <button className="btn sm" type="button" style={{ marginLeft: "auto" }} onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> Add column
          </button>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="matrix">
          <thead>
            <tr>
              <th style={{ width: 150 }} />
              {columns.map((r) => (
                <th key={r.supplierId} style={r.stage === "CURRENT" ? { background: "var(--rice-soft)", color: "var(--rice-ink)" } : undefined}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {shortId(r.supplierId)}
                    {r.stage === "CURRENT" ? " · benchmark" : null}
                    {r.profile === undefined ? null : (
                      <button className="btn ghost sm" type="button" aria-label={`Remove ${shortId(r.supplierId)}`} style={{ marginLeft: "auto", minHeight: 22, padding: "0 4px" }} onClick={() => props.setCompare(props.compare.filter((id) => id !== r.supplierId))}>
                        ×
                      </button>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Cost per meal</th>
              {columns.map((r) => {
                const text = comparisonText(r.line.perMealJson);
                return r.profile === undefined ? (
                  <Cell key={r.supplierId} main={`${text?.paidCents ?? "Unknown"}¢`} sub="paid, reconciled" tone="var(--warn-soft)" />
                ) : (
                  <Cell key={r.supplierId} main={`${text?.quotedCents ?? "Unknown"}¢`} sub="quote, not paid" />
                );
              })}
            </tr>
            <tr>
              <th scope="row">Unit price</th>
              {columns.map((r) => {
                const order = lastOrder(r);
                return r.profile === undefined ? (
                  <Cell key={r.supplierId} main={order?.unitPriceCentsPer1000 === undefined ? "Unknown" : `${usdPerUnit(Number(order.unitPriceCentsPer1000))} $/${unit(r)}`} sub={`latest purchase · ${order?.recordedAt?.slice(0, 10) ?? ""}`} />
                ) : (
                  <Cell key={r.supplierId} main={r.profile.quotedCentsPer1000 === undefined ? "Unknown" : `${usdPerUnit(Number(r.profile.quotedCentsPer1000))} $/${unit(r)}`} sub={`quoted ${r.profile.submittedAt?.slice(0, 10) ?? ""}`} />
                );
              })}
            </tr>
            <tr>
              <th scope="row">Capacity / month</th>
              {columns.map((r) =>
                r.verification?.confirmedCapacityPerMonth !== undefined ? (
                  <Cell key={r.supplierId} main={`${thousands(Number(r.verification.confirmedCapacityPerMonth))} ${unit(r)}`} sub="confirmed on a visit" />
                ) : r.profile?.claimedCapacityPerMonth !== undefined ? (
                  <Cell key={r.supplierId} main={`${thousands(Number(r.profile.claimedCapacityPerMonth))} ${unit(r)}`} sub="claimed" />
                ) : (
                  <Cell key={r.supplierId} main="Unknown" />
                ),
              )}
            </tr>
            <tr>
              <th scope="row">Moisture</th>
              {columns.map((r) => {
                if (r.verification?.moisturePermille !== undefined) return <Cell key={r.supplierId} main={`${Number(r.verification.moisturePermille) / 10}%`} sub={`measured ${r.verification.visitedAt?.slice(0, 10) ?? ""}`} />;
                const claim = moistureClaim(r);
                if (claim !== null) return <Cell key={r.supplierId} main={claim} sub="claimed · AI extraction" />;
                return <Cell key={r.supplierId} main="—" sub={r.extraction === null ? "not extracted yet" : "not stated · gap"} />;
              })}
            </tr>
            <tr>
              <th scope="row">Failure risk</th>
              {columns.map((r) =>
                r.line.failureRisk === "UNKNOWN" ? (
                  <td key={r.supplierId}>
                    <span className="chip">Unknown · {String(r.line.batchCount ?? 0)} batches</span>
                  </td>
                ) : (
                  <Cell key={r.supplierId} main="Known" sub={`${String(r.line.batchCount ?? 0)} batches · ${String(r.line.supplierFailures ?? 0)} supplier fail`} />
                ),
              )}
            </tr>
            <tr>
              <th scope="row">Status</th>
              {columns.map((r) => (
                <td key={r.supplierId}>{STAGE_CHIP[r.stage]}</td>
              ))}
            </tr>
            <tr>
              <th scope="row" />
              {columns.map((r) => (
                <td key={r.supplierId}>
                  {r.stage === "CURRENT" || r.stage === "PASS" ? (
                    <Link className="btn sm primary" to="..">
                      Record decision
                    </Link>
                  ) : (
                    <button className="btn sm" type="button" aria-pressed={r.supplierId === props.focusId} onClick={() => {
                        props.setFocusId(r.supplierId);
                        setTimeout(() => document.getElementById("lead-profile")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
                      }}>
                      {r.supplierId === props.focusId ? "Open below" : "Open lead"}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <FnRow items={["CsCostLine", "CsFieldVerification", "CsSupplierProfileVersion", "csSelectFieldVisit", "csRecordSourcingDecision"]} />
    </section>
  );
}

/** The profile text with each AI-cited span marked. A span is verbatim (validateExtractionOutput checks it). */
function Highlighted({ text, spans }: { readonly text: string; readonly spans: readonly string[] }) {
  const marks: { start: number; end: number }[] = [];
  for (const span of [...new Set(spans)].sort((a, b) => b.length - a.length)) {
    const start = text.indexOf(span);
    if (start < 0 || span === "") continue;
    const end = start + span.length;
    if (marks.some((m) => start < m.end && end > m.start)) continue;
    marks.push({ start, end });
  }
  marks.sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let at = 0;
  for (const m of marks) {
    if (m.start > at) parts.push(text.slice(at, m.start));
    parts.push(
      <mark key={m.start} className="claim">
        {text.slice(m.start, m.end)}
      </mark>,
    );
    at = m.end;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

function LeadDetail({ data, row, leads, setFocusId, reload }: { readonly data: ExpansionData; readonly row: Row; readonly leads: readonly Row[]; readonly setFocusId: (id: string) => void; readonly reload: () => void }) {
  const expected = expectedOf(data);
  const revision = expected.expectedEvidenceRevision;
  const profile = row.profile;
  const versionId = profile?.versionId ?? "";
  const extractionRun = latestRun(data, "EXTRACTION", versionId);
  const draft = latestRun(data, "OUTREACH_DRAFT", versionId);
  const decided = draft !== undefined && data.decisions.some((d) => d.subjectId === draft.aiRunId && (d.decisionType === "APPROVE_OUTREACH" || d.decisionType === "REJECT_OUTREACH"));
  const selection = latestDecision(data, "SELECT_FIELD_VISIT", row.supplierId);
  const messages = data.outreach.filter((m) => m.supplierLogicalId === row.supplierId);
  const id = shortId(row.supplierId);
  return (
    <>
      <Section title={`${id} · ${row.name}`} sub="Profile and extracted claims" actions={
          <>
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <span className="note">Lead</span>
              <select aria-label="Show lead" value={row.supplierId} onChange={(e) => setFocusId(e.target.value)} style={{ width: 210 }}>
                {leads.map((l) => (
                  <option key={l.supplierId} value={l.supplierId}>
                    {shortId(l.supplierId)} · {l.name}
                  </option>
                ))}
              </select>
            </label>
            {STAGE_CHIP[row.stage]}
            <StartAiJob expansionId={expected.expansionId} job="EXTRACTION" subjectId={versionId} label={extractionRun === undefined ? "Extract claims" : "Extract again"} onChanged={reload} />
          </>
        } id="lead-profile">
        <section className="card" aria-label={`${id} profile and claims`} style={{ overflow: "hidden" }}>
          <div style={{ height: 4, background: FOOD_VAR[row.line.commodity ?? ""] ?? "var(--brand)" }} />
          <div className="card-b grid g2" style={{ gap: 28, paddingTop: 22 }}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Profile</h3>
                {profile?.language === undefined ? null : <span className="chip">{profile.language}</span>}
                <span className="chip quote">quote {comparisonText(row.line.perMealJson)?.quotedCents ?? "?"}¢ a meal</span>
                <span className="note">{shortTime(profile?.submittedAt)}</span>
              </div>
              <p lang={profile?.language} style={{ margin: 0, fontSize: 15, lineHeight: 1.75 }}>
                <Highlighted text={profile?.text ?? ""} spans={row.extraction?.claims.map((c) => c.span) ?? []} />
              </p>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Extracted claims</h3>
                <span className="chip ai">claims, not facts</span>
              </div>
              {extractionRun === undefined ? <div className="empty">Not extracted yet.</div> : <ExtractionView run={extractionRun} evidenceRevision={revision} />}
            </div>
          </div>
          <FnRow items={["csStartAiJob · EXTRACTION", "validateExtractionOutput (verbatim spans)", "CsAiRun.outputJson"]} />
        </section>
      </Section>

      <Section title="Field visit and outreach">
        <div className="grid g2">
          <section className="card" aria-labelledby="fv" style={{ alignSelf: "start" }}>
            <div className="card-h">
              <h3 id="fv">Field visit</h3>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {selection === undefined ? null : (
                <div className="note">
                  <b style={{ color: "var(--ink)" }}>Selected for a visit</b> {shortTime(selection.createdAt)}: “{selection.rationale}”
                </div>
              )}
              {row.verification === undefined ? null : (
                <div className="note">
                  <b style={{ color: "var(--ink)" }}>Visit result: {row.verification.result === "PASS" ? "passed" : "failed"}</b> on {row.verification.visitedAt?.slice(0, 10)}. Moisture{" "}
                  {row.verification.moisturePermille === undefined ? "not measured" : `${Number(row.verification.moisturePermille) / 10}%`}, {String(row.verification.sourceConfirmedCapacityPerMonth)} kg a month confirmed. “{row.verification.notes}”
                </div>
              )}
              {row.stage === "LEAD" ? (
                <>
                  <SelectFieldVisit {...expected} supplierLogicalId={row.supplierId} onChanged={reload} />
                </>
              ) : null}
              {row.stage === "SELECTED" ? <RecordVerification expansionId={expected.expansionId} supplierLogicalId={row.supplierId} rationVersion={Number(data.expansion.rationVersion)} onChanged={reload} /> : null}
            </div>
            <FnRow items={["csSelectFieldVisit", "csRecordFieldVerification → computeSnapshot"]} />
          </section>

          <section className="card ai-card" aria-labelledby="ow" style={{ alignSelf: "start" }}>
            <div className="card-h">
              <span className="ico" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                <Icon name="send" size={14} />
              </span>
              <h3 id="ow">Outreach</h3>
              <span className="chip ai" style={{ marginLeft: "auto" }}>
                AI draft · you approve
              </span>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {draft === undefined ? <p className="note">No draft yet.</p> : <OutreachDraft key={draft.aiRunId} {...expected} run={draft} decided={decided} onChanged={reload} />}
              <StartAiJob expansionId={expected.expansionId} job="OUTREACH_DRAFT" subjectId={versionId} label={draft === undefined ? "Draft message" : "Draft again"} onChanged={reload} />
              {messages.map((m) => (
                <div key={m.messageId} style={{ borderTop: "1px solid var(--soft)", paddingTop: 10 }}>
                  <span className="chip ok">Notification requested</span> <span className="note">{shortTime(m.createdAt)} · Foundry does not report delivery, so ClearSpend claims none.</span>
                  <blockquote style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{m.approvedText}</blockquote>
                </div>
              ))}
            </div>
            <FnRow items={["csStartAiJob · OUTREACH_DRAFT", "csDecideOutreach", "CsOutreachMessage", "Action notification"]} />
          </section>
        </div>
      </Section>
    </>
  );
}
