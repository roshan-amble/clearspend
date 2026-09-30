import { DomainError } from "./errors.js";
import type { AcceptanceResult, BaseUnit, Route } from "./types.js";

/**
 * D4: the files that the import Action accepts, in the order a full import applies them.
 * `expansion` and `expansion-commodities` are setup files (Roshan, 2026-09-29). The rest are evidence.
 */
export const EVIDENCE_KINDS = [
  "expansion",
  "expansion-commodities",
  "suppliers",
  "supplier-profiles",
  "orders",
  "payments",
  "invoices",
  "deliveries",
  "incidents",
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/**
 * How each kind is stored. A versioned type keeps every version, keyed `logicalId@digest` (D3).
 * On changed content, VERSION supersedes the earlier version (D4: deliveries and incidents; profiles are
 * versions in D3). CONFLICT never overwrites: a versioned type stores it as a conflicting version, and an
 * unversioned type does not store it at all. Either way the import report shows it.
 */
export const KIND_RULES: Readonly<Record<EvidenceKind, { readonly versioned: boolean; readonly onChange: "VERSION" | "CONFLICT" }>> = {
  expansion: { versioned: false, onChange: "CONFLICT" },
  "expansion-commodities": { versioned: false, onChange: "CONFLICT" },
  suppliers: { versioned: false, onChange: "CONFLICT" },
  "supplier-profiles": { versioned: true, onChange: "VERSION" },
  orders: { versioned: true, onChange: "CONFLICT" },
  payments: { versioned: true, onChange: "CONFLICT" },
  invoices: { versioned: true, onChange: "CONFLICT" },
  deliveries: { versioned: true, onChange: "VERSION" },
  incidents: { versioned: true, onChange: "VERSION" },
};

export type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json };

// Property names are the Ontology API names of the matching Cs object type (scripts/lib/ontology.ts).

export interface ExpansionProps {
  readonly name: string;
  readonly region: string;
  readonly rationVersion: number;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly visibilityLevel: string;
}

export interface CommodityProps {
  readonly expansionId: string;
  readonly commodity: string;
  readonly baseUnit: BaseUnit;
  readonly quantityPerMeal: number;
  readonly maxMoisturePermille: number | null;
  readonly plannedPerMonth: number;
  readonly marketVolumeEstimatePerMonth: number;
  readonly marketVolumeLabel: string;
  readonly marketSeriesLocal: string;
  readonly marketSeriesImport: string;
}

export interface SupplierProps {
  readonly name: string;
  readonly route: Route;
  readonly country: string;
}

export interface ProfileProps {
  readonly supplierLogicalId: string;
  readonly commodity: string;
  readonly language: string;
  readonly text: string;
  readonly quotedCentsPer1000: number;
  readonly sourceClaimedCapacityPerMonth: number;
  readonly claimedCapacityPerMonth: number;
  readonly submittedAt: string;
}

export interface OrderProps {
  readonly expansionId: string;
  readonly supplierLogicalId: string;
  readonly commodity: string;
  readonly sourceUnit: string;
  readonly sourceQuantity: number;
  readonly baseUnit: BaseUnit;
  readonly quantity: number;
  readonly unitPriceCentsPer1000: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly replacesOrderLogicalId: string | null;
  readonly replacesIncidentLogicalId: string | null;
  readonly recordedAt: string;
}

export interface PaymentProps {
  readonly orderLogicalId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly paidAt: string;
}

export interface InvoiceProps {
  readonly orderLogicalId: string;
  readonly commodity: string;
  readonly sourceUnit: string;
  readonly sourceQuantity: number;
  readonly baseUnit: BaseUnit;
  readonly quantity: number;
  readonly unitPriceCentsPer1000: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly recordedAt: string;
}

export interface DeliveryProps {
  readonly orderLogicalId: string;
  readonly commodity: string;
  readonly sourceUnit: string;
  readonly sourceQuantityReceived: number;
  readonly baseUnit: BaseUnit;
  readonly quantityReceived: number;
  readonly receivedAt: string;
  readonly handoverAt: string;
  readonly moisturePermille: number | null;
  readonly acceptanceResult: AcceptanceResult;
}

export interface IncidentDocument {
  readonly documentId: string;
  readonly authorRole: string;
  readonly recordedAt: string;
  readonly text: string;
}

export interface IncidentProps {
  readonly orderLogicalId: string;
  readonly reportedAt: string;
  readonly sourceAffectedQuantity: number;
  readonly baseUnit: BaseUnit;
  readonly affectedQuantity: number;
  readonly documents: readonly IncidentDocument[];
}

interface PropsByKind {
  expansion: ExpansionProps;
  "expansion-commodities": CommodityProps;
  suppliers: SupplierProps;
  "supplier-profiles": ProfileProps;
  orders: OrderProps;
  payments: PaymentProps;
  invoices: InvoiceProps;
  deliveries: DeliveryProps;
  incidents: IncidentProps;
}

/** A reference that must name a stored record, or a record earlier in the same batch (D4 "unmatched"). */
export interface Reference {
  readonly kind: "expansion" | "suppliers" | "orders";
  readonly logicalId: string;
}

export interface EvidenceRow<K extends EvidenceKind = EvidenceKind> {
  readonly kind: K;
  /** 1 for the first data row. */
  readonly rowNumber: number;
  /** `sourceSystem:externalId` (D4). For setup files, the expansion ID or `expansionId:commodity`. */
  readonly logicalId: string;
  readonly sourceSystem: string | null;
  readonly externalId: string;
  /** The business fields. They alone make the content digest (D4: never the import time). */
  readonly props: PropsByKind[K];
  readonly references: readonly Reference[];
}

export type AnyEvidenceRow = { [K in EvidenceKind]: EvidenceRow<K> }[EvidenceKind];

// ---------------------------------------------------------------------------------------------------------------
// Field readers. Every problem names the row and the field (D4 "Validation").

type Raw = Readonly<Record<string, unknown>>;

function fail(rowNumber: number, field: string, message: string): never {
  throw new DomainError("INVALID_ROW", `Row ${rowNumber}, field "${field}": ${message}`);
}

function text(raw: Raw, field: string, rowNumber: number): string {
  const value = raw[field];
  if (typeof value !== "string" || value.trim() === "") fail(rowNumber, field, "a non-empty text is required.");
  return value;
}

function optionalText(raw: Raw, field: string, rowNumber: number): string | null {
  const value = raw[field];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") fail(rowNumber, field, "must be text.");
  return value;
}

/** A non-negative safe integer, from a JSON number or a text of digits. Never a decimal or a float. */
function whole(raw: Raw, field: string, rowNumber: number): number {
  const value = raw[field];
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(rowNumber, field, `must be a non-negative whole number, not "${String(value)}".`);
  return parsed;
}

function optionalWhole(raw: Raw, field: string, rowNumber: number): number | null {
  const value = raw[field];
  return value === undefined || value === null || value === "" ? null : whole(raw, field, rowNumber);
}

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** ISO 8601 in UTC with a `Z` (brief section 7: timestamps with a time zone). */
function timestamp(raw: Raw, field: string, rowNumber: number): string {
  const value = text(raw, field, rowNumber);
  if (!TIMESTAMP.test(value)) fail(rowNumber, field, `must be an ISO 8601 UTC time like 2026-03-10T08:00:00Z, not "${value}".`);
  return value;
}

function date(raw: Raw, field: string, rowNumber: number): string {
  const value = text(raw, field, rowNumber);
  if (!DATE.test(value)) fail(rowNumber, field, `must be a date like 2026-03-01, not "${value}".`);
  return value;
}

function oneOf<T extends string>(raw: Raw, field: string, rowNumber: number, allowed: readonly T[]): T {
  const value = text(raw, field, rowNumber);
  if (!(allowed as readonly string[]).includes(value)) fail(rowNumber, field, `must be one of ${allowed.join(", ")}, not "${value}".`);
  return value as T;
}

/** Kilograms and litres become grams and millilitres (D3, D11). Any other unit is refused. */
function toBase(raw: Raw, quantityField: string, rowNumber: number): { unit: string; source: number; baseUnit: BaseUnit; base: number } {
  const unit = oneOf(raw, "unit", rowNumber, ["kg", "L"] as const);
  const source = whole(raw, quantityField, rowNumber);
  const base = source * 1000;
  if (!Number.isSafeInteger(base)) fail(rowNumber, quantityField, "is too large in base units.");
  return { unit, source, baseUnit: unit === "kg" ? "g" : "ml", base };
}

const logical = (sourceSystem: string, externalId: string): string => `${sourceSystem}:${externalId}`;

// ---------------------------------------------------------------------------------------------------------------

function parseRow(kind: EvidenceKind, raw: Raw, rowNumber: number): AnyEvidenceRow {
  switch (kind) {
    case "expansion": {
      const id = text(raw, "expansion_id", rowNumber);
      return {
        kind,
        rowNumber,
        logicalId: id,
        sourceSystem: null,
        externalId: id,
        references: [],
        props: {
          name: text(raw, "name", rowNumber),
          region: text(raw, "region", rowNumber),
          rationVersion: whole(raw, "ration_version", rowNumber),
          periodStart: date(raw, "period_start", rowNumber),
          periodEnd: date(raw, "period_end", rowNumber),
          visibilityLevel: text(raw, "visibility_level", rowNumber),
        },
      };
    }
    case "expansion-commodities": {
      const expansionId = text(raw, "expansion_id", rowNumber);
      const commodity = text(raw, "commodity", rowNumber);
      return {
        kind,
        rowNumber,
        logicalId: `${expansionId}:${commodity}`,
        sourceSystem: null,
        externalId: commodity,
        references: [{ kind: "expansion", logicalId: expansionId }],
        props: {
          expansionId,
          commodity,
          baseUnit: oneOf(raw, "unit", rowNumber, ["g", "ml"] as const),
          quantityPerMeal: whole(raw, "quantity_per_meal", rowNumber),
          maxMoisturePermille: optionalWhole(raw, "max_moisture_permille", rowNumber),
          plannedPerMonth: whole(raw, "planned_per_month", rowNumber),
          marketVolumeEstimatePerMonth: whole(raw, "market_volume_estimate_per_month", rowNumber),
          marketVolumeLabel: oneOf(raw, "market_volume_label", rowNumber, ["synthetic"] as const),
          marketSeriesLocal: text(raw, "market_series_local", rowNumber),
          marketSeriesImport: text(raw, "market_series_import", rowNumber),
        },
      };
    }
    case "suppliers": {
      const sourceSystem = text(raw, "source_system", rowNumber);
      const externalId = text(raw, "supplier_id", rowNumber);
      return {
        kind,
        rowNumber,
        logicalId: logical(sourceSystem, externalId),
        sourceSystem,
        externalId,
        references: [],
        props: {
          name: text(raw, "name", rowNumber),
          route: oneOf(raw, "route", rowNumber, ["IMPORT", "LOCAL"] as const),
          country: text(raw, "country", rowNumber),
        },
      };
    }
    case "supplier-profiles": {
      const sourceSystem = text(raw, "source_system", rowNumber);
      const externalId = text(raw, "supplier_id", rowNumber);
      const capacityKg = whole(raw, "claimed_capacity_kg_per_month", rowNumber);
      return {
        kind,
        rowNumber,
        logicalId: logical(sourceSystem, externalId),
        sourceSystem,
        externalId,
        references: [{ kind: "suppliers", logicalId: logical(sourceSystem, externalId) }],
        props: {
          supplierLogicalId: logical(sourceSystem, externalId),
          commodity: text(raw, "commodity", rowNumber),
          language: text(raw, "language", rowNumber),
          text: text(raw, "text", rowNumber),
          quotedCentsPer1000: whole(raw, "quoted_price_cents_per_kg", rowNumber),
          sourceClaimedCapacityPerMonth: capacityKg,
          claimedCapacityPerMonth: capacityKg * 1000,
          submittedAt: timestamp(raw, "submitted_at", rowNumber),
        },
      };
    }
    case "orders": {
      const sourceSystem = text(raw, "source_system", rowNumber);
      const externalId = text(raw, "order_id", rowNumber);
      const expansionId = text(raw, "expansion_id", rowNumber);
      const supplierLogicalId = logical(sourceSystem, text(raw, "supplier_id", rowNumber));
      const replacesOrder = optionalText(raw, "replaces_order_id", rowNumber);
      const replacesIncident = optionalText(raw, "replaces_incident_id", rowNumber);
      const quantity = toBase(raw, "quantity", rowNumber);
      return {
        kind,
        rowNumber,
        logicalId: logical(sourceSystem, externalId),
        sourceSystem,
        externalId,
        // The replaced incident is not a reference: incidents are imported after orders. The cost model treats
        // a replacement whose loss it cannot find as ambiguous, never as a guess.
        references: [
          { kind: "expansion", logicalId: expansionId },
          { kind: "suppliers", logicalId: supplierLogicalId },
          ...(replacesOrder === null ? [] : [{ kind: "orders" as const, logicalId: logical(sourceSystem, replacesOrder) }]),
        ],
        props: {
          expansionId,
          supplierLogicalId,
          commodity: text(raw, "commodity", rowNumber),
          sourceUnit: quantity.unit,
          sourceQuantity: quantity.source,
          baseUnit: quantity.baseUnit,
          quantity: quantity.base,
          unitPriceCentsPer1000: whole(raw, "unit_price_cents", rowNumber),
          totalCents: whole(raw, "total_cents", rowNumber),
          currency: text(raw, "currency", rowNumber),
          replacesOrderLogicalId: replacesOrder === null ? null : logical(sourceSystem, replacesOrder),
          replacesIncidentLogicalId: replacesIncident === null ? null : logical(sourceSystem, replacesIncident),
          recordedAt: timestamp(raw, "recorded_at", rowNumber),
        },
      };
    }
    case "payments": {
      const sourceSystem = text(raw, "source_system", rowNumber);
      const orderLogicalId = logical(sourceSystem, text(raw, "order_id", rowNumber));
      const externalId = text(raw, "payment_id", rowNumber);
      return {
        kind,
        rowNumber,
        logicalId: logical(sourceSystem, externalId),
        sourceSystem,
        externalId,
        references: [{ kind: "orders", logicalId: orderLogicalId }],
        props: {
          orderLogicalId,
          amountCents: whole(raw, "amount_cents", rowNumber),
          currency: text(raw, "currency", rowNumber),
          paidAt: timestamp(raw, "paid_at", rowNumber),
        },
      };
    }
    case "invoices": {
      const sourceSystem = text(raw, "source_system", rowNumber);
      const orderLogicalId = logical(sourceSystem, text(raw, "order_id", rowNumber));
      const externalId = text(raw, "invoice_id", rowNumber);
      const quantity = toBase(raw, "quantity", rowNumber);
      return {
        kind,
        rowNumber,
        logicalId: logical(sourceSystem, externalId),
        sourceSystem,
        externalId,
        references: [{ kind: "orders", logicalId: orderLogicalId }],
        props: {
          orderLogicalId,
          commodity: text(raw, "commodity", rowNumber),
          sourceUnit: quantity.unit,
          sourceQuantity: quantity.source,
          baseUnit: quantity.baseUnit,
          quantity: quantity.base,
          unitPriceCentsPer1000: whole(raw, "unit_price_cents", rowNumber),
          totalCents: whole(raw, "total_cents", rowNumber),
          currency: text(raw, "currency", rowNumber),
          recordedAt: timestamp(raw, "recorded_at", rowNumber),
        },
      };
    }
    case "deliveries": {
      const sourceSystem = text(raw, "source_system", rowNumber);
      const orderLogicalId = logical(sourceSystem, text(raw, "order_id", rowNumber));
      const externalId = text(raw, "receipt_id", rowNumber);
      const quantity = toBase(raw, "quantity_received", rowNumber);
      return {
        kind,
        rowNumber,
        logicalId: logical(sourceSystem, externalId),
        sourceSystem,
        externalId,
        references: [{ kind: "orders", logicalId: orderLogicalId }],
        props: {
          orderLogicalId,
          commodity: text(raw, "commodity", rowNumber),
          sourceUnit: quantity.unit,
          sourceQuantityReceived: quantity.source,
          baseUnit: quantity.baseUnit,
          quantityReceived: quantity.base,
          receivedAt: timestamp(raw, "received_at", rowNumber),
          handoverAt: timestamp(raw, "handover_at", rowNumber),
          moisturePermille: optionalWhole(raw, "moisture_permille", rowNumber),
          acceptanceResult: oneOf(raw, "acceptance_result", rowNumber, ["PASS", "FAIL", "NOT_TESTED"] as const),
        },
      };
    }
    case "incidents": {
      const sourceSystem = text(raw, "source_system", rowNumber);
      const orderLogicalId = logical(sourceSystem, text(raw, "order_id", rowNumber));
      const externalId = text(raw, "incident_id", rowNumber);
      const affectedKg = whole(raw, "affected_quantity_kg", rowNumber);
      const documents = raw.documents;
      if (!Array.isArray(documents) || documents.length === 0) fail(rowNumber, "documents", "at least 1 document is required.");
      return {
        kind,
        rowNumber,
        logicalId: logical(sourceSystem, externalId),
        sourceSystem,
        externalId,
        references: [{ kind: "orders", logicalId: orderLogicalId }],
        props: {
          orderLogicalId,
          reportedAt: timestamp(raw, "reported_at", rowNumber),
          sourceAffectedQuantity: affectedKg,
          baseUnit: "g",
          affectedQuantity: affectedKg * 1000,
          documents: documents.map((document: unknown, index) => {
            if (typeof document !== "object" || document === null) fail(rowNumber, `documents[${index}]`, "must be an object.");
            const doc = document as Raw;
            return {
              documentId: text(doc, "document_id", rowNumber),
              authorRole: text(doc, "author_role", rowNumber),
              recordedAt: timestamp(doc, "recorded_at", rowNumber),
              text: text(doc, "text", rowNumber),
            };
          }),
        },
      };
    }
  }
}

/** Parses and validates every row of 1 file. The script and the Action both call it (D4 "Validation"). */
export function parseEvidenceRows(kind: EvidenceKind, rows: readonly unknown[]): AnyEvidenceRow[] {
  if (!(EVIDENCE_KINDS as readonly string[]).includes(kind)) {
    throw new DomainError("UNKNOWN_KIND", `"${String(kind)}" is not an evidence kind.`);
  }
  return rows.map((row, index) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) fail(index + 1, "(row)", "must be an object.");
    return parseRow(kind, row as Raw, index + 1);
  });
}

/** Canonical JSON: object keys sorted at every level, no spaces. The content digest is SHA-256 of this text (D4). */
export function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map((item: Json) => canonicalJson(item)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as { readonly [key: string]: Json };
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key] as Json)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export const versionIdOf = (logicalId: string, digest: string): string => `${logicalId}@${digest.slice(0, 12)}`;

// ---------------------------------------------------------------------------------------------------------------
// D4 identity rules.

export interface StoredVersion {
  readonly versionId: string;
  readonly contentDigest: string;
  readonly supersedesVersionId: string | null;
}

export type RowOutcome =
  | { readonly result: "ACCEPTED" }
  | { readonly result: "REPLAYED" }
  | { readonly result: "VERSIONED"; readonly supersedesVersionId: string }
  | { readonly result: "CONFLICTING"; readonly stored: boolean }
  | { readonly result: "UNMATCHED"; readonly missing: readonly string[] };

export interface PlannedRow {
  readonly row: AnyEvidenceRow;
  readonly digest: string;
  readonly versionId: string;
  readonly outcome: RowOutcome;
}

export interface ImportPlan {
  readonly rows: readonly PlannedRow[];
  readonly counts: {
    readonly inputRows: number;
    readonly accepted: number;
    readonly replayed: number;
    readonly versioned: number;
    readonly conflicting: number;
    readonly unmatched: number;
  };
  /** D6.7: true only when the batch stores a new row or a new version. Then the evidence revision rises. */
  readonly changesEvidence: boolean;
}

/** The versions that no other version supersedes. More than 1 means a conflict. */
export function heads(versions: readonly StoredVersion[]): StoredVersion[] {
  const superseded = new Set(versions.flatMap((version) => (version.supersedesVersionId === null ? [] : [version.supersedesVersionId])));
  return versions.filter((version) => !superseded.has(version.versionId));
}

/**
 * D4: classifies every row of 1 batch against what is stored. Rows are applied in file order, so a row may
 * depend on an earlier row of the same batch. `known` holds the stored logical IDs that references may name.
 */
export function planImport(input: {
  readonly rows: readonly AnyEvidenceRow[];
  /** SHA-256 of `canonicalJson(row.props)`, for each row, in the same order. */
  readonly digests: readonly string[];
  /** The stored versions of each logical ID that a row names. */
  readonly stored: ReadonlyMap<string, readonly StoredVersion[]>;
  readonly known: Readonly<Record<Reference["kind"], ReadonlySet<string>>>;
}): ImportPlan {
  if (input.digests.length !== input.rows.length) {
    throw new DomainError("DIGEST_COUNT", "Each row needs exactly 1 digest.");
  }
  const stored = new Map(input.stored);
  const known = {
    expansion: new Set(input.known.expansion),
    suppliers: new Set(input.known.suppliers),
    orders: new Set(input.known.orders),
  };
  const counts = { inputRows: input.rows.length, accepted: 0, replayed: 0, versioned: 0, conflicting: 0, unmatched: 0 };
  let changesEvidence = false;

  const planned = input.rows.map((row, index): PlannedRow => {
    const digest = input.digests[index] as string;
    const versionId = versionIdOf(row.logicalId, digest);
    const missing = row.references.filter((reference) => !known[reference.kind].has(reference.logicalId));
    let outcome: RowOutcome;
    if (missing.length > 0) {
      outcome = { result: "UNMATCHED", missing: missing.map((reference) => reference.logicalId) };
    } else {
      const versions = stored.get(row.logicalId) ?? [];
      const rules = KIND_RULES[row.kind];
      const current = heads(versions);
      const newest = current.at(-1);
      if (versions.some((version) => version.contentDigest === digest)) outcome = { result: "REPLAYED" };
      else if (newest === undefined) outcome = { result: "ACCEPTED" };
      else if (rules.onChange === "VERSION" && current.length === 1) outcome = { result: "VERSIONED", supersedesVersionId: newest.versionId };
      else outcome = { result: "CONFLICTING", stored: rules.versioned };
    }

    const stores = outcome.result === "ACCEPTED" || outcome.result === "VERSIONED" || (outcome.result === "CONFLICTING" && outcome.stored);
    if (stores) {
      changesEvidence = true;
      const supersedesVersionId = outcome.result === "VERSIONED" ? outcome.supersedesVersionId : null;
      stored.set(row.logicalId, [...(stored.get(row.logicalId) ?? []), { versionId, contentDigest: digest, supersedesVersionId }]);
      if (row.kind === "expansion" || row.kind === "suppliers" || row.kind === "orders") known[row.kind].add(row.logicalId);
    }
    if (outcome.result === "ACCEPTED") counts.accepted += 1;
    if (outcome.result === "REPLAYED") counts.replayed += 1;
    if (outcome.result === "VERSIONED") counts.versioned += 1;
    if (outcome.result === "CONFLICTING") counts.conflicting += 1;
    if (outcome.result === "UNMATCHED") counts.unmatched += 1;
    return { row, digest, versionId, outcome };
  });

  return { rows: planned, counts, changesEvidence };
}
