/**
 * The data studio's pure row logic (UI3 A): files to rows, and stored records back to their domain props, so
 * `sourceRowOf` can write a stored record's source row again. No Foundry client here, so node scripts can test it.
 */
import { namespaceRow, type DeliveryProps, type EditableKind, type EvidenceKind, type IncidentProps, type InvoiceProps, type OrderProps, type PaymentProps, type ProfileProps } from "@clearspend/domain";

// ---------------------------------------------------------------------------------------------------------------
// Files.

/** RFC 4180 with a header row: quoted fields, doubled quotes, and line breaks inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      record.push(field);
      records.push(record);
      field = "";
      record = [];
    } else field += char;
  }
  if (quoted) throw new Error("The CSV ends inside a quoted field.");
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [header, ...rows] = records.filter((r) => !(r.length === 1 && r[0] === ""));
  if (header === undefined) return [];
  return rows.map((row, index) => {
    if (row.length !== header.length) throw new Error(`CSV row ${index + 1} has ${row.length} fields; the header has ${header.length}.`);
    return Object.fromEntries(header.map((name, column) => [name, row[column] ?? ""]));
  });
}

export function readRows(fileName: string, text: string): Record<string, unknown>[] {
  if (fileName.endsWith(".json")) {
    const value = JSON.parse(text) as unknown;
    if (!Array.isArray(value)) throw new Error(`${fileName} is not a JSON list of rows.`);
    return value as Record<string, unknown>[];
  }
  return parseCsv(text);
}

/** The kind of a file, from the column that names its records. Null when no kind matches. */
export function kindOfColumns(columns: readonly string[]): EvidenceKind | "field-verifications" | null {
  const has = (name: string) => columns.includes(name);
  if (has("verification_id")) return "field-verifications";
  if (has("receipt_id")) return "deliveries";
  if (has("incident_id")) return "incidents";
  if (has("payment_id")) return "payments";
  if (has("invoice_id")) return "invoices";
  if (has("order_id") && has("supplier_id")) return "orders";
  if (has("quoted_price_cents_per_kg")) return "supplier-profiles";
  if (has("route") && has("supplier_id")) return "suppliers";
  if (has("planned_per_month")) return "expansion-commodities";
  if (has("visibility_level")) return "expansion";
  return null;
}

/** "EXP-ANDROY-2026-DEMO" → "demo". Null for the base expansion, whose rows carry no namespace. */
export function namespaceOf(expansionId: string): string | null {
  const match = /^EXP-ANDROY-2026-([A-Z][A-Z0-9]*)$/.exec(expansionId);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Adds the namespace to rows that do not carry one yet. A row that already has `<namespace>/` is unchanged. */
export function inNamespace(rows: readonly Record<string, unknown>[], namespace: string | null): Record<string, unknown>[] {
  return rows.map((row) => (typeof row.source_system === "string" && row.source_system.includes("/") ? { ...row } : namespaceRow(row, namespace)));
}

// ---------------------------------------------------------------------------------------------------------------
// Stored records as the domain's props, so a stored record becomes its source row again (sourceRowOf).

/** Foundry returns timestamps with milliseconds; the source rows have none. */
const time = (value: unknown): string => (typeof value === "string" ? value : "").replace(/\.000Z$/, "Z");
const whole = (value: unknown): number => Number(value);
const orNull = (value: unknown): number | null => (value === undefined || value === null ? null : Number(value));
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** A stored evidence object by its property API names: an OSDK instance in the browser, a REST object in a script. */
export type StoredObject = { readonly [property: string]: unknown };

export function propsOf(kind: EditableKind, object: StoredObject): OrderProps | PaymentProps | InvoiceProps | DeliveryProps | IncidentProps | ProfileProps {
  switch (kind) {
    case "orders": {
      const o = object;
      return {
        expansionId: text(o.expansionId),
        supplierLogicalId: text(o.supplierLogicalId),
        commodity: text(o.commodity),
        sourceUnit: text(o.sourceUnit),
        sourceQuantity: whole(o.sourceQuantity),
        baseUnit: o.baseUnit as OrderProps["baseUnit"],
        quantity: whole(o.quantity),
        unitPriceCentsPer1000: whole(o.unitPriceCentsPer1000),
        totalCents: whole(o.totalCents),
        currency: text(o.currency),
        replacesOrderLogicalId: typeof o.replacesOrderLogicalId === "string" ? o.replacesOrderLogicalId : null,
        replacesIncidentLogicalId: typeof o.replacesIncidentLogicalId === "string" ? o.replacesIncidentLogicalId : null,
        recordedAt: time(o.recordedAt),
      };
    }
    case "payments": {
      const p = object;
      return { orderLogicalId: text(p.orderLogicalId), amountCents: whole(p.amountCents), currency: text(p.currency), paidAt: time(p.paidAt) };
    }
    case "invoices": {
      const v = object;
      return {
        orderLogicalId: text(v.orderLogicalId),
        commodity: text(v.commodity),
        sourceUnit: text(v.sourceUnit),
        sourceQuantity: whole(v.sourceQuantity),
        baseUnit: v.baseUnit as InvoiceProps["baseUnit"],
        quantity: whole(v.quantity),
        unitPriceCentsPer1000: whole(v.unitPriceCentsPer1000),
        totalCents: whole(v.totalCents),
        currency: text(v.currency),
        recordedAt: time(v.recordedAt),
      };
    }
    case "deliveries": {
      const d = object;
      return {
        orderLogicalId: text(d.orderLogicalId),
        commodity: text(d.commodity),
        sourceUnit: text(d.sourceUnit),
        sourceQuantityReceived: whole(d.sourceQuantityReceived),
        baseUnit: d.baseUnit as DeliveryProps["baseUnit"],
        quantityReceived: whole(d.quantityReceived),
        receivedAt: time(d.receivedAt),
        handoverAt: time(d.handoverAt),
        moisturePermille: orNull(d.moisturePermille),
        acceptanceResult: d.acceptanceResult as DeliveryProps["acceptanceResult"],
      };
    }
    case "incidents": {
      const i = object;
      return {
        orderLogicalId: text(i.orderLogicalId),
        reportedAt: time(i.reportedAt),
        sourceAffectedQuantity: whole(i.sourceAffectedQuantity),
        baseUnit: i.baseUnit as IncidentProps["baseUnit"],
        affectedQuantity: whole(i.affectedQuantity),
        documents: ((i.documents ?? []) as StoredObject[]).map((d) => ({ documentId: text(d.documentId), authorRole: text(d.authorRole), recordedAt: time(d.recordedAt), text: text(d.text) })),
      };
    }
    case "supplier-profiles": {
      const s = object;
      return {
        supplierLogicalId: text(s.supplierLogicalId),
        commodity: text(s.commodity),
        language: text(s.language),
        text: text(s.text),
        quotedCentsPer1000: whole(s.quotedCentsPer1000),
        sourceClaimedCapacityPerMonth: whole(s.sourceClaimedCapacityPerMonth),
        claimedCapacityPerMonth: whole(s.claimedCapacityPerMonth),
        submittedAt: time(s.submittedAt),
      };
    }
  }
}

