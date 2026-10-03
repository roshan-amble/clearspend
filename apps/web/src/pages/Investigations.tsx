import { dayNumber, FOOD_NAME, type BookingOutput } from "@clearspend/domain";
import type { Osdk } from "@osdk/client";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Failed, outputOf, StartAiJob } from "../Ai";
import { client } from "../client";
import { OutcomeText, useCommand } from "../command";
import { loadInvestigations, loadLatestRun, loadSchedule, useLoad, type InvestigationsData, type TripOptionJson } from "../data/portfolio";
import { VisitBrief } from "./Suppliers";
import { csBookInvestigation, type CsInvestigation } from "../sdk";
import { FnRow, Icon, Section } from "../ui";
import { evidenceLabel, shortId, shortTime } from "../view";

const food = (commodity: string): string => {
  const name = FOOD_NAME[commodity] ?? commodity.toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};
const LANES = [
  { status: "OPEN", title: "To book", tone: "var(--warn)" },
  { status: "SCHEDULED", title: "Scheduled", tone: "var(--ok)" },
  { status: "DONE", title: "Done", tone: "var(--market)" },
] as const;

/** P17, page 5: 1 country's tagged investigations and their scheduling. */
export function Investigations({ countryIso3, onChanged }: { readonly countryIso3: string; readonly onChanged: () => void }) {
  const { state, reload: reloadOwn } = useLoad(loadInvestigations, "investigations");
  // A booking changes the country's stage and tabs too.
  const reload = () => {
    reloadOwn();
    onChanged();
  };
  if (state.kind === "loading") return <p className="loading" role="status">Loading investigations from Foundry…</p>;
  if (state.kind === "error")
    return (
      <div className="error-box" role="alert">
        <b>Could not load the investigations.</b> {state.message}
      </div>
    );
  return <Screen data={{ ...state.data, investigations: state.data.investigations.filter((i) => i.countryIso3 === countryIso3) }} reload={reload} />;
}

function Screen({ data, reload }: { readonly data: InvestigationsData; readonly reload: () => void }) {
  const [params, setParams] = useSearchParams();
  const countries = new Map(data.portfolio.countries.map((c) => [c.country.iso3, c.country] as const));
  const selectedId = params.get("select") ?? data.investigations.find((i) => i.status === "OPEN")?.investigationId ?? data.investigations[0]?.investigationId ?? null;
  const selected = data.investigations.find((i) => i.investigationId === selectedId);
  const select = (id: string) => setParams({ select: id });
  return (
    <>
      <Section title="Investigations" sub={`${data.investigations.length} tagged · book an investigator, then the visit decides`}>
        {data.investigations.length === 0 ? (
          <div className="empty">
            No investigations yet. Tag one with Investigate on the <Link to="../suppliers">Suppliers</Link> page.
          </div>
        ) : (
          <section className="card" aria-label="Investigations by status">
            <div className="card-b kanban" style={{ paddingTop: 20, gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
              {LANES.map((lane) => {
                const items = data.investigations.filter((i) => i.status === lane.status);
                return (
                  <div key={lane.status} className="lane">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px" }}>
                      <span className="dot" style={{ background: lane.tone }} />
                      <b style={{ fontSize: 13.5 }}>{lane.title}</b>
                      <span className="chip" style={{ marginLeft: "auto", background: "var(--surface)" }}>
                        {items.length}
                      </span>
                    </div>
                    {items.map((i) => {
                      const c = countries.get(i.countryIso3 ?? "");
                      const investigator = data.investigators.find((p) => p.investigatorId === i.investigatorId);
                      return (
                        <button key={i.investigationId} type="button" className="lane-card" aria-pressed={i.investigationId === selectedId} onClick={() => select(i.investigationId ?? "")}>
                          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span aria-hidden="true">{c?.flag}</span>
                            <b>{i.subjectType === "SUPPLIER" ? `Audit ${shortId(i.subjectId ?? "")}` : `${food(i.commodity ?? "")} market survey`}</b>
                          </span>
                          <span className="note">
                            {c?.name} · {food(i.commodity ?? "")} · {String(i.durationDays)} days
                          </span>
                          {i.status === "SCHEDULED" ? (
                            <span className="note" style={{ color: "var(--ok)" }}>
                              {investigator?.name} · on the ground {i.onGroundStart}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <FnRow items={["CsInvestigation", "csTagInvestigation"]} />
          </section>
        )}
      </Section>

      {selected === undefined ? null : <Detail key={selected.investigationId} data={data} investigation={selected} reload={reload} />}
    </>
  );
}

function Detail({ data, investigation, reload }: { readonly data: InvestigationsData; readonly investigation: Osdk.Instance<CsInvestigation>; readonly reload: () => void }) {
  const country = data.portfolio.countries.find((c) => c.country.iso3 === investigation.countryIso3)?.country;
  const open = investigation.status === "OPEN";
  const schedule = useLoad(() => (open ? loadSchedule(investigation.investigationId ?? "") : Promise.resolve(null)), `${investigation.investigationId}:${open}`);
  const [preview, setPreview] = useState<TripOptionJson | null>(null);
  const booked = data.investigators.find((p) => p.investigatorId === investigation.investigatorId);
  const options = schedule.state.kind === "ready" ? (schedule.state.data?.options ?? []) : [];
  const title = investigation.subjectType === "SUPPLIER" ? `Audit ${shortId(investigation.subjectId ?? "")}` : `${food(investigation.commodity ?? "")} market survey`;
  // The calendar shows the people who could go: the options, and the booked person.
  const people = data.investigators.filter((p) => options.some((o) => o.investigatorId === p.investigatorId) || p.investigatorId === investigation.investigatorId || (options.length === 0 && p.hub === country?.hub));
  const advice = useLoad(() => (open ? loadLatestRun(investigation.expansionId ?? "", "BOOKING", investigation.investigationId ?? "") : Promise.resolve(null)), `advice:${investigation.investigationId}:${open}`);
  const adviceRun = advice.state.kind === "ready" ? advice.state.data : null;
  const pick = outputOf<BookingOutput>(adviceRun ?? undefined)?.investigatorId ?? null;
  return (
    <>
      <Section
        title={`${country?.flag ?? ""} ${title}`}
        sub={`${country?.name ?? investigation.countryIso3} · ${food(investigation.commodity ?? "")} · ${String(investigation.durationDays)} days on the ground`}
        actions={
          <Link className="btn sm" to={`../suppliers?food=${investigation.commodity}`}>
            {food(investigation.commodity ?? "")} suppliers →
          </Link>
        }
      >
        <div className="grid g21">
          <section className="card" aria-label="Trip options" style={{ overflow: "hidden", alignSelf: "start" }}>
            <div className="card-h">
              <h3>{open ? "Earliest trips" : "Booking"}</h3>
              {open ? <span className="sub">Local investigators travel 0 days; fly-ins 1 day within the hub, 2 from another hub, each way</span> : null}
            </div>
            {open ? (
              schedule.state.kind === "loading" ? (
                <p className="loading">Finding free calendars…</p>
              ) : schedule.state.kind === "error" ? (
                <div className="error-box" role="alert" style={{ margin: 18 }}>
                  {schedule.state.message}
                </div>
              ) : options.length === 0 ? (
                <div className="empty" style={{ margin: 18 }}>
                  No one with the skill is free in the next 120 days.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Investigator</th>
                        <th>From</th>
                        <th className="r">Travel</th>
                        <th>Leaves</th>
                        <th>On the ground</th>
                        <th>Back</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {options.map((o, index) => (
                        <tr
                          key={o.investigatorId}
                          onMouseEnter={() => setPreview(o)}
                          onMouseLeave={() => setPreview(null)}
                          style={o.investigatorId === pick ? { background: "var(--ai-soft)" } : index === 0 ? { background: "var(--ok-soft)" } : undefined}
                        >
                          <td style={{ fontWeight: 650 }}>
                            {o.name}
                            {index === 0 ? <span className="chip ok" style={{ marginLeft: 6 }}>earliest</span> : null}
                            {o.investigatorId === pick ? (
                              <span className="chip ai" style={{ marginLeft: 6 }}>
                                <Icon name="spark" size={11} /> AI pick
                              </span>
                            ) : null}
                          </td>
                          <td>
                            <span className={o.mode === "LOCAL" ? "chip ok" : "chip brand"}>{o.mode === "LOCAL" ? "Local" : "Fly-in"}</span> <span className="note">{o.baseCity}</span>
                          </td>
                          <td className="r mono">{o.travelDays === 0 ? "—" : `${o.travelDays} d`}</td>
                          <td className="mono">{o.departure}</td>
                          <td className="mono" style={{ fontWeight: 650 }}>
                            {o.onGroundStart} → {o.onGroundEnd}
                          </td>
                          <td className="mono">{o.returnDate}</td>
                          <td>
                            <BookButton investigation={investigation} option={o} onDone={reload} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="card-b">
                <dl className="kv">
                  <dt>Investigator</dt>
                  <dd>
                    {booked?.name} · {booked?.kind === "LOCAL" ? "local" : `flies in from ${booked?.baseCity}`}
                  </dd>
                  <dt>On the ground</dt>
                  <dd>
                    {investigation.onGroundStart} → {investigation.onGroundEnd}
                  </dd>
                  <dt>Travel each way</dt>
                  <dd>{String(investigation.travelDays ?? 0)} days</dd>
                  <dt>Booked</dt>
                  <dd>{investigation.bookedAt?.slice(0, 16).replace("T", " ")}</dd>
                </dl>
              </div>
            )}
            <FnRow items={["csScheduleOptions → scheduleOptions", "csBookInvestigation → checkBooking", "CsInvestigatorBusy"]} />
          </section>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, alignSelf: "start", minWidth: 0 }}>
          {open ? (
            <BookingAdvice
              investigation={investigation}
              run={adviceRun}
              loading={advice.state.kind === "loading"}
              options={options}
              onChanged={advice.reload}
            />
          ) : null}
          <section className="card" aria-label="Reason">
            <div className="card-h">
              <h3>Reason</h3>
              <span className={open ? "chip warn" : "chip ok"} style={{ marginLeft: "auto" }}>
                {(investigation.status ?? "").toLowerCase()}
              </span>
            </div>
            <div className="card-b">
              <p style={{ margin: 0, lineHeight: 1.6 }}>{investigation.reason}</p>
              <p className="note" style={{ marginTop: 10 }}>
                Tagged {investigation.createdAt?.slice(0, 10)} · needs {(investigation.requiredSkill ?? "").replace("_", " ").toLowerCase()}
              </p>
            </div>
          </section>
          </div>
        </div>
      </Section>

      {investigation.subjectType === "SUPPLIER" ? (
        <Section title="Visit brief" sub="What the investigator checks on the ground">
          <section className="card" aria-label="Visit brief">
            <div className="card-b" style={{ paddingTop: 4 }}>
              <VisitBrief
                expansionId={investigation.expansionId ?? ""}
                commodity={investigation.commodity ?? ""}
                supplierLogicalId={investigation.subjectId ?? ""}
                evidenceRevision={data.portfolio.countries.find((c) => c.country.iso3 === investigation.countryIso3)?.evidenceRevision ?? null}
              />
            </div>
          </section>
        </Section>
      ) : null}

      <Section title="Investigator calendars" sub="Next 8 weeks · hover a trip option to see where it falls">
        <Calendar data={data} people={people} preview={preview} />
      </Section>
    </>
  );
}

/**
 * P8: AI recommends who to book among the free trips that code found. A person books. The calendars can change after
 * the run, so a pick that is no longer free says so.
 */
function BookingAdvice(props: {
  readonly investigation: Osdk.Instance<CsInvestigation>;
  readonly run: Awaited<ReturnType<typeof loadLatestRun>>;
  readonly loading: boolean;
  readonly options: readonly TripOptionJson[];
  readonly onChanged: () => void;
}) {
  const value = outputOf<BookingOutput>(props.run ?? undefined);
  const still = value === null ? null : props.options.find((o) => o.investigatorId === value.investigatorId) ?? null;
  return (
    <section className="card" aria-label="AI booking recommendation" style={{ borderColor: "var(--ai-line)" }}>
      <div className="card-h">
        <h3>Who to book</h3>
        <span className="chip ai">
          <Icon name="spark" size={11} /> AI
        </span>
      </div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {props.loading ? <p className="loading">Loading…</p> : null}
        {!props.loading && props.run === null ? <p className="note" style={{ margin: 0 }}>AI weighs the free trips: how soon, local or fly-in, languages, past visits, workload. You book.</p> : null}
        {props.run !== null && value === null ? <Failed run={props.run} /> : null}
        {value !== null ? (
          <>
            <div style={{ background: "var(--ai-soft)", borderRadius: 12, padding: 12 }}>
              <div className="note">Recommended · {shortTime(props.run?.startedAt)}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ai)" }}>{still?.name ?? value.investigatorId}</div>
              {still === null ? (
                <div className="note" style={{ color: "var(--warn)" }}>
                  No longer has a free trip: the calendars changed. Ask again.
                </div>
              ) : (
                <div className="note">
                  On the ground {still.onGroundStart} → {still.onGroundEnd}
                </div>
              )}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
              {value.reasons.map((reason) => (
                <li key={reason.text}>
                  {reason.text}{" "}
                  {reason.evidenceIds.map((id) => (
                    <span key={id} className="chip mono" style={{ fontSize: 11 }}>
                      {id.startsWith("investigation:") ? "the request" : evidenceLabel(id)}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            {value.tradeOffs.length === 0 ? null : (
              <div className="note">
                <b style={{ color: "var(--ink)" }}>Trade-offs:</b> {value.tradeOffs.join(" ")}
              </div>
            )}
          </>
        ) : null}
        <StartAiJob expansionId={props.investigation.expansionId ?? ""} job="BOOKING" subjectId={props.investigation.investigationId ?? ""} label={props.run === null ? "Recommend who to book" : "Ask again"} onChanged={props.onChanged} />
      </div>
      <FnRow items={["cs-start-ai-job · BOOKING → csStartAiJob", "scheduleOptions → tripsForAi", "validateBookingOutput", "CsAiRun"]} />
    </section>
  );
}

function BookButton({ investigation, option, onDone }: { readonly investigation: Osdk.Instance<CsInvestigation>; readonly option: TripOptionJson; readonly onDone: () => void }) {
  const { outcome, run, sending } = useCommand(onDone);
  return (
    <div>
      <button
        className="btn sm primary"
        type="button"
        disabled={sending}
        onClick={() =>
          void run(
            ({ requestId, actorUserId }) =>
              client(csBookInvestigation).applyAction({
                investigationId: investigation.investigationId ?? "",
                investigatorId: option.investigatorId,
                onGroundStart: option.onGroundStart,
                expectedScheduleVersion: option.scheduleVersion,
                requestId,
                actorUserId,
              }),
            `Booked ${option.name}.`,
          )
        }
      >
        <Icon name="check" size={13} /> {sending ? "Booking…" : "Book"}
      </button>
      <OutcomeText outcome={outcome} />
    </div>
  );
}

const DAYS = 56;
function Calendar({ data, people, preview }: { readonly data: InvestigationsData; readonly people: InvestigationsData["investigators"]; readonly preview: TripOptionJson | null }) {
  const today = new Date().toISOString().slice(0, 10);
  const start = dayNumber(today);
  const span = (from: string, to: string) => {
    const a = Math.max(dayNumber(from) - start, 0);
    const b = Math.min(dayNumber(to) - start + 1, DAYS);
    return b <= 0 || a >= DAYS ? null : { left: `${(a / DAYS) * 100}%`, width: `${((b - a) / DAYS) * 100}%` };
  };
  const weeks = Array.from({ length: DAYS / 7 }, (_, w) => new Date((start + w * 7) * 86_400_000).toISOString().slice(5, 10));
  return (
    <section className="card" aria-label="Investigator calendars">
      <div className="card-b gantt" style={{ paddingTop: 18 }}>
        <div className="gantt-row">
          <span />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks.length},1fr)` }} className="note mono">
            {weeks.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </div>
        {people.length === 0 ? <div className="empty">No investigators to show.</div> : null}
        {people.map((p) => (
          <div key={p.investigatorId} className="gantt-row">
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <b>{p.name}</b> <span className="note">{p.kind === "LOCAL" ? p.baseCity : `${p.baseCity} hub`}</span>
            </span>
            <div className="gantt-track">
              {data.busy
                .filter((b) => b.investigatorId === p.investigatorId)
                .map((b) => {
                  const pos = span(b.startDate ?? today, b.endDate ?? today);
                  if (pos === null) return null;
                  const booking = (b.investigationId ?? "") !== "";
                  return <i key={b.busyId} title={`${b.reason} · ${b.startDate} → ${b.endDate}`} style={{ ...pos, background: booking ? "var(--brand-2)" : "var(--market-2)" }} />;
                })}
              {preview !== null && preview.investigatorId === p.investigatorId
                ? (() => {
                    const pos = span(preview.departure, preview.returnDate);
                    return pos === null ? null : <i style={{ ...pos, background: "var(--ok)", opacity: 0.85, outline: "2px solid var(--ok)" }} title="This trip option" />;
                  })()
                : null}
            </div>
          </div>
        ))}
        <div className="legend">
          <span>
            <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 3, background: "var(--market-2)" }} /> Busy: leave or another program
          </span>
          <span>
            <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 3, background: "var(--brand-2)" }} /> Booked investigation
          </span>
          <span>
            <span style={{ display: "inline-block", width: 14, height: 8, borderRadius: 3, background: "var(--ok)" }} /> Trip option under the pointer
          </span>
        </div>
      </div>
      <FnRow items={["CsInvestigator", "CsInvestigatorBusy"]} />
    </section>
  );
}
