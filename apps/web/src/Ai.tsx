import type { Osdk } from "@osdk/client";
import type { CauseOutput, ExplanationOutput, ExtractionOutput, OutreachOutput } from "@clearspend/domain";
import { useState } from "react";
import { client } from "./client";
import { OutcomeText, useCommand, type Expected } from "./command";
import { csDecideOutreach, csStartAiJob, type CsAiRun } from "./sdk";
import { Icon } from "./ui";
import { evidenceLabel, shortTime } from "./view";

/**
 * D7: starts 1 AI job. The server builds the input from stored evidence; the browser sends only IDs. The run changes
 * no number, eligibility, or decision (I7, I10). It takes a few seconds, and the platform does not retry it.
 */
export function StartAiJob(props: {
  readonly expansionId: string;
  readonly job: "CAUSE" | "EXTRACTION" | "EXPLANATION" | "OUTREACH_DRAFT" | "BRIEF" | "BOOKING" | "ANALYSIS";
  readonly subjectId: string;
  readonly label: string;
  readonly onChanged: () => void;
}) {
  const { outcome, run, sending } = useCommand(props.onChanged);
  return (
    <div>
      <button
        className="btn sm"
        type="button"
        disabled={sending}
        onClick={() =>
          void run(
            ({ requestId, actorUserId }) =>
              client(csStartAiJob).applyAction({ expansionId: props.expansionId, job: props.job, subjectId: props.subjectId, requestId, actorUserId }),
            "The AI run is stored. It changes no number and no decision.",
          )
        }
      >
        <Icon name="spark" size={14} />
        {sending ? "Running the model… (a few seconds)" : props.label}
      </button>
      <OutcomeText outcome={outcome} />
    </div>
  );
}

/** D7 mechanism 7: current only while the run's revision equals the expansion's revision (I6). */
export function RunBadges({ run, evidenceRevision }: { readonly run: Osdk.Instance<CsAiRun>; readonly evidenceRevision: number }) {
  const current = Number(run.evidenceRevision) === evidenceRevision;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {current ? (
        <span className="chip ok">
          <Icon name="check" size={11} /> Current · rev {String(run.evidenceRevision)}
        </span>
      ) : (
        <span className="chip warn">
          Historical · rev {String(run.evidenceRevision)}, now {evidenceRevision}
        </span>
      )}
      <span className="chip">
        {run.status === "SUCCEEDED" ? "Validated" : run.status} · GPT-4o · {shortTime(run.startedAt)}
      </span>
      {run.inputTruncated === true ? <span className="chip warn">Input cut to the D7.4 limits</span> : null}
    </div>
  );
}

export function Failed({ run }: { readonly run: Osdk.Instance<CsAiRun> }) {
  const reasons = JSON.parse(run.reasonsJson ?? "[]") as string[];
  return (
    <div role="alert" className="error-box" style={{ fontSize: 13 }}>
      <b>{run.status === "INVALID" ? "The model's output failed validation and is not used." : "The model call failed."}</b>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}

export function outputOf<T>(run: Osdk.Instance<CsAiRun> | undefined): T | null {
  return run?.status === "SUCCEEDED" && run.outputJson !== undefined ? (JSON.parse(run.outputJson) as T) : null;
}

/** 9.1: what each document claims, where they disagree, and what is unknown. A person confirms the cause. */
export function CauseProposalView({ run, evidenceRevision }: { readonly run: Osdk.Instance<CsAiRun>; readonly evidenceRevision: number }) {
  const value = outputOf<CauseOutput>(run);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RunBadges run={run} evidenceRevision={evidenceRevision} />
      {value === null ? (
        <Failed run={run} />
      ) : (
        <>
          <div style={{ background: "var(--ai-soft)", borderRadius: 12, padding: 12 }}>
            <div className="note">Proposed cause</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ai)" }}>{value.proposedCause.replaceAll("_", " ").toLowerCase()}</div>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            {value.citations.map((citation) => (
              <li key={`${citation.evidenceId}-${citation.statement}`} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 10 }}>
                <span className={citation.supports === "SUPPLIER" ? "chip warn" : "chip brand"}>{citation.supports === "SUPPLIER" ? "Supplier" : citation.supports.replaceAll("_", " ").toLowerCase()}</span>
                <span>
                  <a className="mono" href={`#${evidenceLabel(citation.evidenceId)}`} style={{ fontSize: 12 }}>
                    {evidenceLabel(citation.evidenceId)}
                  </a>{" "}
                  <span className="note">“{citation.statement.length > 140 ? `${citation.statement.slice(0, 140)}…` : citation.statement}”</span>
                </span>
              </li>
            ))}
          </ul>
          {value.conflicts.map((conflict) => (
            <div key={conflict.description} style={{ border: "1px solid var(--warn-line)", background: "var(--warn-soft)", borderRadius: 10, padding: 10, fontSize: 12.5 }}>
              <b>Conflict:</b> {conflict.description}
            </div>
          ))}
          {value.unknowns.length === 0 ? null : (
            <div className="note">
              <b style={{ color: "var(--ink)" }}>Unknowns:</b> {value.unknowns.join(" ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** 9.2: claims with their verbatim spans. A claim is not a verified fact. Instruction-like text is shown as data. */
export function ExtractionView({ run, evidenceRevision }: { readonly run: Osdk.Instance<CsAiRun>; readonly evidenceRevision: number }) {
  const value = outputOf<ExtractionOutput>(run);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <RunBadges run={run} evidenceRevision={evidenceRevision} />
      {value === null ? (
        <Failed run={run} />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                  <th>Cited span</th>
                </tr>
              </thead>
              <tbody>
                {value.claims.map((claim) => (
                  <tr key={`${claim.field}-${claim.span}`}>
                    <td>
                      <span className="chip brand mono">{claim.field}</span>
                    </td>
                    <td>{claim.value}</td>
                    <td className="note">“{claim.span}”</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {value.gaps.length === 0 ? null : (
            <div className="note">
              <b style={{ color: "var(--ink)" }}>Gaps against the ration spec:</b> {value.gaps.map((gap) => gap.detail).join(" ")}
            </div>
          )}
          {value.instructionLikeText.map((text) => (
            <div key={text} className="untrusted">
              <div className="note" style={{ fontWeight: 700, color: "var(--warn)" }}>
                <Icon name="flag" size={12} /> UNTRUSTED TEXT · shown as data, not followed
              </div>
              <div className="mono" style={{ fontSize: 12.5, marginTop: 4 }}>
                {text}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** 9.3: an explanation of numbers calculated by code. It recommends no purchase. */
export function ExplanationView({ run, evidenceRevision }: { readonly run: Osdk.Instance<CsAiRun>; readonly evidenceRevision: number }) {
  const value = outputOf<ExplanationOutput>(run);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RunBadges run={run} evidenceRevision={evidenceRevision} />
      {value === null ? (
        <Failed run={run} />
      ) : (
        <>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {value.observations.map((observation) => (
              <li key={observation.text} style={{ display: "flex", gap: 10 }}>
                <span className={observation.category === "RECORDED_FACT" ? "chip" : "chip ai"} style={{ flex: "none" }}>
                  {observation.category === "RECORDED_FACT" ? "Fact" : "Reading"}
                </span>
                <span>
                  {observation.text}{" "}
                  <span className="mono note" style={{ fontSize: 11.5 }}>
                    {observation.evidenceIds.map(evidenceLabel).join(", ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {value.suggestedNextSteps.length === 0 ? null : (
            <div className="note" style={{ borderTop: "1px solid var(--soft)", paddingTop: 10 }}>
              <b style={{ color: "var(--ink)" }}>Next step it suggests:</b> {value.suggestedNextSteps[0]?.reason}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * D5 outreach: the AI draft, and a form where a person edits, approves, or rejects it. An approval requests 1
 * notification to Roshan's own Foundry user; it never contacts a supplier (D1). Foundry reports no delivery (D6.6).
 */
export function OutreachDraft(props: Expected & { readonly run: Osdk.Instance<CsAiRun>; readonly decided: boolean; readonly onChanged: () => void }) {
  const value = outputOf<OutreachOutput>(props.run);
  const { outcome, run, sending } = useCommand(props.onChanged);
  const [text, setText] = useState(value === null ? "" : `${value.subject}\n\n${value.body}`);
  const [rationale, setRationale] = useState("");
  const id = `outreach-${(props.run.aiRunId ?? "").slice(0, 8)}`;
  const decide = (decision: "APPROVE" | "REJECT") =>
    void run(
      ({ requestId, actorUserId }) =>
        client(csDecideOutreach).applyAction({
          expansionId: props.expansionId,
          aiRunId: props.run.aiRunId ?? "",
          decision,
          // The Action requires the text; a rejection stores none (the function ignores it).
          approvedText: text,
          rationale,
          expectedEvidenceRevision: props.expectedEvidenceRevision,
          expectedStateVersion: props.expectedStateVersion,
          requestId,
          actorUserId,
        }),
      decision === "APPROVE" ? "Approved. A notification to your own Foundry user was requested." : "Rejected. Nothing was sent.",
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <RunBadges run={props.run} evidenceRevision={props.expectedEvidenceRevision} />
      {value === null ? (
        <Failed run={props.run} />
      ) : props.decided ? (
        <p className="note">This draft was already approved or rejected. See the messages below.</p>
      ) : (
        <form className="confirm" onSubmit={(event) => event.preventDefault()}>
          <fieldset disabled={sending}>
            <label htmlFor={`${id}-text`}>Message text · {value.language} · edit before approving</label>
            <textarea id={`${id}-text`} rows={8} value={text} onChange={(event) => setText(event.target.value)} lang={value.language} />
            <label htmlFor={`${id}-rationale`}>Rationale (required)</label>
            <input id={`${id}-rationale`} value={rationale} onChange={(event) => setRationale(event.target.value)} />
            <div className="buttons">
              <button type="submit" disabled={rationale.trim() === "" || text.trim() === ""} onClick={() => decide("APPROVE")}>
                <Icon name="send" size={14} /> Approve · notify me
              </button>
              <button type="button" disabled={rationale.trim() === ""} onClick={() => decide("REJECT")}>
                Reject
              </button>
            </div>
            <p className="note">Demo: notifies only your own Foundry user. Status becomes “notification requested”; Foundry reports no delivery.</p>
          </fieldset>
          <OutcomeText outcome={outcome} />
        </form>
      )}
    </div>
  );
}
