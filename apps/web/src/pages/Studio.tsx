import { canonicalJson, EDITABLE_KINDS, namespaceExpansion, parseEvidenceRows, sourceRowOf, type EditableKind, type EvidenceKind, type Json, type PlannedRow } from "@clearspend/domain";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { client, currentUserId } from "../client";
import { describe } from "../command";
import { useExpansion, type ExpansionData } from "../data/expansion";
import { csRecordFieldVerification, CsExpansion } from "../sdk";
import { Ready } from "../Shell";
import {
  applyImport,
  batchText,
  dryRun,
  fixture,
  inNamespace,
  kindOfColumns,
  LATER_FILES,
  loadRecords,
  MAIN_FILES,
  namespaceOf,
  propsOf,
  readRows,
  rowDigest,
  sha256Hex,
  stableRequestId,
  type DryRun,
  type StoredRecord,
} from "../studio";
import { FnRow, Icon, Section } from "../ui";
import { shortId, shortTime } from "../view";

/** UI3 A: development only. Every write is a Foundry Action as the signed-in user; evidence is append-only (D4). */
export function Studio() {
  const { reload } = useExpansion();
  return <Ready>{(data) => <Screen data={data} reload={reload} />}</Ready>;
}

const KIND_LABEL: Record<EditableKind, string> = {
  orders: "Purchase orders",
  payments: "Payments",
  invoices: "Invoices",
  deliveries: "Deliveries",
  incidents: "Incidents",
  "supplier-profiles": "Supplier profiles",
};
const KIND_COLOR: Record<EditableKind, string> = {
  orders: "var(--rice)",
  payments: "var(--rice)",
  invoices: "var(--rice)",
  deliveries: "var(--oil)",
  incidents: "var(--beans)",
  "supplier-profiles": "var(--quote)",
};
/** The fields that name the record. Changing them would make a different record, so the editor locks them. */
const LOCKED: Record<EditableKind, readonly string[]> = {
  orders: ["source_system", "order_id", "expansion_id"],
  payments: ["source_system", "payment_id"],
  invoices: ["source_system", "invoice_id"],
  deliveries: ["source_system", "receipt_id"],
  incidents: ["source_system", "incident_id"],
  "supplier-profiles": ["source_system", "supplier_id", "commodity"],
};

type Log = { readonly tone: "ok" | "bad" | "info"; readonly text: string };

function Screen({ data, reload }: { readonly data: ExpansionData; readonly reload: () => void }) {
  const expansionId = data.expansion.expansionId ?? "";
  const namespace = namespaceOf(expansionId);
  const [log, setLog] = useState<readonly Log[]>([]);
  const [busy, setBusy] = useState(false);
  const say = (entry: Log) => setLog((items) => [...items, entry]);

  /** Runs steps in order and stops at the first failure, like the scripts. */
  async function runSteps(title: string, steps: readonly { label: string; run: () => Promise<string> }[]) {
    setBusy(true);
    setLog([{ tone: "info", text: title }]);
    try {
      for (const step of steps) {
        try {
          say({ tone: "ok", text: `${step.label}: ${await step.run()}` });
        } catch (error) {
          say({ tone: "bad", text: `${step.label}: FAILED. ${describe(error)}` });
          break;
        }
      }
    } finally {
      setBusy(false);
      reload();
    }
  }

  return (
    <>
      <section className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "linear-gradient(135deg,var(--surface),var(--info-soft))" }}>
        <span className="ico" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
          <Icon name="db" size={15} />
        </span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <b>Expansion</b>
        </div>
        <ExpansionSwitch current={expansionId} />
      </section>

      <Section title="Scenarios">
        <Scenarios data={data} namespace={namespace} busy={busy} runSteps={runSteps} />

      {log.length === 0 ? null : (
        <section className="card" aria-live="polite" style={{ padding: "12px 16px" }}>
          <ol className="mono" style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 4 }}>
            {log.map((entry, index) => (
              <li key={index} style={{ color: entry.tone === "bad" ? "var(--bad)" : entry.tone === "ok" ? "var(--ink)" : "var(--muted)" }}>
                {entry.text}
              </li>
            ))}
            {busy ? <li className="note">Working…</li> : null}
          </ol>
        </section>
      )}

      </Section>

      <Section title="Records" sub="Edits are stored as new versions">
        <Records data={data} reload={reload} />
      </Section>

      <Section title="File import" sub="CSV or JSON">
        <FileImport data={data} namespace={namespace} busy={busy} runSteps={runSteps} />
      </Section>

      <Section title="Import history">
        <ImportHistory data={data} />
      </Section>
    </>
  );
}

function ExpansionSwitch({ current }: { readonly current: string }) {
  const navigate = useNavigate();
  const [ids, setIds] = useState<readonly string[]>([current]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const found: string[] = [];
      for await (const e of client(CsExpansion).asyncIter()) if (e.expansionId !== undefined) found.push(e.expansionId);
      if (live) setIds(found.sort());
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <label htmlFor="ns">Expansion</label>
      <select id="ns" style={{ width: 280 }} value={current} onChange={(e) => navigate(`/expansions/${encodeURIComponent(e.target.value)}/studio`)}>
        {ids.map((id) => (
          <option key={id} value={id}>
            {id} · {namespaceOf(id) ?? "no namespace"}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------

type RunSteps = (title: string, steps: readonly { label: string; run: () => Promise<string> }[]) => Promise<void>;

/** The field verification fixture rows through the Action, with the script's stable request IDs (D6 replay). */
const verificationSteps = (file: string, expansionId: string, namespace: string | null) => verificationStepsFromText(file, fixture(file), expansionId, namespace);

function fileSteps(files: readonly { kind: EvidenceKind; file: string }[], expansionId: string, namespace: string | null) {
  return files.map(({ kind, file }) => ({
    label: file,
    run: async () => {
      const text = fixture(file);
      const rows = inNamespace(readRows(file, text), namespace);
      parseEvidenceRows(kind, rows);
      // The digest of the file's bytes, as `npm run import` sends it, so the 2 tools replay each other.
      return batchText(await applyImport(expansionId, kind, file, await sha256Hex(text), rows));
    },
  }));
}

function Scenario(props: { readonly title: string; readonly sub: ReactNode; readonly chip: ReactNode; readonly color: string; readonly fn: string; readonly children: ReactNode }) {
  return (
    <article className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="dot" style={{ background: props.color, width: 10, height: 10 }} />
        <b>{props.title}</b>
        <span style={{ marginLeft: "auto" }}>{props.chip}</span>
      </div>
      <span className="note">{props.sub}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "auto", flexWrap: "wrap" }}>{props.children}</div>
      <FnRow items={[props.fn]} />
    </article>
  );
}

function Scenarios({ data, namespace, busy, runSteps }: { readonly data: ExpansionData; readonly namespace: string | null; readonly busy: boolean; readonly runSteps: RunSteps }) {
  const expansionId = data.expansion.expansionId ?? "";
  const navigate = useNavigate();
  const [fresh, setFresh] = useState("");
  const freshOk = /^[a-z][a-z0-9]{0,15}$/.test(fresh);
  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
        <Scenario title="Replay and correction" chip={<span className="chip warn">Scenario 5</span>} color="var(--rice)" fn="cs-import-evidence-batch" sub="payments-replay.csv · deliveries-correction.csv">
          <button className="btn sm primary" type="button" disabled={busy} onClick={() => void runSteps(`Later batches into ${expansionId}`, fileSteps(LATER_FILES, expansionId, namespace))}>
            Run
          </button>
        </Scenario>
        <Scenario title="Field verifications" chip={<span className="chip warn">Scenario 9</span>} color="var(--target)" fn="cs-record-field-verification" sub="field-verifications-later.csv · SUP-L1 pass, SUP-L4 fail">
          <button
            className="btn sm primary"
            type="button"
            disabled={busy}
            onClick={() => void (async () => runSteps(`Field results into ${expansionId}`, await verificationSteps("field-verifications-later.csv", expansionId, namespace)))()}
          >
            Run
          </button>
        </Scenario>
        <Scenario title="Price targets" chip={<span className="chip new">Planning</span>} color="var(--quote)" fn="cs-set-commodity-target" sub="Set on Price intelligence">
          <Link className="btn sm" to="../prices">
            Open price intelligence
          </Link>
        </Scenario>
        <Scenario title="New namespace" chip={<span className="chip">Reset</span>} color="var(--brand)" fn="cs-import-evidence-batch × 9 · cs-record-field-verification × 2" sub="All fixture files into a new namespace">
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <input aria-label="New namespace" placeholder="t3" value={fresh} onChange={(e) => setFresh(e.target.value.trim())} style={{ width: 90 }} />
          </div>
          <button
            className="btn sm primary"
            type="button"
            disabled={busy || !freshOk}
            onClick={() =>
              void (async () => {
                const target = namespaceExpansion("EXP-ANDROY-2026", fresh);
                await runSteps(`New namespace ${fresh}: ${target}`, [...fileSteps(MAIN_FILES, target, fresh), ...(await verificationSteps("field-verifications-initial.csv", target, fresh))]);
                navigate(`/expansions/${encodeURIComponent(target)}/studio`);
              })()
            }
          >
            Create
          </button>
          {fresh !== "" && !freshOk ? <span className="note" style={{ color: "var(--bad)" }}>Lower-case letters and digits</span> : null}
        </Scenario>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------

const OUTCOME_CHIP: Record<PlannedRow["outcome"]["result"], string> = { ACCEPTED: "chip ok", REPLAYED: "chip", VERSIONED: "chip brand", CONFLICTING: "chip warn", UNMATCHED: "chip bad" };
const OUTCOME_TEXT: Record<PlannedRow["outcome"]["result"], string> = {
  ACCEPTED: "new record",
  REPLAYED: "identical, changes nothing",
  VERSIONED: "a new version supersedes the stored one",
  CONFLICTING: "differs from a record that cannot be versioned",
  UNMATCHED: "names a record that is not stored",
};

function Outcome({ planned }: { readonly planned: PlannedRow }) {
  const o = planned.outcome;
  return (
    <span className={OUTCOME_CHIP[o.result]} title={OUTCOME_TEXT[o.result]}>
      {o.result}
      {o.result === "UNMATCHED" ? ` · ${o.missing.map(shortId).join(", ")}` : ""}
    </span>
  );
}

/** A short summary of a stored record for the grid. */
function summary(record: StoredRecord): string {
  const row = sourceRowOf(record.kind as "orders", record.logicalId, propsOf(record.kind, record.head) as never);
  const r = row as Record<string, unknown>;
  switch (record.kind) {
    case "orders":
      return `${String(r.supplier_id)} · ${String(r.commodity)} · ${String(r.quantity)} ${String(r.unit)} · ${String(r.unit_price_cents)}¢/${String(r.unit)}`;
    case "payments":
      return `${String(r.order_id)} · ${String(r.amount_cents)}¢ · ${String(r.paid_at).slice(0, 10)}`;
    case "invoices":
      return `${String(r.order_id)} · ${String(r.quantity)} ${String(r.unit)} · ${String(r.total_cents)}¢`;
    case "deliveries":
      return `${String(r.order_id)} · ${String(r.quantity_received)} ${String(r.unit)} · moisture ${String(r.moisture_permille) || "—"}‰ · ${String(r.acceptance_result)}`;
    case "incidents":
      return `${String(r.order_id)} · ${String(r.affected_quantity_kg)} kg · ${(r.documents as unknown[]).length} documents`;
    case "supplier-profiles":
      return `${String(r.supplier_id)} · ${String(r.commodity)} · ${String(r.quoted_price_cents_per_kg)}¢/kg · ${String(r.claimed_capacity_kg_per_month)} kg/month`;
  }
}

function Records({ data, reload }: { readonly data: ExpansionData; readonly reload: () => void }) {
  const expansionId = data.expansion.expansionId ?? "";
  const orderIds = useMemo(() => [...data.orders.keys()], [data.orders]);
  const [kind, setKind] = useState<EditableKind>("deliveries");
  const [records, setRecords] = useState<readonly StoredRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const revision = String(data.expansion.evidenceRevision);
  useEffect(() => {
    let live = true;
    setRecords(null);
    setError(null);
    loadRecords(kind, expansionId, orderIds)
      .then((items) => live && setRecords(items))
      .catch((e: unknown) => live && setError(describe(e)));
    return () => {
      live = false;
    };
  }, [kind, expansionId, orderIds, generation, revision]);
  const shown = (records ?? []).filter((r) => filter === "" || `${r.logicalId} ${summary(r)}`.toLowerCase().includes(filter.toLowerCase()));
  const open = records?.find((r) => r.logicalId === openId);
  return (
    <div className="grid" style={{ gridTemplateColumns: "190px minmax(0,1fr) minmax(300px,380px)", gap: 16, alignItems: "start" }}>
      <nav className="card" aria-label="Record kinds" style={{ padding: 8 }}>
        <div className="note" style={{ fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 10.5, padding: "8px 10px 4px" }}>
          Evidence · versioned
        </div>
        {EDITABLE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="lane-card"
            aria-pressed={k === kind}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, border: 0, padding: "7px 10px", background: k === kind ? "var(--brand-soft)" : "transparent", fontWeight: k === kind ? 650 : 500 }}
            onClick={() => {
              setKind(k);
              setOpenId(null);
            }}
          >
            <span className="dot" style={{ background: KIND_COLOR[k] }} />
            {KIND_LABEL[k]}
          </button>
        ))}
        <div className="note" style={{ fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 10.5, padding: "12px 10px 4px" }}>
          Read only here
        </div>
        <div className="note" style={{ padding: "0 10px 8px", lineHeight: 1.6 }}>
          {data.verifications.length} field verifications · {data.decisions.length} decisions · {data.aiRuns.length} AI runs · {data.history.length} cost snapshots · {data.imports.length} import batches
        </div>
      </nav>

      <section className="card" aria-labelledby="gt" style={{ overflow: "hidden", minWidth: 0 }}>
        <div className="card-h">
          <h3 id="gt">{KIND_LABEL[kind]}</h3>
          <span className="chip">{records === null ? "…" : `${records.length} records`}</span>
          <input aria-label="Filter" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ marginLeft: "auto", width: 140, height: 32, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px", background: "var(--surface-2)", color: "var(--ink)" }} />
        </div>
        {error === null ? null : (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Versions</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.logicalId} style={{ cursor: "pointer", background: r.logicalId === openId ? "var(--brand-soft)" : undefined }} onClick={() => setOpenId(r.logicalId)}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn ghost sm" style={{ padding: 0, minHeight: 0 }} onClick={() => setOpenId(r.logicalId)}>
                      <span className="mono" style={{ fontWeight: 600, color: "var(--ink)" }}>
                        {shortId(r.logicalId)}
                      </span>
                    </button>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="note mono">v{r.versions.length}</span> {r.conflict ? <span className="chip warn">conflict</span> : null}
                  </td>
                  <td className="note">{summary(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {records !== null && shown.length === 0 ? <div className="empty" style={{ margin: 16 }}>No records.</div> : null}
        </div>
        <FnRow items={[`OSDK where/asyncIter · ${kind}`, "heads() · current versions"]} />
      </section>

      {open === undefined ? (
        <aside className="card" style={{ padding: 18 }}>
          <b>Editor</b>
          <p className="note">Select a record.</p>
        </aside>
      ) : (
        <Editor
          key={`${open.logicalId}@${open.head.versionId ?? ""}`}
          data={data}
          record={open}
          onApplied={() => {
            setGeneration((g) => g + 1);
            reload();
          }}
        />
      )}
    </div>
  );
}

type Form = Record<string, string>;

function formOf(row: Record<string, unknown>): Form {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v, null, k === "documents" ? 2 : 0)]));
}

function rowOf(form: Form): Record<string, unknown> {
  return Object.fromEntries(Object.entries(form).map(([k, v]) => [k, k === "documents" ? (JSON.parse(v) as unknown) : v]));
}

function Editor({ data, record, onApplied }: { readonly data: ExpansionData; readonly record: StoredRecord; readonly onApplied: () => void }) {
  const expansionId = data.expansion.expansionId ?? "";
  const original = useMemo(() => sourceRowOf(record.kind as "orders", record.logicalId, propsOf(record.kind, record.head) as never) as Record<string, unknown>, [record]);
  const [form, setForm] = useState<Form>(() => formOf(original));
  const [tab, setTab] = useState<"edit" | "history" | "json">("edit");
  const [roundTrip, setRoundTrip] = useState<"checking" | "ok" | string>("checking");
  const [plan, setPlan] = useState<DryRun | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "planning" | "applying" | "done" | "error"; text?: string }>({ kind: "idle" });
  const base = formOf(original);
  const changed = Object.keys(form).filter((k) => form[k] !== base[k]);

  // An unchanged record must give the stored digest, or the editor cannot write it faithfully.
  useEffect(() => {
    let live = true;
    rowDigest(record.kind, original)
      .then((digest) => live && setRoundTrip(digest === record.head.contentDigest ? "ok" : `The rebuilt row gives digest ${digest.slice(0, 12)}, the stored version has ${(record.head.contentDigest ?? "").slice(0, 12)}.`))
      .catch((e: unknown) => live && setRoundTrip(describe(e)));
    return () => {
      live = false;
    };
  }, [record, original]);

  // Every change is checked with the import rules, then planned against stored state (debounced).
  useEffect(() => {
    setPlan(null);
    if (changed.length === 0) {
      setProblem(null);
      return;
    }
    let raw: Record<string, unknown>;
    try {
      raw = rowOf(form);
      parseEvidenceRows(record.kind, [raw]);
      setProblem(null);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      setState({ kind: "planning" });
      dryRun(record.kind, [raw])
        .then((result) => {
          if (!live) return;
          setPlan(result);
          setState({ kind: "idle" });
        })
        .catch((e: unknown) => live && setState({ kind: "error", text: describe(e) }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(form)]);

  const planned = plan?.plan.rows[0];
  const locked = LOCKED[record.kind];
  async function apply() {
    const rows = [rowOf(form)];
    setState({ kind: "applying" });
    try {
      const digest = await sha256Hex(canonicalJson(rows as unknown as Json));
      const result = await applyImport(expansionId, record.kind, `studio:${record.logicalId}`, digest, rows);
      setState({ kind: "done", text: batchText(result) });
      onApplied();
    } catch (e) {
      setState({ kind: "error", text: describe(e) });
    }
  }

  return (
    <aside className="card" aria-labelledby="rec" style={{ overflow: "hidden" }}>
      <div style={{ height: 4, background: "linear-gradient(90deg,var(--brand),var(--target))" }} />
      <div className="card-h">
        <h3 id="rec" className="mono">
          {shortId(record.logicalId)}
        </h3>
        <span className="chip">v{record.versions.length} · current</span>
        {roundTrip === "ok" ? (
          <span className="chip ok" title="The unchanged record rebuilds to the stored digest, so an import of it would be REPLAYED.">
            <Icon name="check" size={11} /> round trip
          </span>
        ) : null}
      </div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="seg" role="tablist">
          {(["edit", "history", "json"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "edit" ? "Edit as new version" : t === "history" ? "History" : "JSON"}
            </button>
          ))}
        </div>
        {roundTrip !== "ok" && roundTrip !== "checking" ? (
          <div className="error-box" role="alert">
            <b>Editing is off for this record.</b> {roundTrip}
          </div>
        ) : null}

        {tab === "history" ? (
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
            {record.versions.map((v) => (
              <li key={v.versionId}>
                <span className="mono">{(v.versionId ?? "").split("@")[1]}</span> · imported {shortTime(v.importedAt)}
                {v.supersedesVersionId === undefined ? "" : ` · supersedes ${(v.supersedesVersionId ?? "").split("@")[1]}`}
                <div className="note mono">{(v.importBatchId ?? "").split(":").slice(1).join(":").slice(0, 16)}</div>
              </li>
            ))}
          </ol>
        ) : tab === "json" ? (
          <pre className="mono" style={{ fontSize: 11.5, whiteSpace: "pre-wrap", margin: 0, maxHeight: 360, overflow: "auto" }}>
            {JSON.stringify(original, null, 2)}
          </pre>
        ) : (
          <>
            <div className="grid g2" style={{ gap: 10 }}>
              {Object.keys(form).map((k) => {
                const isLocked = locked.includes(k);
                const wide = k === "documents" || k === "text";
                return (
                  <div key={k} className={`field${changed.includes(k) ? " changed" : ""}`} style={wide ? { gridColumn: "1/-1" } : undefined}>
                    <label htmlFor={`f-${k}`}>{k}</label>
                    {wide ? (
                      <textarea id={`f-${k}`} rows={k === "documents" ? 8 : 5} className="mono" style={{ fontSize: 12 }} value={form[k]} disabled={roundTrip !== "ok"} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    ) : (
                      <input id={`f-${k}`} value={form[k]} disabled={isLocked || roundTrip !== "ok"} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                    )}
                    {changed.includes(k) && !wide ? <span className="hint">was {base[k] === "" ? "empty" : base[k]}</span> : null}
                  </div>
                );
              })}
            </div>
            {changed.length === 0 ? null : (
              <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
                <div className="note" style={{ fontWeight: 700, padding: "8px 10px", background: "var(--th)", borderBottom: "1px solid var(--line)" }}>
                  CHANGE AGAINST v{record.versions.length}
                </div>
                <div className="mono" style={{ fontSize: 12, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflow: "auto" }}>
                  {changed.map((k) => (
                    <div key={k}>
                      <div style={{ color: "var(--bad)" }}>
                        − {k} {k === "documents" ? "(JSON)" : base[k]}
                      </div>
                      <div style={{ color: "var(--ok)" }}>
                        + {k} {k === "documents" ? "(JSON)" : form[k]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {problem === null ? null : (
              <div className="error-box" role="alert">
                {problem}
              </div>
            )}
            {planned === undefined ? null : (
              <div style={{ border: "1px solid var(--info-line)", background: "var(--info-soft)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <div className="note" style={{ fontWeight: 700, color: "var(--info)" }}>
                  DRY RUN · THE ACTION'S PLAN
                </div>
                <div>
                  Outcome <Outcome planned={planned} /> <span className="note">{OUTCOME_TEXT[planned.outcome.result]}</span>
                </div>
                <div>
                  Evidence revision{" "}
                  <b className="mono">
                    {String(data.expansion.evidenceRevision)}
                    {plan?.plan.changesEvidence === true ? ` → ${Number(data.expansion.evidenceRevision) + 1}` : " (unchanged)"}
                  </b>
                  {plan?.plan.changesEvidence === true ? " · the server recalculates the cost snapshot" : ""}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn primary"
                type="button"
                style={{ flex: 1 }}
                disabled={changed.length === 0 || problem !== null || planned === undefined || state.kind === "applying" || planned.outcome.result === "UNMATCHED"}
                onClick={() => void apply()}
              >
                {state.kind === "applying" ? "Applying…" : problem !== null ? "Fix the error to continue" : `Store version ${record.versions.length + 1}`}
              </button>
              <button className="btn" type="button" disabled={changed.length === 0} onClick={() => setForm(formOf(original))}>
                Discard
              </button>
            </div>
            {state.text === undefined ? null : (
              <p role={state.kind === "error" ? "alert" : "status"} className={state.kind === "error" ? "error" : "done"}>
                {state.text}
              </p>
            )}
          </>
        )}
      </div>
      <FnRow items={["sourceRowOf → parseEvidenceRows", "planImport (dry run)", "cs-import-evidence-batch", "D4 identity: logicalId@digest"]} />
    </aside>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function FileImport({ data, namespace, busy, runSteps }: { readonly data: ExpansionData; readonly namespace: string | null; readonly busy: boolean; readonly runSteps: RunSteps }) {
  const expansionId = data.expansion.expansionId ?? "";
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [kind, setKind] = useState<string>("");
  const [result, setResult] = useState<{ rows: Record<string, unknown>[]; plan: DryRun | null; error: string | null } | null>(null);
  useEffect(() => {
    if (file === null || kind === "") return setResult(null);
    let live = true;
    try {
      const rows = inNamespace(readRows(file.name, file.text), namespace);
      if (kind === "field-verifications") return setResult({ rows, plan: null, error: null });
      dryRun(kind as EvidenceKind, rows)
        .then((plan) => live && setResult({ rows, plan, error: null }))
        .catch((e: unknown) => live && setResult({ rows, plan: null, error: e instanceof Error ? e.message : describe(e) }));
    } catch (e) {
      setResult({ rows: [], plan: null, error: e instanceof Error ? e.message : String(e) });
    }
    return () => {
      live = false;
    };
  }, [file, kind, namespace]);
  const counts = result?.plan?.plan.counts;
  return (
    <section className="card" aria-labelledby="csv" style={{ overflow: "hidden" }}>
      <div className="card-h">
        <h3 id="csv">{file === null ? "No file chosen" : file.name}</h3>
        {result === null ? null : <span className="chip">{result.rows.length} rows · {kind}</span>}
        <span className="sub" style={{ marginLeft: "auto" }}>
          Namespace prefix: {namespace === null ? "none" : `“${namespace}/”`}
        </span>
      </div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label className="btn sm">
            <Icon name="upload" size={14} /> Choose a CSV or JSON file
            <input
              type="file"
              accept=".csv,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (chosen === undefined) return;
                void chosen.text().then((text) => {
                  setFile({ name: chosen.name, text });
                  try {
                    const rows = readRows(chosen.name, text);
                    setKind(kindOfColumns(Object.keys(rows[0] ?? {})) ?? "");
                  } catch {
                    setKind("");
                  }
                });
              }}
            />
          </label>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <label htmlFor="kind">Kind</label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 200 }}>
              <option value="">Choose</option>
              {[...EDITABLE_KINDS, "suppliers", "field-verifications"].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
        {result?.error === null || result === null ? null : (
          <div className="error-box" role="alert">
            {result.error}
          </div>
        )}
        {counts === undefined ? null : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 8 }}>
            {(["accepted", "replayed", "versioned", "conflicting", "unmatched"] as const).map((k) => (
              <div key={k} style={{ borderRadius: 10, padding: "8px 10px", background: k === "accepted" && counts[k] > 0 ? "var(--ok-soft)" : k === "unmatched" && counts[k] > 0 ? "var(--bad-soft)" : "var(--soft)" }}>
                <div className="kpi-big" style={{ fontSize: 22 }}>
                  {counts[k]}
                </div>
                <div className="note">{k}</div>
              </div>
            ))}
          </div>
        )}
        {result?.plan === null || result === null ? null : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Record</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {result.plan.plan.rows.map((p) => (
                  <tr key={`${p.row.rowNumber}`}>
                    <td className="mono">{p.row.rowNumber}</td>
                    <td className="mono">{shortId(p.row.logicalId)}</td>
                    <td>
                      <Outcome planned={p} /> <span className="note">{OUTCOME_TEXT[p.outcome.result]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {file === null || result === null || result.error !== null ? null : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn primary"
              type="button"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  if (kind === "field-verifications") {
                    await runSteps(`Field results from ${file.name}`, await verificationStepsFromText(file.name, file.text, expansionId, namespace));
                  } else {
                    const digest = await sha256Hex(file.text);
                    await runSteps(`${file.name} into ${expansionId}`, [{ label: file.name, run: async () => batchText(await applyImport(expansionId, kind as EvidenceKind, file.name, digest, result.rows)) }]);
                  }
                  setFile(null);
                  setKind("");
                })()
              }
            >
              {counts === undefined
                  ? `Record ${result.rows.length} field results`
                  : `Apply batch${result.plan?.plan.changesEvidence === true ? ` · revision ${String(data.expansion.evidenceRevision)} → ${Number(data.expansion.evidenceRevision) + 1}` : " · changes nothing"}`}
            </button>
            <button className="btn" type="button" onClick={() => setFile(null)}>
              Cancel
            </button>
          </div>
        )}
      </div>
      <FnRow items={["parseEvidenceRows", "planImport", "cs-import-evidence-batch", "cs-record-field-verification", "CsImportBatch"]} newItems={["import Action in the app scope (D9)"]} />
    </section>
  );
}

/** Field results through cs-record-field-verification, 1 row at a time, as `npm run record:verifications` does. */
async function verificationStepsFromText(name: string, text: string, expansionId: string, namespace: string | null) {
  const suppliers = new Map(parseEvidenceRows("suppliers", inNamespace(readRows("suppliers.csv", fixture("suppliers.csv")), namespace)).map((r) => [r.externalId, r.logicalId] as const));
  return readRows(name, text).map((raw) => {
    const row = inNamespace([raw], namespace)[0] as Record<string, string>;
    return {
      label: `${row.verification_id} ${row.result}`,
      run: async () => {
        const supplierLogicalId = suppliers.get(row.supplier_id ?? "");
        if (supplierLogicalId === undefined) throw new Error(`supplier ${row.supplier_id} is not in suppliers.csv`);
        try {
          await client(csRecordFieldVerification).applyAction({
            expansionId,
            supplierLogicalId,
            rationVersion: Number(row.ration_version),
            visitedAt: row.visited_at ?? "",
            result: row.result ?? "",
            sourceConfirmedCapacityPerMonth: Number(row.confirmed_capacity_kg_per_month),
            notes: row.notes ?? "",
            requestId: await stableRequestId(`${expansionId}|${row.source_system}|${row.verification_id}`),
            actorUserId: await currentUserId(),
            ...(row.moisture_permille === "" || row.moisture_permille === undefined ? {} : { moisturePermille: Number(row.moisture_permille) }),
            sourceSystem: row.source_system ?? "",
            externalId: row.verification_id ?? "",
          });
          return `recorded for ${shortId(supplierLogicalId)}.`;
        } catch (error) {
          if (describe(error).includes("REPLAYED")) return "REPLAYED: already recorded. Nothing changed.";
          throw error;
        }
      },
    };
  });
}

function ImportHistory({ data }: { readonly data: ExpansionData }) {
  return (
    <section className="card" aria-labelledby="ih" style={{ overflow: "hidden" }}>
      <div className="card-h">
        <h3 id="ih">Import batches</h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Kind</th>
              <th className="r">Rows</th>
              <th className="r">Accepted</th>
              <th className="r">Replayed</th>
              <th className="r">Versioned</th>
              <th className="r">Conflicting</th>
              <th className="r">Unmatched</th>
              <th className="r">Revision after</th>
              <th>Imported</th>
            </tr>
          </thead>
          <tbody>
            {[...data.imports].reverse().map((b) => (
              <tr key={b.importBatchId}>
                <td className="mono">{b.fileName}</td>
                <td>{b.fileKind}</td>
                <td className="r num">{String(b.inputRows ?? "")}</td>
                <td className="r num">{String(b.accepted ?? "")}</td>
                <td className="r num">{String(b.replayed ?? "")}</td>
                <td className="r num">{String(b.versioned ?? "")}</td>
                <td className="r num">{String(b.conflicting ?? "")}</td>
                <td className="r num">{String(b.unmatched ?? "")}</td>
                <td className="r num">{String(b.evidenceRevisionAfter ?? "")}</td>
                <td className="mono note">{shortTime(b.importedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FnRow items={["CsImportBatch"]} />
    </section>
  );
}
