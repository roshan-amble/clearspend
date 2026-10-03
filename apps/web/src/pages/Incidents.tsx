import { useState } from "react";
import { CauseProposalView, StartAiJob } from "../Ai";
import { axis, Chart } from "../charts";
import { ConfirmCause } from "../ConfirmCause";
import { expectedOf, latestRun, useExpansion, type ExpansionData } from "../data/expansion";
import { Ready } from "../Shell";
import { FnRow, foodName, Icon, Section } from "../ui";
import { plot, shortId, shortTime, thousands, type IncidentView } from "../view";

export function Incidents() {
  const { reload } = useExpansion();
  return <Ready>{(data) => <Screen data={data} reload={reload} />}</Ready>;
}

type Lane = "PERSON" | "AI" | "CONFIRMED" | "RULE";

function laneOf(data: ExpansionData, incident: IncidentView): Lane {
  if (incident.status === "RULE_CLASSIFIED") return "RULE";
  if (incident.status === "CONFIRMED") return "CONFIRMED";
  const run = latestRun(data, "CAUSE", incident.incidentLogicalId);
  return run?.status === "SUCCEEDED" && Number(run.evidenceRevision) === Number(data.expansion.evidenceRevision) ? "AI" : "PERSON";
}

const CAUSE_WORDS: Record<string, string> = {
  SUPPLIER: "the supplier",
  TRANSPORT_AFTER_HANDOVER: "transport after handover",
  STORAGE: "storage",
  BUYER: "the buyer",
  UNKNOWN: "unknown",
};
const causeText = (cause: string | null | undefined): string => (cause === null || cause === undefined ? "not confirmed" : (CAUSE_WORDS[cause] ?? cause.toLowerCase()));

const LANE: Record<Lane, { readonly title: string; readonly className: string }> = {
  PERSON: { title: "cause not confirmed", className: "chip warn" },
  AI: { title: "AI proposed a cause", className: "chip ai" },
  CONFIRMED: { title: "cause confirmed", className: "chip ok" },
  RULE: { title: "the supplier, by rule", className: "chip bad" },
};

/** P17, page 3: incident reports grouped by supplier. Click one for its timeline, documents, and cause. */
function Screen({ data, reload }: { readonly data: ExpansionData; readonly reload: () => void }) {
  const firstOpen = data.incidents.find((i) => i.status !== "RULE_CLASSIFIED" && i.status !== "CONFIRMED") ?? data.incidents[0];
  const [selectedId, setSelectedId] = useState(firstOpen?.incidentLogicalId ?? "");
  const selected = data.incidents.find((i) => i.incidentLogicalId === selectedId) ?? firstOpen;
  const supplierOf = (incident: IncidentView) => data.orders.get(incident.orderLogicalId)?.supplierLogicalId ?? "";
  const suppliers = [...new Set(data.incidents.map(supplierOf))].sort();
  return (
    <>
      <Section title="Incidents" sub={data.incidents.length === 0 ? "None on record" : `${data.incidents.length} across ${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"}`}>
        {data.incidents.length === 0 ? <div className="empty">No delivery has failed in this program.</div> : null}
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
          {suppliers.map((supplierLogicalId) => {
            const items = data.incidents.filter((i) => supplierOf(i) === supplierLogicalId);
            const supplier = data.suppliers.get(supplierLogicalId);
            return (
              <section key={supplierLogicalId} className="card" aria-label={`Incidents of ${shortId(supplierLogicalId)}`} style={{ overflow: "hidden" }}>
                <div className="card-h">
                  <h3>{shortId(supplierLogicalId)}</h3>
                  <span className="note">{(supplier?.name ?? "").replace(" (fictional)", "")}</span>
                  <span className="chip" style={{ marginLeft: "auto" }}>
                    {items.length} incident{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map((incident) => {
                    const object = data.incidentObjects.get(incident.versionId);
                    const order = data.orders.get(incident.orderLogicalId);
                    const lane = LANE[laneOf(data, incident)];
                    return (
                      <button key={incident.incidentLogicalId} type="button" className="lane-card" aria-pressed={incident.incidentLogicalId === selected?.incidentLogicalId} onClick={() => setSelectedId(incident.incidentLogicalId)}>
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <b className="mono">{shortId(incident.incidentLogicalId)}</b>
                          <span className={lane.className} style={{ marginLeft: "auto" }}>
                            {incident.status === "CONFIRMED" || incident.status === "RULE_CLASSIFIED" ? `cause: ${causeText(incident.effectiveCause)}` : lane.title}
                          </span>
                        </span>
                        <span className="note">
                          {foodName(order?.commodity ?? "")} · order {shortId(incident.orderLogicalId)}
                          {object === undefined ? "" : ` · ${thousands(Number(object.affectedQuantity ?? 0))} kg affected`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </Section>

      {selected === undefined ? null : <Detail key={selected.incidentLogicalId} data={data} incident={selected} reload={reload} />}
    </>
  );
}

function Detail({ data, incident, reload }: { readonly data: ExpansionData; readonly incident: IncidentView; readonly reload: () => void }) {
  const expected = expectedOf(data);
  const revision = expected.expectedEvidenceRevision;
  const object = data.incidentObjects.get(incident.versionId);
  const order = data.orders.get(incident.orderLogicalId);
  const deliveries = data.deliveries.filter((d) => d.orderLogicalId === incident.orderLogicalId);
  const replacements = [...data.orders.values()].filter((o) => o.replacesOrderLogicalId === incident.orderLogicalId);
  const run = latestRun(data, "CAUSE", incident.incidentLogicalId);
  const proposalId = run?.status === "SUCCEEDED" && Number(run.evidenceRevision) === revision ? `${run.aiRunId}:proposal` : undefined;
  const confirmations = data.decisions.filter((d) => d.decisionType === "CONFIRM_CAUSE" && d.subjectId === incident.incidentLogicalId);
  const name = shortId(incident.incidentLogicalId);
  const points = data.history
    .map(({ snapshot, lines }) => {
      const line = lines.find((l) => l.supplierLogicalId === order?.supplierLogicalId && l.commodity === order?.commodity);
      const pm = line?.perMealJson === undefined ? null : (JSON.parse(line.perMealJson) as Record<string, string | null>);
      return { rev: `rev ${String(snapshot.evidenceRevision)}`, low: plot(pm?.supplierLow), high: plot(pm?.supplierHigh) };
    })
    .filter((p) => p.low !== null);
  const timeline = [
    ...(order === undefined ? [] : [{ at: order.recordedAt ?? "", tone: "var(--line-strong)", title: `Ordered ${thousands(Number(order.quantity ?? 0))} kg`, sub: `Order ${shortId(order.logicalId ?? "")}` }]),
    ...deliveries.map((d) => ({
      at: d.receivedAt ?? "",
      tone: d.acceptanceResult === "PASS" ? "var(--ok)" : "var(--bad)",
      title: `Received ${thousands(Number(d.quantityReceived ?? 0))} kg`,
      sub: `Receipt test ${d.acceptanceResult === "PASS" ? "passed" : "failed"}${d.moisturePermille === undefined ? "" : `, moisture ${Number(d.moisturePermille) / 10}%`}. Handed over ${shortTime(d.handoverAt)}.`,
    })),
    ...(object === undefined ? [] : [{ at: object.reportedAt ?? "", tone: "var(--bad)", title: "Failure reported", sub: `${thousands(Number(object.affectedQuantity ?? 0))} kg could not be used` }]),
    ...replacements.map((r) => ({ at: r.recordedAt ?? "", tone: "var(--brand)", title: "Replacement ordered", sub: `${thousands(Number(r.quantity ?? 0))} kg, order ${shortId(r.logicalId ?? "")}` })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const status =
    incident.status === "RULE_CLASSIFIED" ? (
      <span className="chip bad">Rule-classified · supplier</span>
    ) : incident.status === "CONFIRMED" ? (
      <span className="chip ok">Confirmed · {causeText(incident.effectiveCause)}</span>
    ) : (
      <span className="chip warn">Unconfirmed · cost is a range</span>
    );
  return (
    <>
      <Section title={name} sub="Timeline and documents" actions={status}>
        <section className="card" aria-label={`${name} timeline`}>
          <div className="card-b" style={{ paddingTop: 22 }}>
            <ol className="timeline" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(timeline.length, 1), 5)}, minmax(0,1fr))` }}>
              {timeline.map((t) => (
                <li key={`${t.at}-${t.title}`} style={{ borderTopColor: t.tone }}>
                  <span className="chip mono">{shortTime(t.at)}</span>
                  <div style={{ fontWeight: 650, marginTop: 8 }}>{t.title}</div>
                  <div className="note">{t.sub}</div>
                </li>
              ))}
            </ol>
          </div>
          <FnRow items={["CsPurchaseOrder", "CsDelivery (acceptanceResult, handoverAt)", "CsIncident", "replacesOrderLogicalId"]} />
        </section>
        <div className="grid g2">
          {(object?.documents ?? []).map((doc) => (
            <article key={doc.documentId} className="card" id={doc.documentId} style={{ overflow: "hidden" }}>
              <div style={{ height: 4, background: "var(--brand-2)" }} />
              <div className="card-h">
                <h3 style={{ textTransform: "capitalize" }}>{doc.authorRole?.replaceAll("_", " ")}</h3>
                <span className="note mono" style={{ marginLeft: "auto" }}>
                  {doc.documentId} · {shortTime(doc.recordedAt)}
                </span>
              </div>
              <div className="card-b">
                <blockquote style={{ fontSize: 14.5, lineHeight: 1.65 }}>“{doc.text}”</blockquote>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Cause" sub={incident.status === "RULE_CLASSIFIED" ? "Set by the receipt-test rule" : "AI proposal and confirmation"}>
        {incident.status === "RULE_CLASSIFIED" ? null : (
          <div className="grid g2">
            <section className="card ai-card" aria-labelledby="ai" style={{ overflow: "hidden", alignSelf: "start" }}>
              <div style={{ height: 4, background: "linear-gradient(90deg,var(--ai),var(--brand-2))" }} />
              <div className="card-h">
                <span className="ico" style={{ background: "var(--ai-soft)", color: "var(--ai)" }}>
                  <Icon name="spark" size={15} />
                </span>
                <h3 id="ai">AI proposal</h3>
                <span className="chip ai" style={{ marginLeft: "auto" }}>
                  AI · changes nothing
                </span>
              </div>
              <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {run === undefined ? <p className="note">No proposal yet.</p> : <CauseProposalView run={run} evidenceRevision={revision} />}
                <StartAiJob expansionId={expected.expansionId} job="CAUSE" subjectId={incident.incidentLogicalId} label={run === undefined ? "Propose a cause" : "Propose again"} onChanged={reload} />
              </div>
              <FnRow items={["csStartAiJob · CAUSE", "validateCauseOutput", "CsCauseProposal"]} />
            </section>
            <section className="card" aria-labelledby="dc" style={{ alignSelf: "start" }}>
              <div className="card-h">
                <h3 id="dc">Confirmation</h3>
              </div>
              <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <ConfirmCause {...expected} incidentLogicalId={incident.incidentLogicalId} {...(proposalId === undefined ? {} : { answersProposalId: proposalId })} onChanged={reload} />
                {confirmations.length === 0 ? null : (
                  <div>
                    <b style={{ fontSize: 13.5 }}>History</b>
                    <ol style={{ margin: "6px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                      {confirmations.map((d) => (
                        <li key={d.decisionId}>
                          {causeText(d.chosenCause)} at revision {String(d.evidenceRevision)}: “{d.rationale}” · {shortTime(d.createdAt)}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
              <FnRow items={["csConfirmIncidentCause", "D6 guard: expected revision, requestId"]} />
            </section>
          </div>
        )}
      </Section>

      <Section title="Cost history" sub={`${foodName(order?.commodity ?? "")} · ${shortId(order?.supplierLogicalId ?? "")} · ¢ per meal by evidence revision`}>
        <section className="card" aria-label="Cost by evidence revision">
          <div className="card-b" style={{ paddingTop: 20 }}>
            {points.length === 0 ? (
              <div className="empty">No cost history for this supplier yet.</div>
            ) : (
              <Chart
                height={240}
                label="Cost per meal by evidence revision"
                deps={[JSON.stringify(points)]}
                build={(c) => {
                  const lows = points.map((p) => p.low ?? 0);
                  const highs = points.map((p) => p.high ?? p.low ?? 0);
                  return {
                    grid: { left: 40, right: 16, top: 24, bottom: 28 },
                    tooltip: { trigger: "axis" },
                    xAxis: { type: "category", data: points.map((p) => p.rev), ...axis(c) },
                    yAxis: { type: "value", name: "¢ a meal", nameTextStyle: { color: c.muted, fontSize: 10 }, min: Math.floor(Math.min(...lows) - 0.5), max: Math.ceil(Math.max(...highs) + 0.3), ...axis(c) },
                    series: [
                      { name: "Low", type: "line", stack: "b", data: lows, symbol: "circle", symbolSize: 7, lineStyle: { color: c.rice, width: 2.5 }, itemStyle: { color: c.rice } },
                      { name: "Range", type: "line", stack: "b", data: highs.map((h, i) => +(h - (lows[i] ?? 0)).toFixed(3)), symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: c.rice, opacity: 0.3 } },
                    ],
                  };
                }}
              />
            )}
          </div>
          <FnRow items={["csConfirmIncidentCause → computeSnapshot", "CsCostSnapshot history"]} />
        </section>
      </Section>
    </>
  );
}
