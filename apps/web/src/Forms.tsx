import { useState } from "react";
import { client } from "./client";
import { OutcomeText, useCommand, type Expected } from "./command";
import { csRecordFieldVerification, csRecordSourcingDecision, csSelectFieldVisit } from "./sdk";

const idOf = (text: string): string => text.replace(/[^A-Za-z0-9]/g, "-");

/** D5: a supply chain manager selects a lead for a field visit, with a rationale. A decision under the D6 guard. */
export function SelectFieldVisit(props: Expected & { readonly supplierLogicalId: string; readonly onChanged: () => void }) {
  const { outcome, run, sending } = useCommand(props.onChanged);
  const [rationale, setRationale] = useState("");
  const id = `visit-${idOf(props.supplierLogicalId)}`;
  return (
    <form
      className="confirm"
      onSubmit={(event) => {
        event.preventDefault();
        void run(
          ({ requestId, actorUserId }) =>
            client(csSelectFieldVisit).applyAction({
              expansionId: props.expansionId,
              supplierLogicalId: props.supplierLogicalId,
              rationale,
              expectedEvidenceRevision: props.expectedEvidenceRevision,
              expectedStateVersion: props.expectedStateVersion,
              requestId,
              actorUserId,
            }),
          "Selected for a field visit. The lead stays a lead until a result is recorded.",
        );
      }}
    >
      <fieldset disabled={sending}>
        <legend>Select for field visit</legend>
        <label htmlFor={id}>Rationale (required)</label>
        <textarea id={id} required minLength={10} rows={2} value={rationale} onChange={(event) => setRationale(event.target.value)} />
        <button type="submit">{sending ? "Selecting…" : "Select for field visit"}</button>
      </fieldset>
      <OutcomeText outcome={outcome} />
    </form>
  );
}

/**
 * D5: a field verifier records a visit's result. Evidence, so it raises the revision and the numbers are
 * recalculated. D9 roles are not set yet: the server checks the actor, and any signed-in member can record.
 */
export function RecordVerification(props: {
  readonly expansionId: string;
  readonly supplierLogicalId: string;
  readonly rationVersion: number;
  readonly onChanged: () => void;
}) {
  const { outcome, run, sending } = useCommand(props.onChanged);
  const [result, setResult] = useState("");
  const [visitedOn, setVisitedOn] = useState("");
  const [moisture, setMoisture] = useState("");
  const [capacityKg, setCapacityKg] = useState("");
  const [notes, setNotes] = useState("");
  const id = `verify-${idOf(props.supplierLogicalId)}`;
  return (
    <form
      className="confirm"
      onSubmit={(event) => {
        event.preventDefault();
        // Whole numbers only: permille and kilograms, as the field sheet records them (D3). No decimals are parsed.
        const moisturePermille = moisture.trim() === "" ? undefined : Number.parseInt(moisture, 10);
        void run(
          ({ requestId, actorUserId }) =>
            client(csRecordFieldVerification).applyAction({
              expansionId: props.expansionId,
              supplierLogicalId: props.supplierLogicalId,
              rationVersion: props.rationVersion,
              visitedAt: `${visitedOn}T00:00:00Z`,
              result,
              sourceConfirmedCapacityPerMonth: Number.parseInt(capacityKg, 10),
              notes,
              requestId,
              actorUserId,
              ...(moisturePermille === undefined ? {} : { moisturePermille }),
            }),
          "Recorded. The evidence revision rose and the numbers are recalculated.",
        );
      }}
    >
      <fieldset disabled={sending}>
        <legend>Record verification result (field verifier)</legend>
        <label htmlFor={`${id}-result`}>Result</label>
        <select id={`${id}-result`} required value={result} onChange={(event) => setResult(event.target.value)}>
          <option value="" disabled>
            Choose PASS or FAIL
          </option>
          <option value="PASS">PASS</option>
          <option value="FAIL">FAIL</option>
        </select>
        <label htmlFor={`${id}-date`}>Visit date</label>
        <input id={`${id}-date`} type="date" required value={visitedOn} onChange={(event) => setVisitedOn(event.target.value)} />
        <label htmlFor={`${id}-moisture`}>Moisture in permille, if measured (132 means 13.2%)</label>
        <input id={`${id}-moisture`} inputMode="numeric" pattern="[0-9]*" value={moisture} onChange={(event) => setMoisture(event.target.value)} />
        <label htmlFor={`${id}-capacity`}>Confirmed capacity, kilograms each month</label>
        <input
          id={`${id}-capacity`}
          inputMode="numeric"
          pattern="[0-9]+"
          required
          value={capacityKg}
          onChange={(event) => setCapacityKg(event.target.value)}
        />
        <label htmlFor={`${id}-notes`}>Notes (required)</label>
        <textarea id={`${id}-notes`} required rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        <p className="note">Checked against ration version {props.rationVersion}.</p>
        <button type="submit">{sending ? "Recording…" : "Record result"}</button>
      </fieldset>
      <OutcomeText outcome={outcome} />
    </form>
  );
}

/**
 * D5 and C9: the sourcing decision. Only a supplier with a passed field verification can be chosen. It records a
 * choice only: no purchase order, no payment (D1).
 */
export function SourcingDecision(
  props: Expected & { readonly eligible: readonly { readonly logicalId: string; readonly label: string }[]; readonly onChanged: () => void },
) {
  const { outcome, run, sending } = useCommand(props.onChanged);
  const [supplier, setSupplier] = useState("");
  const [rationale, setRationale] = useState("");
  return (
    <form
      className="confirm"
      onSubmit={(event) => {
        event.preventDefault();
        void run(
          ({ requestId, actorUserId }) =>
            client(csRecordSourcingDecision).applyAction({
              expansionId: props.expansionId,
              supplierLogicalId: supplier,
              rationale,
              expectedEvidenceRevision: props.expectedEvidenceRevision,
              expectedStateVersion: props.expectedStateVersion,
              requestId,
              actorUserId,
            }),
          "Decision recorded. ClearSpend created no purchase order and moved no money.",
        );
      }}
    >
      <fieldset disabled={sending}>
        <legend>Record a sourcing decision</legend>
        <label htmlFor="decision-supplier">Supplier (only eligible suppliers are listed)</label>
        <select id="decision-supplier" required value={supplier} onChange={(event) => setSupplier(event.target.value)}>
          <option value="" disabled>
            Choose a supplier
          </option>
          {props.eligible.map((option) => (
            <option key={option.logicalId} value={option.logicalId}>
              {option.label}
            </option>
          ))}
        </select>
        <label htmlFor="decision-rationale">Rationale (required)</label>
        <textarea id="decision-rationale" required minLength={10} rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} />
        <p className="note">This records a decision only. It creates no purchase order.</p>
        <button type="submit">{sending ? "Recording…" : "Record decision"}</button>
      </fieldset>
      <OutcomeText outcome={outcome} />
    </form>
  );
}
