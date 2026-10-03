import { briefSubject, FOOD_NAME, priceUnit, type BriefOutput, type CountryView } from "@clearspend/domain";
import { Fragment, useState } from "react";
import { Failed, outputOf, RunBadges, StartAiJob } from "../Ai";
import { client } from "../client";
import { OutcomeText, useCommand } from "../command";
import { loadLatestRun, useLoad } from "../data/portfolio";
import { csReviewSupplierBid, csTagInvestigation } from "../sdk";
import { FnRow, FOOD_VAR, Icon } from "../ui";
import { dollarsText, evidenceLabel, netDollarsText, plot, shareText, shortId, thousands, usdPerKgText } from "../view";

type Ingredient = CountryView["ingredients"][number];
type Supplier = Ingredient["suppliers"][number];

export const food = (commodity: string): string => {
  const name = FOOD_NAME[commodity] ?? commodity.toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};
const ACTIVE = new Set(["OPEN", "SCHEDULED"]);

function statusOf(s: Supplier): { readonly text: string; readonly className: string } {
  if (s.role === "CURRENT") return { text: `current · ${s.batchCount} batches`, className: "chip brand" };
  if (s.role === "BID") return { text: "offer · supplier site", className: "chip quote" };
  if (s.eligibility === "VERIFIED_PASS") return { text: "lead · visit passed", className: "chip ok" };
  if (s.eligibility === "VERIFIED_FAIL") return { text: "lead · visit failed", className: "chip bad" };
  return { text: "lead · quote only", className: "chip quote" };
}

function baselineText(ingredient: Ingredient): string {
  const b = ingredient.baseline;
  const unit = priceUnit(ingredient.commodity);
  if (b === null) return "no price to compare with";
  if (b.kind === "PAID") return `what we pay ${shortId(b.supplierLogicalId ?? "")} now, ${usdPerKgText(b.centsPerUnit)} $/${unit}`;
  if (b.kind === "IMPORT") return `importing, ${usdPerKgText(b.centsPerUnit)} $/${unit} (WFP import median)`;
  return `the local market, ${usdPerKgText(b.centsPerUnit)} $/${unit} (WFP retail median)`;
}

const netTone = (exact: string | null): string | undefined => {
  const value = plot(exact);
  return value === null || value === 0 ? undefined : value < 0 ? "var(--ok)" : "var(--bad)";
};

/**
 * P8 (Roshan, 2026-10-01): the suppliers of 1 food, front and center. Each row: what it could reasonably supply a
 * month and what that costs against the price we compare with. Every number comes from csCountry.
 */
export function SupplierList(props: {
  readonly view: CountryView;
  readonly ingredient: Ingredient;
  readonly reload: () => void;
  /** The supplier (or "MARKET") whose investigation form is open, when the page controls it. */
  readonly tagging?: string | null;
  readonly onTagging?: (subject: string | null) => void;
  /** P20: which suppliers to show: all, local only, or international only. */
  readonly route?: "ALL" | "LOCAL" | "IMPORT";
}) {
  const { view, ingredient, reload } = props;
  const [own, setOwn] = useState<string | null>(null);
  const tagging = props.tagging === undefined ? own : props.tagging;
  const setTagging = props.onTagging ?? setOwn;
  const unit = ingredient.commodity === "OIL" ? "L" : "kg";
  const plan = ingredient.sourcing;
  const investigationOf = (subjectType: string, subjectId: string) => view.investigations.find((i) => ACTIVE.has(i.status) && i.subjectType === subjectType && i.subjectId === subjectId) ?? null;
  const market = investigationOf("MARKET", ingredient.commodity);
  const allocations = plan.allocations.map((a) => `${shortId(a.supplierLogicalId)} ${thousands(a.volume)} ${unit}`).join(" · ");
  const { comparison } = ingredient;
  const per = priceUnit(ingredient.commodity);
  const international = comparison.international;
  const compared = comparison.compared;
  // When the compared price is the international one (importing, or what we pay an import supplier), 1 box says it.
  const sameAsCompared = international !== null && international.isCompared;
  const route = props.route ?? "ALL";
  const groups = [
    { key: "LOCAL", title: "Local", rows: ingredient.suppliers.filter((s) => s.route === "LOCAL") },
    { key: "IMPORT", title: "International (import)", rows: ingredient.suppliers.filter((s) => s.route !== "LOCAL") },
  ];
  return (
    <section className="card" aria-label={`${food(ingredient.commodity)} suppliers`} style={{ overflow: "hidden" }}>
      <div style={{ height: 4, background: FOOD_VAR[ingredient.commodity] ?? "var(--brand-2)" }} />
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${sameAsCompared ? 2 : 3},minmax(0,1fr))`, gap: 12 }}>
          <Compare
            title={compared === null ? "Compared with" : compared.kind === "PAID" ? "We pay now" : compared.kind === "IMPORT" ? "Importing everything" : "Local retail price"}
            tone="var(--line-strong)"
            headline={compared === null ? "no price on record" : `${usdPerKgText(compared.centsPerUnit)} $/${per}`}
            lines={
              compared === null
                ? ["no paid price and no WFP series"]
                : [
                    compared.kind === "PAID" ? `to ${shortId(compared.supplierLogicalId ?? "")}` : compared.kind === "IMPORT" ? "WFP import price · no supplier yet" : "WFP retail median",
                    `${dollarsText(compared.cost)} a month for the whole need`,
                    "every net cost below compares with this",
                  ]
            }
          />
          <Compare
            title="Local"
            tone="var(--ok)"
            headline={comparison.local.bestPrice === null ? "no offer yet" : `from ${usdPerKgText(comparison.local.bestPrice)} $/${per}`}
            lines={[
              `${comparison.local.count} candidate${comparison.local.count === 1 ? "" : "s"}: leads and offers`,
              comparison.local.plannedVolume === 0 ? "nothing planned yet" : `cheapest first: ${thousands(comparison.local.plannedVolume)} ${unit} a month`,
            ]}
            net={comparison.local.plannedVolume === 0 ? null : comparison.local.net}
          />
          {sameAsCompared ? null : (
          <Compare
            title="International"
            tone="var(--market)"
            headline={international === null ? "no price on record" : `${international.basis === "QUOTE" ? "from " : ""}${usdPerKgText(international.price)} $/${per}`}
            lines={
              international === null
                ? ["no import supplier and no WFP import series"]
                : [
                    international.basis === "PAID"
                      ? `paid to ${shortId(international.supplierLogicalId ?? "")} now`
                      : international.basis === "QUOTE"
                        ? `${international.count} international supplier${international.count === 1 ? "" : "s"} quoting`
                        : "WFP import price · no international supplier yet",
                    international.plannedVolume > 0 ? `cheapest first: ${thousands(international.plannedVolume)} ${unit} a month` : "nothing planned yet",
                  ]
            }
            net={international === null || international.plannedVolume === 0 ? null : international.plannedNet}
          />
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Status</th>
                <th className="r">Price</th>
                <th className="r">A month</th>
                <th className="r" title={`Compared with ${baselineText(ingredient)}`}>
                  Net cost a month
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.filter((group) => route === "ALL" || group.key === route).map((group) => (
                <Fragment key={group.key}>
                  <tr style={{ background: "var(--soft)" }}>
                    <td colSpan={6} className="note" style={{ fontWeight: 650, color: "var(--ink2)" }}>
                      {group.title} · {group.rows.length}
                    </td>
                  </tr>
                  {group.key === "IMPORT" && group.rows.length === 0 ? (
                    <tr>
                      <td>
                        <b>WFP import price</b> <span className="note">a price reference, not a supplier</span>
                      </td>
                      <td>
                        <span className="chip">no international supplier yet</span>
                      </td>
                      <td className="r mono" style={{ whiteSpace: "nowrap" }}>
                        {international === null ? "—" : `${usdPerKgText(international.price)} $/${per}`}
                      </td>
                      <td className="r mono note">no local limit</td>
                      <td className="r mono note" style={international !== null && !international.isCompared ? { color: netTone(international.net), fontWeight: 650 } : undefined}>
                        {international === null ? "" : international.isCompared ? "the compared price" : `${netDollarsText(international.net)} for the whole need`}
                      </td>
                      <td />
                    </tr>
                  ) : null}
                  {group.key === "LOCAL" && group.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="note">
                        No local supplier or offer yet. A market survey finds local sellers and their prices.
                      </td>
                    </tr>
                  ) : null}
                  {group.rows.map((s) => {
                const status = statusOf(s);
                const investigation = investigationOf("SUPPLIER", s.supplierLogicalId);
                const capacity = s.confirmedCapacityPerMonth ?? s.claimedCapacityPerMonth;
                const capped = s.reasonableVolume !== null && capacity !== null && s.reasonableVolume < capacity;
                return (
                  <Fragment key={s.supplierLogicalId}>
                    <tr id={`row-${s.supplierLogicalId}`}>
                      <td>
                        <b>{s.role === "BID" ? s.name : shortId(s.supplierLogicalId)}</b>{" "}
                        <span className="note">{s.role === "BID" ? s.bid?.deliveryArea : s.name.replace(" (fictional)", "").replace(" (fictif)", "")}</span>
                      </td>
                      <td>
                        <span className={status.className}>{status.text}</span>
                      </td>
                      <td className="r mono" style={{ whiteSpace: "nowrap" }}>
                        {s.price === null ? "—" : `${usdPerKgText(s.price)} $/${priceUnit(ingredient.commodity)}`}
                        <div className="note">{s.role === "CURRENT" ? "paid" : "offered"}</div>
                      </td>
                      <td className="r mono" style={{ whiteSpace: "nowrap" }}>
                        {s.usedPerMonth !== null ? (
                          <>
                            {thousands(s.usedPerMonth)} {unit}
                            <div className="note" style={{ color: "var(--brand)" }}>
                              we buy now · {capacity === null ? "capacity not stated" : `of ${thousands(capacity)} ${s.confirmedCapacityPerMonth !== null ? "confirmed" : "claimed"}`}
                            </div>
                          </>
                        ) : (
                          <>
                        {s.reasonableVolume === null ? "unknown" : `${thousands(s.reasonableVolume)} ${unit}`}
                        <div className="note">
                          {capacity === null
                            ? "capacity not stated"
                            : capped
                              ? `of ${thousands(capacity)} ${s.confirmedCapacityPerMonth !== null ? "confirmed" : "claimed"}`
                              : s.confirmedCapacityPerMonth !== null
                                ? "confirmed on a visit"
                                : "claimed"}
                        </div>
                          </>
                        )}
                      </td>
                      <td className="r mono" style={{ whiteSpace: "nowrap", fontWeight: 650, color: netTone(s.netPerMonth) }}>
                        {netDollarsText(s.netPerMonth)}
                        <div className="note" style={{ fontWeight: 400 }}>
                          {plot(s.netPerMonth) === null ? "" : (plot(s.netPerMonth) ?? 0) < 0 ? "saved" : (plot(s.netPerMonth) ?? 0) > 0 ? "more" : ""}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {investigation !== null ? (
                          <span className={investigation.status === "SCHEDULED" ? "chip ok" : "chip brand"}>{investigation.status === "SCHEDULED" ? `on the ground ${investigation.onGroundStart}` : "tagged · to book"}</span>
                        ) : tagging === s.supplierLogicalId ? null : (
                          <button className="btn sm" type="button" onClick={() => setTagging(s.supplierLogicalId)}>
                            <Icon name="search" size={13} /> Investigate
                          </button>
                        )}
                      </td>
                    </tr>
                    {tagging === s.supplierLogicalId ? (
                      <tr>
                        <td colSpan={6}>
                          <VisitBrief expansionId={view.country.expansionId} commodity={ingredient.commodity} supplierLogicalId={s.supplierLogicalId} evidenceRevision={view.evidenceRevision} />
                          <TagForm
                            countryIso3={view.country.iso3}
                            subjectType="SUPPLIER"
                            subjectId={s.supplierLogicalId}
                            commodity={ingredient.commodity}
                            defaultReason={`Check ${s.role === "BID" ? s.name : shortId(s.supplierLogicalId)}: ${s.price === null ? "" : `${usdPerKgText(s.price)} $/${priceUnit(ingredient.commodity)}, `}${s.reasonableVolume === null ? "capacity unknown" : `${thousands(s.reasonableVolume)} ${unit} a month`}.`}
                            onDone={() => {
                              setTagging(null);
                              reload();
                            }}
                            onCancel={() => setTagging(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 13.5 }}>
          <span>
            <b>Cheapest-first plan:</b> local {plan.localTotal === 0 ? "nothing yet" : `${thousands(plan.localTotal)} ${unit} (${allocations})`}; international{" "}
            {plan.importAllocations.length === 0 ? "no offer yet" : `${thousands(plan.importAllocations.reduce((t, a) => t + a.volume, 0))} ${unit} (${plan.importAllocations.map((a) => `${shortId(a.supplierLogicalId)} ${thousands(a.volume)}`).join(" · ")})`}
            {plan.uncoveredPerMonth > 0 ? `; ${thousands(plan.uncoveredPerMonth)} ${unit} not covered by any offer, at the compared price` : ""}
            {plan.netTotalPerMonth === null ? null : (
              <>
                {" · "}
                <b style={{ color: netTone(plan.netTotalPerMonth) }}>{netDollarsText(plan.netTotalPerMonth)} a month</b>
              </>
            )}
          </span>
          <span style={{ marginLeft: "auto" }}>
            {market !== null ? (
              <span className={market.status === "SCHEDULED" ? "chip ok" : "chip brand"}>Market survey {market.status === "SCHEDULED" ? `on the ground ${market.onGroundStart}` : "tagged · to book"}</span>
            ) : tagging === "MARKET" ? null : (
              <button className="btn sm" type="button" onClick={() => setTagging("MARKET")}>
                <Icon name="search" size={13} /> Survey the market
              </button>
            )}
          </span>
        </div>
        {tagging === "MARKET" ? (
          <TagForm
            countryIso3={view.country.iso3}
            subjectType="MARKET"
            subjectId={ingredient.commodity}
            commodity={ingredient.commodity}
            defaultReason={`Find local sellers of ${food(ingredient.commodity).toLowerCase()} and their prices.`}
            onDone={() => {
              setTagging(null);
              reload();
            }}
            onCancel={() => setTagging(null)}
          />
        ) : null}
<p className="note" style={{ margin: 0 }}>
          A local supplier is capped at 10% of the local market, so our buying does not push prices up. A quote or offer is a promise until a visit checks it.
        </p>
      </div>
      <FnRow items={["csCountry → reasonableVolume, netPerMonth, localSourcingPlan", "CsCostLine", "CsSupplierBid (accepted)", "CsFieldVerification"]} />
    </section>
  );
}

/**
 * P16: the brief for 1 field visit, written by AI from what code cannot read: the supplier's own profile or offer
 * note. It quotes what they claim, lists what is missing, and names what the investigator must confirm. Code chose
 * the supplier (the biggest saving not yet verified); a person tags the visit. The brief changes nothing.
 */
export function VisitBrief(props: { readonly expansionId: string; readonly commodity: string; readonly supplierLogicalId: string; readonly evidenceRevision: number | null }) {
  const subject = briefSubject(props.commodity, props.supplierLogicalId);
  const { state, reload } = useLoad(() => loadLatestRun(props.expansionId, "BRIEF", subject), `brief:${props.expansionId}:${subject}`);
  const run = state.kind === "ready" ? state.data : null;
  const brief = run === null ? null : outputOf<BriefOutput>(run);
  return (
    <div className="brief">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <b>Visit brief</b>
        <span className="chip ai">
          <Icon name="spark" size={11} /> AI · reads the supplier's own text
        </span>
        {run !== null && props.evidenceRevision !== null ? <RunBadges run={run} evidenceRevision={props.evidenceRevision} /> : null}
        <span style={{ marginLeft: "auto" }}>
          <StartAiJob expansionId={props.expansionId} job="BRIEF" subjectId={subject} label={run === null ? "Write the visit brief" : "Write it again"} onChanged={reload} />
        </span>
      </div>
      {state.kind === "loading" ? <p className="loading">Loading…</p> : null}
      {state.kind === "error" ? (
        <div className="error-box" role="alert">
          {state.message}
        </div>
      ) : null}
      {state.kind === "ready" && run === null ? (
        <p className="note" style={{ margin: 0 }}>
          The numbers above say this supplier is worth a visit. AI reads its profile or offer note and lists what it claims, what is missing, and what the investigator must confirm. Optional.
        </p>
      ) : null}
      {run !== null && brief === null ? <Failed run={run} /> : null}
      {brief === null ? null : (
        <>
          <p style={{ margin: 0, fontSize: 14 }}>{brief.summary}</p>
          <div className="brief-cols">
            <div>
              <div className="brief-h">They claim</div>
              {brief.claims.length === 0 ? <div className="note">Nothing in their own words is on record.</div> : null}
              <ul>
                {brief.claims.map((c) => (
                  <li key={c.span}>
                    {c.claim} <span className="note">“{c.span}”</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="brief-h">Missing or doubtful</div>
              <ul>
                {brief.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="brief-h">Confirm on the visit</div>
              <ol>
                {brief.checks.map((c) => (
                  <li key={c.check}>
                    {c.check} <span className="note">{c.why}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Tags a supplier or a market for an investigation. It changes no number; booking an investigator is next. */
export function TagForm(props: {
  readonly countryIso3: string;
  readonly subjectType: "SUPPLIER" | "MARKET";
  readonly subjectId: string;
  readonly commodity: string;
  readonly defaultReason: string;
  readonly onDone: () => void;
  readonly onCancel?: () => void;
}) {
  const { outcome, run, sending } = useCommand(props.onDone);
  const [reason, setReason] = useState(props.defaultReason);
  return (
    <form
      className="confirm"
      style={{ marginTop: 12, maxWidth: 640 }}
      onSubmit={(event) => {
        event.preventDefault();
        void run(
          ({ requestId, actorUserId }) =>
            client(csTagInvestigation).applyAction({ countryIso3: props.countryIso3, subjectType: props.subjectType, subjectId: props.subjectId, commodity: props.commodity, reason, requestId, actorUserId }),
          "Tagged. Book an investigator on the Investigations page.",
        );
      }}
    >
      <fieldset disabled={sending}>
        <label htmlFor={`reason-${props.subjectId}`}>{props.subjectType === "SUPPLIER" ? `Audit ${shortId(props.subjectId)}` : `Survey the ${food(props.commodity).toLowerCase()} market`} · reason</label>
        <textarea id={`reason-${props.subjectId}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="buttons">
          <button type="submit" disabled={reason.trim() === ""}>
            {sending ? "Tagging…" : "Tag for investigation"}
          </button>
          {props.onCancel === undefined ? null : (
            <button type="button" className="btn sm" onClick={props.onCancel}>
              Cancel
            </button>
          )}
        </div>
      </fieldset>
      <OutcomeText outcome={outcome} />
    </form>
  );
}

/**
 * P10: offers from the supplier site that wait for a person. Accepting one makes it an unverified lead in the supplier
 * list and the plan; it never changes a paid cost. The supplier never sees any of these figures.
 */
export function OffersToReview({ view, reload }: { readonly view: CountryView; readonly reload: () => void }) {
  if (view.bidsToReview.length === 0) return null;
  return (
    <section className="card" aria-label="Offers to review" style={{ overflow: "hidden", borderColor: "var(--warn-line)" }}>
      <div className="card-h">
        <h3>Offers to review</h3>
        <span className="chip warn">{view.bidsToReview.length} from the supplier site</span>
      </div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {view.bidsToReview.map((bid) => (
          <OfferRow key={bid.bidId} bid={bid} reload={reload} />
        ))}
      </div>
      <FnRow items={["CsSupplierBid (SUBMITTED)", "csCountry → bidsToReview", "cs-review-supplier-bid"]} />
    </section>
  );
}

function OfferRow({ bid, reload }: { readonly bid: CountryView["bidsToReview"][number]; readonly reload: () => void }) {
  const { outcome, run, sending } = useCommand(reload);
  const [note, setNote] = useState("");
  const unit = bid.commodity === "OIL" ? "L" : "kg";
  const review = (decision: "ACCEPTED" | "REJECTED") =>
    void run(
      ({ requestId, actorUserId }) => client(csReviewSupplierBid).applyAction({ bidId: bid.bidId, decision, reviewNote: note, requestId, actorUserId }),
      decision === "ACCEPTED" ? "Accepted: it is now a lead in the supplier list." : "Rejected.",
    );
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(260px,340px)", gap: 16 }}>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <b style={{ fontSize: 15 }}>{bid.businessName}</b>
          <span className="chip">{food(bid.commodity)}</span>
          <span className="note">
            {bid.deliveryArea} · from {bid.earliestStart} · {bid.contact}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 14 }}>
          {usdPerKgText(bid.preview?.price ?? `${bid.priceCentsPer1000}/1000`)} $/{priceUnit(bid.commodity)} · {thousands(bid.quantityPerMonth)} {unit} a month
          {bid.preview === null ? null : (
            <span className="note" style={{ marginLeft: 10 }}>
              {bid.preview.vsMarket === null ? "" : `${shareText(bid.preview.vsMarket)} vs local market · `}
              could supply {bid.preview.reasonableVolume === null ? "unknown" : `${thousands(bid.preview.reasonableVolume)} ${unit}`} · net{" "}
              <b style={{ color: netTone(bid.preview.netPerMonth) }}>{netDollarsText(bid.preview.netPerMonth)}</b> a month
            </span>
          )}
        </div>
        {bid.preview === null ? <span className="note">This food is not on the program's menu.</span> : null}
        {bid.note === null ? null : <div className="note">“{bid.note}”</div>}
      </div>
      <form className="confirm" style={{ margin: 0 }} onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled={sending}>
          <label htmlFor={`review-${bid.bidId}`}>Your reason</label>
          <textarea id={`review-${bid.bidId}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="buttons">
            <button type="button" disabled={note.trim() === ""} onClick={() => review("ACCEPTED")}>
              Accept as lead
            </button>
            <button type="button" className="btn sm" disabled={note.trim() === ""} onClick={() => review("REJECTED")}>
              Reject
            </button>
          </div>
        </fieldset>
        <OutcomeText outcome={outcome} />
      </form>
    </div>
  );
}

function Compare({ title, tone, headline, lines, net }: { readonly title: string; readonly tone: string; readonly headline: string; readonly lines: readonly string[]; readonly net?: string | null }) {
  const value = plot(net ?? null);
  return (
    <div style={{ background: "var(--soft)", borderRadius: 12, padding: "12px 14px", borderTop: `3px solid ${tone}` }}>
      <div className="note" style={{ fontWeight: 600 }}>
        {title}
      </div>
      <div className="mono" style={{ fontSize: 19, fontWeight: 700, margin: "2px 0 4px" }}>
        {headline}
      </div>
      {lines.map((line) => (
        <div key={line} className="note">
          {line}
        </div>
      ))}
      {net === undefined || net === null || value === null ? null : (
        <div style={{ marginTop: 6, fontWeight: 700, color: netTone(net) }}>{value === 0 ? "the same cost" : `${value < 0 ? "saves" : "costs"} ${netDollarsText(net).slice(1)} a month${value > 0 ? " more" : ""}`}</div>
      )}
    </div>
  );
}
