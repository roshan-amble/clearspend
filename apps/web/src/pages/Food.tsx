import { type CountryView } from "@clearspend/domain";
import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { FOOD_VAR } from "../ui";
import { shareText, shortId, thousands } from "../view";
import { food, useCountry } from "./Country";
import { OffersToReview, SupplierList } from "./Suppliers";

/** The old food screen's address, kept so a saved link still works: it opens Suppliers on that food. */
export function FoodRedirect() {
  const { commodity = "" } = useParams();
  return <Navigate to={`../../suppliers?food=${commodity}`} replace />;
}

/**
 * P17, page 2: per ingredient, who we use and for how much, who else is available (local and international), and the
 * 10% rule. Code names the next supplier to check; Investigate opens the AI visit brief (P16).
 */
export function SuppliersPage() {
  const { view, reload } = useCountry();
  const [params, setParams] = useSearchParams();
  const route = (["LOCAL", "IMPORT"] as const).find((r) => r === params.get("route")) ?? "ALL";
  const commodity = view.ingredients.find((i) => i.commodity === params.get("food"))?.commodity ?? view.pipeline.find((s) => s.check !== null)?.commodity ?? view.ingredients[0]?.commodity ?? "";
  const ingredient = view.ingredients.find((i) => i.commodity === commodity);
  const step = view.pipeline.find((s) => s.commodity === commodity);
  // The supplier (or "MARKET") whose investigation form is open. The next-step button and "?investigate=" open it.
  const [tagging, setTagging] = useState<string | null>(params.get("investigate"));
  const choose = (next: string) => {
    setTagging(null);
    setParams(route === "ALL" ? { food: next } : { food: next, route });
  };
  const chooseRoute = (next: "ALL" | "LOCAL" | "IMPORT") => setParams(next === "ALL" ? { food: commodity } : { food: commodity, route: next });
  const investigate = (subject: string) => {
    setTagging(subject);
    setTimeout(() => document.getElementById(`row-${subject}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  };
  if (ingredient === undefined || step === undefined) return <div className="empty">This program has no ingredient yet.</div>;
  const unit = commodity === "OIL" ? "L" : "kg";
  const plan = ingredient.sourcing;
  const over = plan.safeLocalPerMonth !== null && ingredient.needPerMonth > plan.safeLocalPerMonth;
  return (
    <>
      <OffersToReview view={view} reload={reload} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div className="seg" role="tablist" aria-label="Ingredient">
          {view.ingredients.map((i) => (
            <button key={i.commodity} type="button" role="tab" aria-selected={i.commodity === commodity} onClick={() => choose(i.commodity)}>
              <span className="dot" style={{ background: FOOD_VAR[i.commodity] ?? "var(--brand-2)" }} />
              {food(i.commodity)}
            </button>
          ))}
        </div>
        <div className="seg" role="tablist" aria-label="Suppliers to show">
          {(
            [
              ["ALL", "All suppliers"],
              ["LOCAL", "Local"],
              ["IMPORT", "International"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={route === value} onClick={() => chooseRoute(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="card" aria-label="The 10% rule and the next step" style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="rule-facts">
          <Fact label="We need" value={`${thousands(ingredient.needPerMonth)} ${unit}`} sub="a month" />
          <Fact label="Local market" value={plan.marketVolumePerMonth === null ? "unknown" : `${thousands(plan.marketVolumePerMonth)} ${unit}`} sub="a month · synthetic estimate" />
          <Fact label="10% rule: safe to buy locally" value={plan.safeLocalPerMonth === null ? "unknown" : `${thousands(plan.safeLocalPerMonth)} ${unit}`} sub="above this, our buying pushes local prices up" />
          <Fact label="If we bought it all locally" value={plan.shareIfAllLocal === null ? "unknown" : shareText(plan.shareIfAllLocal)} sub="of the local market" tone={over ? "var(--bad)" : "var(--ok)"} />
        </div>
        {step.beyondLocalPerMonth > 0 ? (
          <div className="note" style={{ color: "var(--ink2)", fontSize: 13.5 }}>
            Local supply can cover at most {thousands(plan.safeLocalPerMonth ?? 0)} {unit} a month. The other <b>{thousands(step.beyondLocalPerMonth)} {unit}</b> must come from international suppliers.
          </div>
        ) : null}
        <NextStep step={step} route={route} onInvestigate={investigate} tagging={tagging} />
      </section>

      <SupplierList view={view} ingredient={ingredient} reload={reload} tagging={tagging} onTagging={setTagging} route={route} />
    </>
  );
}

function Fact({ label, value, sub, tone }: { readonly label: string; readonly value: string; readonly sub: string; readonly tone?: string }) {
  return (
    <div>
      <div className="note" style={{ fontWeight: 600 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 19, fontWeight: 700, color: tone, margin: "2px 0" }}>
        {value}
      </div>
      <div className="note">{sub}</div>
    </div>
  );
}

/**
 * The next step, chosen by code (P16): the stage says what kind of step, and `check` names the supplier with the
 * biggest saving that nobody has verified. AI does not choose it; AI writes the visit brief once a person asks.
 */
function NextStep(props: { readonly step: CountryView["pipeline"][number]; readonly route: "ALL" | "LOCAL" | "IMPORT"; readonly onInvestigate: (subject: string) => void; readonly tagging: string | null }) {
  const { step, route } = props;
  const { next } = step;
  const investigation = next.investigationId === null ? null : `../investigations?select=${next.investigationId}`;
  if (next.kind === "BOOK" || next.kind === "WAIT" || next.kind === "DECIDE") {
    const text =
      next.kind === "BOOK"
        ? "An investigation is tagged. Book an investigator to go and check."
        : next.kind === "WAIT"
          ? `An investigator is booked: ${next.label.toLowerCase()}. The visit result decides the next step.`
          : "A field visit passed: the supplier can be chosen.";
    return (
      <div className="next">
        <b>Next</b>
        <span>{text}</span>
        {investigation === null || next.kind === "DECIDE" ? null : (
          <Link className={next.kind === "BOOK" ? "btn sm primary" : "btn sm"} to={investigation}>
            {next.kind === "BOOK" ? "Book investigator →" : "Open the investigation →"}
          </Link>
        )}
      </div>
    );
  }
  // Code names the supplier to check: on the chosen route, or on both when local supply cannot cover the need.
  const lines =
    route === "LOCAL"
      ? [{ label: "Local", check: step.checks.LOCAL }]
      : route === "IMPORT"
        ? [{ label: "International", check: step.checks.IMPORT }]
        : step.beyondLocalPerMonth > 0 && (step.checks.LOCAL !== null || step.checks.IMPORT !== null)
          ? [
              { label: "International", check: step.checks.IMPORT },
              { label: "Local", check: step.checks.LOCAL },
            ]
          : [{ label: "", check: step.check }];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {lines.map(({ label, check }) => {
        const who = check === null ? null : check.role === "BID" ? check.name : shortId(check.supplierLogicalId);
        const text =
          check !== null
            ? `Check ${who}: ${check.reason}.`
            : label !== ""
              ? `No ${label.toLowerCase()} offer on record would save money.`
              : next.kind === "SURVEY"
                ? "No supplier or offer yet. Survey the market below to find local sellers and their prices."
                : step.stage === "DELIVERING"
                  ? "Delivered by the current supplier. No cheaper option on record."
                  : "No offer on record would save money. A market survey may find other sellers.";
        return (
          <div key={label || "all"} className="next">
            <b>{label === "" ? "Next" : `Next · ${label}`}</b>
            <span>{text}</span>
            {check !== null && props.tagging !== check.supplierLogicalId ? (
              <button className="btn sm primary" type="button" onClick={() => props.onInvestigate(check.supplierLogicalId)}>
                Investigate {who}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
