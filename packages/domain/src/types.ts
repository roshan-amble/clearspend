/** Quantities are whole grams for solids and whole millilitres for liquids (D3, D11). */
export type BaseUnit = "g" | "ml";

export type Currency = string;

/** The currency that the v1 core supports. Anything else is an UNSUPPORTED_CASE finding. */
export const SUPPORTED_CURRENCY: Currency = "USD";

export type AcceptanceResult = "PASS" | "FAIL" | "NOT_TESTED";

/** Brief section 9.1 and D5. UNKNOWN is a valid confirmed answer, and it still gives a range. */
export type Cause = "SUPPLIER" | "TRANSPORT_AFTER_HANDOVER" | "STORAGE" | "BUYER" | "UNKNOWN";

export type Route = "IMPORT" | "LOCAL";
