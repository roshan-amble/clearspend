import { useState } from "react";
import { client } from "./client";
import { OutcomeText, useCommand } from "./command";
import { csConfirmIncidentCause } from "./sdk";

const CAUSES = [
  ["SUPPLIER", "Supplier"],
  ["TRANSPORT_AFTER_HANDOVER", "Transport after handover"],
  ["STORAGE", "Storage"],
  ["BUYER", "Buyer"],
  ["UNKNOWN", "Unknown"],
] as const;

/** D5: a person confirms the cause. The expected counters are the ones of the view that the person sees (D6). */
export function ConfirmCause(props: {
  readonly expansionId: string;
  readonly incidentLogicalId: string;
  readonly expectedEvidenceRevision: number;
  readonly expectedStateVersion: number;
  /** The AI proposal that the person answers, if one is shown. The person may choose another cause. */
  readonly answersProposalId?: string;
  readonly onChanged: () => void;
}) {
  const { outcome, run } = useCommand(props.onChanged);
  const [cause, setCause] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const fieldId = props.incidentLogicalId.replace(/[^A-Za-z0-9]/g, "-");

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    void run(
      ({ requestId, actorUserId }) =>
        client(csConfirmIncidentCause).applyAction({
          expansionId: props.expansionId,
          incidentLogicalId: props.incidentLogicalId,
          chosenCause: cause,
          rationale,
          expectedEvidenceRevision: props.expectedEvidenceRevision,
          expectedStateVersion: props.expectedStateVersion,
          requestId,
          actorUserId,
          ...(props.answersProposalId === undefined ? {} : { answersProposalId: props.answersProposalId }),
        }),
      "Confirmed. The numbers below are recalculated.",
    );
  }

  return (
    <form className="confirm" onSubmit={submit}>
      <fieldset disabled={outcome.kind === "sending"}>
        <legend>Confirm the cause</legend>
        <label htmlFor={`${fieldId}-cause`}>Cause</label>
        <select id={`${fieldId}-cause`} required value={cause} onChange={(event) => setCause(event.target.value)}>
          <option value="" disabled>
            Choose a cause
          </option>
          {CAUSES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor={`${fieldId}-rationale`}>Rationale (required)</label>
        <textarea
          id={`${fieldId}-rationale`}
          required
          minLength={10}
          rows={3}
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
        />
        <button type="submit">{outcome.kind === "sending" ? "Confirming…" : "Confirm cause"}</button>
      </fieldset>
      <OutcomeText outcome={outcome} />
    </form>
  );
}
