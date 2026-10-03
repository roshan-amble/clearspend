import { checkBid, DomainError, FOOD_NAME, parseDecimalScaled } from "@clearspend/domain";
import type { Osdk } from "@osdk/client";
import { useEffect, useState } from "react";
import { client, currentUserId } from "./client";
import { ScopeCheck } from "./ScopeCheck";
import { CsCountry, csSubmitSupplierBid } from "./sdk";

/**
 * The supplier site (Roshan, 2026-10-01, P10 and P11). A supplier tells Harbor Meals the lowest price at which it can
 * supply profitably, and how much a month. It shows nothing of ours: no market price, no other offer, no volume, so
 * nothing anchors the price. A person at Harbor Meals reviews every offer before it counts.
 */

const FOODS = Object.keys(FOOD_NAME).sort((a, b) => (FOOD_NAME[a] ?? a).localeCompare(FOOD_NAME[b] ?? b));
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const today = () => new Date().toISOString().slice(0, 10);

interface Sent {
  readonly reference: string;
  readonly program: string;
  readonly food: string;
  readonly price: string;
  readonly quantity: string;
  readonly unit: string;
}

function describe(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  if (!(error instanceof Error)) return String(error);
  const api = error as Error & { errorName?: string; statusCode?: number };
  return [api.errorName ?? error.name, api.statusCode === undefined ? "" : `HTTP ${api.statusCode}`, error.message].filter((part) => part !== "").join(" · ");
}

export function App() {
  const [programs, setPrograms] = useState<Osdk.Instance<CsCountry>[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  useEffect(() => {
    (async () => {
      const page = await client(CsCountry).fetchPage({ $pageSize: 100 });
      setPrograms([...page.data].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
    })().catch((error: unknown) => setLoadError(describe(error)));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,var(--brand),var(--brand-2))" }} aria-hidden="true" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Harbor Meals · Supplier offers</div>
            <div className="note">Food assistance programs (fictional organization, demo)</div>
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 60px", display: "flex", flexDirection: "column", gap: 24 }}>
        <section>
          <h1 style={{ fontSize: 24, margin: "0 0 8px", letterSpacing: "-.02em" }}>Offer to supply food</h1>
          <p style={{ margin: 0, lineHeight: 1.6, color: "var(--ink2)" }}>
            Tell us the lowest price at which you can supply us and still make a fair profit, and how much you can deliver each month. We review every offer, and
            we may visit you before we buy. We never share your offer with other suppliers.
          </p>
        </section>
        {loadError !== null ? (
          <div className="error-box" role="alert">
            <b>Could not load the programs.</b> {loadError}
          </div>
        ) : programs === null ? (
          <p className="loading" role="status">
            Loading the programs…
          </p>
        ) : (
          <OfferForm programs={programs} onSent={(s) => setSent((list) => [s, ...list])} />
        )}
        {sent.length === 0 ? null : (
          <section className="card" aria-label="Sent in this visit">
            <div className="card-h">
              <h3>Sent in this visit</h3>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
              {sent.map((s) => (
                <div key={s.reference}>
                  <b>{s.food}</b> for {s.program}: {s.price} US$ per {s.unit}, {s.quantity} {s.unit} a month · reference <span className="mono">{s.reference.slice(0, 8)}</span> · waiting for review
                </div>
              ))}
            </div>
          </section>
        )}
        {import.meta.env.DEV ? <ScopeCheck /> : null}
      </main>
    </div>
  );
}

function OfferForm({ programs, onSent }: { readonly programs: readonly Osdk.Instance<CsCountry>[]; readonly onSent: (sent: Sent) => void }) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [program, setProgram] = useState(programs.find((p) => p.status === "NEW")?.countryIso3 ?? programs[0]?.countryIso3 ?? "");
  const [commodity, setCommodity] = useState("BEANS");
  const [businessName, setBusinessName] = useState("");
  const [contact, setContact] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [earliestStart, setEarliestStart] = useState(today());
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ readonly kind: "idle" | "sending" | "done" | "error"; readonly message?: string }>({ kind: "idle" });
  const unit = commodity === "OIL" ? "L" : "kg";
  const chosen = programs.find((p) => p.countryIso3 === program);

  async function submit() {
    setState({ kind: "sending" });
    try {
      // The same checks as the server (P10), so a mistake shows at once. Exact: no floating point.
      const cents = parseDecimalScaled(price, 2);
      if (!/^\d+$/.test(quantity.trim())) throw new DomainError("BAD_BID", "The monthly quantity must be a whole number.");
      const command = {
        countryIso3: program,
        commodity,
        businessName,
        contact,
        deliveryArea,
        priceCentsPer1000: Number(cents),
        quantityPerMonth: Number(quantity.trim()),
        earliestStart,
        note: note.trim() === "" ? null : note,
      };
      checkBid(command, today());
      await client(csSubmitSupplierBid).applyAction({ ...command, note: note.trim(), requestId, actorUserId: await currentUserId() });
      onSent({ reference: requestId, program: chosen?.name ?? program, food: capital(FOOD_NAME[commodity] ?? commodity), price, quantity: quantity.trim(), unit });
      setRequestId(crypto.randomUUID());
      setPrice("");
      setQuantity("");
      setNote("");
      setState({ kind: "done", message: "Received. Harbor Meals reviews every offer and will contact you." });
    } catch (error) {
      const text = describe(error);
      setState(text.includes("REPLAYED") ? { kind: "done", message: "Already received. Nothing changed." } : { kind: "error", message: text });
    }
  }

  return (
    <form
      className="card"
      style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset disabled={state.kind === "sending"} style={{ border: 0, padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        <Field label="Program" htmlFor="program">
          <select id="program" value={program} onChange={(e) => setProgram(e.target.value)}>
            {programs.map((p) => (
              <option key={p.countryIso3} value={p.countryIso3}>
                {p.flag} {p.name} · {p.programRegion}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Food" htmlFor="food">
          <select id="food" value={commodity} onChange={(e) => setCommodity(e.target.value)}>
            {FOODS.map((f) => (
              <option key={f} value={f}>
                {capital(FOOD_NAME[f] ?? f)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Business name" htmlFor="business">
          <input id="business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} autoComplete="organization" required />
        </Field>
        <Field label="Phone or email" htmlFor="contact">
          <input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} required />
        </Field>
        <Field label="Where you can deliver" htmlFor="area">
          <input id="area" value={deliveryArea} onChange={(e) => setDeliveryArea(e.target.value)} placeholder="Town or district" required />
        </Field>
        <Field label="Earliest month you can start" htmlFor="start">
          <input id="start" type="date" min={today()} value={earliestStart} onChange={(e) => setEarliestStart(e.target.value)} required />
        </Field>
        <Field label={`Your lowest profitable price, US$ per ${unit}`} htmlFor="price">
          <input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
        </Field>
        <Field label={`How much you can supply each month, ${unit}`} htmlFor="quantity">
          <input id="quantity" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" required />
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Anything else (optional): quality, certificates, storage, transport" htmlFor="note">
            <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </fieldset>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button className="btn primary" type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Send offer"}
        </button>
        <span className="note">An offer is not an order. We buy only after a review, and often after a visit.</span>
      </div>
      {state.message === undefined ? null : (
        <p role={state.kind === "error" ? "alert" : "status"} className={state.kind} style={{ margin: 0 }}>
          {state.message}
        </p>
      )}
    </form>
  );
}

function Field({ label, htmlFor, children }: { readonly label: string; readonly htmlFor: string; readonly children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
