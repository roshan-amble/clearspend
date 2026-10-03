/**
 * The Cs object types of D3 that Phase 2 needs, with every property.
 * This file is the source for the Palantir MCP calls, the empty backing datasets, and the import field mapping.
 *
 * Phase 3 and 4 (added 2026-09-30, after D7 and D8): CsAiRun, CsFieldVerification, CsOutreachMessage.
 *
 * Conventions:
 * - Property ID and dataset column: snake_case. API name: camelCase.
 * - Money: integer USD cents. Quantities: whole grams or millilitres (`base_unit`). The source value and unit
 *   stay next to the normalized value (brief section 7).
 * - An exact ratio is text "numerator/denominator", never a double (CLAUDE.md hard rules).
 * - A reference to versioned evidence (an order, a payment) holds the logical ID `sourceSystem:externalId`.
 *   It is a filter, not a Foundry link type, because a link type must point at a primary key, and a versioned
 *   type's primary key is its version ID.
 */

export type PropertyKind =
  | "string"
  | "longText"
  | "integer"
  | "long"
  | "boolean"
  | "date"
  | "timestamp"
  | "stringArray"
  | "documentArray";

export interface PropertySpec {
  readonly id: string;
  readonly kind: PropertyKind;
  readonly nullable: boolean;
  readonly description: string;
  /** The fixture column or JSON field that fills this property, when it comes straight from the source. */
  readonly source?: string;
  /**
   * No dataset column: only Actions write it. Set for a property added after its type's backing dataset was
   * created, because Palantir MCP cannot add a column to an existing dataset. Arrays are always edit-only.
   */
  readonly editOnly?: true;
}

export interface ObjectTypeSpec {
  readonly apiName: string;
  readonly displayName: string;
  readonly pluralDisplayName: string;
  readonly description: string;
  readonly icon: string;
  readonly primaryKey: string;
  readonly title: string;
  /**
   * Set when an existing dataset backs this type, and its columns keep their source names.
   * Otherwise an empty dataset backs it, with 1 column for each property ID, and Actions write the objects.
   */
  readonly existingDataset?: string;
  /** The fixture file that the import Action reads for this type, if any. */
  readonly fixture?: string;
  /** Fixture columns that no property stores, with the reason. */
  readonly droppedSourceFields?: Readonly<Record<string, string>>;
  readonly properties: readonly PropertySpec[];
}

/** Fields of the struct in `CsIncident.documents`. */
export const DOCUMENT_FIELDS = [
  { apiName: "documentId", kind: "string" },
  { apiName: "authorRole", kind: "string" },
  { apiName: "recordedAt", kind: "timestamp" },
  { apiName: "text", kind: "string" },
] as const;

const p = (
  id: string,
  kind: PropertyKind,
  description: string,
  options: { nullable?: boolean; source?: string; editOnly?: true } = {},
): PropertySpec => ({
  id,
  kind,
  nullable: options.nullable ?? false,
  description,
  ...(options.source === undefined ? {} : { source: options.source }),
  ...(options.editOnly === undefined ? {} : { editOnly: options.editOnly }),
});

/** Every evidence row carries these (D3, D4). */
const evidenceIdentity = (externalIdSource: string): PropertySpec[] => [
  p("version_id", "string", "Primary key: logicalId@first 12 characters of the content digest (D4)."),
  p("logical_id", "string", "sourceSystem:externalId (D4)."),
  p("source_system", "string", "The system that exported the row.", { source: "source_system" }),
  p("external_id", "string", "The ID in the source system.", { source: externalIdSource }),
  p("content_digest", "string", "SHA-256 of the canonical JSON of the business fields. No import time (D4)."),
  p("supersedes_version_id", "string", "The version that this version replaces in the active set.", { nullable: true }),
  p("import_batch_id", "string", "The CsImportBatch that stored this row."),
  p("imported_at", "timestamp", "When the import Action stored this row. Not part of the digest."),
];

const quantityPair = (sourceColumn: string, name: string): PropertySpec[] => [
  p("source_unit", "string", "The unit as written in the source, for example kg or L.", { source: "unit" }),
  p(`source_${name}`, "long", "The quantity as written in the source, in source units.", { source: sourceColumn }),
  p("base_unit", "string", "g or ml."),
  p(name, "long", "The quantity in whole grams or millilitres."),
];

export const OBJECT_TYPES: readonly ObjectTypeSpec[] = [
  {
    apiName: "CsExpansion",
    displayName: "Cs Expansion",
    pluralDisplayName: "Cs Expansions",
    description: "ClearSpend: 1 school meal expansion. The anchor object that every write Action touches (D3 principle 4).",
    icon: "flag",
    primaryKey: "expansion_id",
    title: "name",
    fixture: "expansion.csv",
    properties: [
      p("expansion_id", "string", "Primary key.", { source: "expansion_id" }),
      p("name", "string", "Display name.", { source: "name" }),
      p("region", "string", "Admin 1 region, for example Androy.", { source: "region" }),
      p("ration_version", "integer", "The current ration specification version.", { source: "ration_version" }),
      p("period_start", "date", "First day of the expansion period.", { source: "period_start" }),
      p("period_end", "date", "Last day of the expansion period.", { source: "period_end" }),
      p("visibility_level", "string", "Who can see paid prices (brief section 14).", { source: "visibility_level" }),
      p("evidence_revision", "long", "Mutable. Plus 1 for each successful evidence batch (D4)."),
      p("state_version", "long", "Mutable. Plus 1 for each write Action. The revision guard (D6)."),
      p("current_snapshot_id", "string", "Mutable. The CsCostSnapshot of the current evidence revision.", { nullable: true }),
      p("import_batch_id", "string", "The CsImportBatch that created this expansion.", { nullable: true }),
    ],
  },
  {
    apiName: "CsExpansionCommodity",
    displayName: "Cs Expansion Commodity",
    pluralDisplayName: "Cs Expansion Commodities",
    description: "ClearSpend: 1 food in an expansion's ration, with its need and its public market series.",
    icon: "shopping-cart",
    primaryKey: "expansion_commodity_id",
    title: "commodity",
    fixture: "expansion-commodities.csv",
    properties: [
      p("expansion_commodity_id", "string", "Primary key: expansionId:commodity."),
      p("expansion_id", "string", "The CsExpansion.", { source: "expansion_id" }),
      p("commodity", "string", "RICE, BEANS, or OIL.", { source: "commodity" }),
      p("base_unit", "string", "g or ml.", { source: "unit" }),
      p("quantity_per_meal", "long", "Base units in 1 meal.", { source: "quantity_per_meal" }),
      p("max_moisture_permille", "integer", "Ration spec maximum. Null when moisture does not apply.", {
        nullable: true,
        source: "max_moisture_permille",
      }),
      p("planned_per_month", "long", "Planned need in base units each month.", { source: "planned_per_month" }),
      p("market_volume_estimate_per_month", "long", "Synthetic market volume in base units each month.", {
        source: "market_volume_estimate_per_month",
      }),
      p("market_volume_label", "string", "Always synthetic in v1.", { source: "market_volume_label" }),
      p("market_series_local", "string", "WFP series name for the local route.", { source: "market_series_local" }),
      p("market_series_import", "string", "WFP series name for the import route.", { source: "market_series_import" }),
      p("import_batch_id", "string", "The CsImportBatch that created this row.", { nullable: true }),
      p("target_cents_per_1000", "long", "UI4: a declared budget, cents per 1,000 base units. Display only, never in the cost model.", { nullable: true, editOnly: true }),
      p("target_set_by", "string", "The Foundry user who set the target.", { nullable: true, editOnly: true }),
      p("target_set_at", "timestamp", "When the target was set.", { nullable: true, editOnly: true }),
    ],
  },
  {
    apiName: "CsSupplier",
    displayName: "Cs Supplier",
    pluralDisplayName: "Cs Suppliers",
    description: "ClearSpend: a supplier on the import route or a local lead. Fictional names only.",
    icon: "office",
    primaryKey: "logical_id",
    title: "name",
    fixture: "suppliers.csv",
    properties: [
      p("logical_id", "string", "Primary key: sourceSystem:supplierId (D3)."),
      p("source_system", "string", "The system that exported the row.", { source: "source_system" }),
      p("external_id", "string", "The supplier ID in the source system.", { source: "supplier_id" }),
      p("name", "string", "Supplier name.", { source: "name" }),
      p("route", "string", "IMPORT or LOCAL.", { source: "route" }),
      p("country", "string", "ISO country code.", { source: "country" }),
      p("content_digest", "string", "SHA-256 of the canonical JSON of the business fields."),
      p("import_batch_id", "string", "The CsImportBatch that stored this row."),
      p("imported_at", "timestamp", "When the import Action stored this row."),
    ],
  },
  {
    apiName: "CsSupplierProfileVersion",
    displayName: "Cs Supplier Profile Version",
    pluralDisplayName: "Cs Supplier Profile Versions",
    description: "ClearSpend: 1 version of a supplier's own profile text and quote. Untrusted input for AI extraction.",
    icon: "document",
    primaryKey: "version_id",
    title: "external_id",
    fixture: "supplier-profiles.json",
    properties: [
      ...evidenceIdentity("supplier_id"),
      p("supplier_logical_id", "string", "The CsSupplier."),
      p("commodity", "string", "The quoted food.", { source: "commodity" }),
      p("language", "string", "ISO language code of the text.", { source: "language" }),
      p("text", "longText", "The profile as submitted. Never instructions to the model (brief section 9).", {
        source: "text",
      }),
      p("quoted_cents_per_1000", "long", "Quoted USD cents for each kilogram or litre.", {
        source: "quoted_price_cents_per_kg",
      }),
      p("source_claimed_capacity_per_month", "long", "Claimed capacity as submitted, in kilograms.", {
        source: "claimed_capacity_kg_per_month",
      }),
      p("claimed_capacity_per_month", "long", "Claimed capacity in base units. A claim, not a verified fact."),
      p("submitted_at", "timestamp", "When the supplier submitted the profile.", { source: "submitted_at" }),
    ],
  },
  {
    apiName: "CsPurchaseOrder",
    displayName: "Cs Purchase Order",
    pluralDisplayName: "Cs Purchase Orders",
    description: "ClearSpend: 1 version of a purchase order, as imported. ClearSpend never creates an order.",
    icon: "shopping-cart",
    primaryKey: "version_id",
    title: "external_id",
    fixture: "orders.csv",
    properties: [
      ...evidenceIdentity("order_id"),
      p("expansion_id", "string", "The CsExpansion.", { source: "expansion_id" }),
      p("supplier_logical_id", "string", "The CsSupplier.", { source: "supplier_id" }),
      p("commodity", "string", "The ordered food.", { source: "commodity" }),
      ...quantityPair("quantity", "quantity"),
      p("unit_price_cents_per_1000", "long", "USD cents for each kilogram or litre.", { source: "unit_price_cents" }),
      p("total_cents", "long", "Order total in USD cents, as written in the source.", { source: "total_cents" }),
      p("currency", "string", "Source currency. Anything but USD is an UNSUPPORTED_CASE finding.", {
        source: "currency",
      }),
      p("replaces_order_logical_id", "string", "Set on a replacement purchase.", {
        nullable: true,
        source: "replaces_order_id",
      }),
      p("replaces_incident_logical_id", "string", "The loss that a replacement purchase replaces, when needed.", {
        nullable: true,
        source: "replaces_incident_id",
      }),
      p("recorded_at", "timestamp", "When the source recorded the order.", { source: "recorded_at" }),
    ],
  },
  {
    apiName: "CsPayment",
    displayName: "Cs Payment",
    pluralDisplayName: "Cs Payments",
    description: "ClearSpend: 1 version of a payment, as imported. A changed payment is a conflict, never a new version (D4).",
    icon: "dollar",
    primaryKey: "version_id",
    title: "external_id",
    fixture: "payments.csv",
    properties: [
      ...evidenceIdentity("payment_id"),
      p("order_logical_id", "string", "The purchase order's logical ID.", { source: "order_id" }),
      p("amount_cents", "long", "Paid USD cents.", { source: "amount_cents" }),
      p("currency", "string", "Source currency.", { source: "currency" }),
      p("paid_at", "timestamp", "When the payment was made.", { source: "paid_at" }),
    ],
  },
  {
    apiName: "CsInvoice",
    displayName: "Cs Invoice",
    pluralDisplayName: "Cs Invoices",
    description: "ClearSpend: 1 version of a supplier invoice, as imported.",
    icon: "document",
    primaryKey: "version_id",
    title: "external_id",
    fixture: "invoices.csv",
    properties: [
      ...evidenceIdentity("invoice_id"),
      p("order_logical_id", "string", "The purchase order's logical ID.", { source: "order_id" }),
      p("commodity", "string", "The invoiced food.", { source: "commodity" }),
      ...quantityPair("quantity", "quantity"),
      p("unit_price_cents_per_1000", "long", "USD cents for each kilogram or litre.", { source: "unit_price_cents" }),
      p("total_cents", "long", "Invoice total in USD cents.", { source: "total_cents" }),
      p("currency", "string", "Source currency.", { source: "currency" }),
      p("recorded_at", "timestamp", "When the source recorded the invoice.", { source: "recorded_at" }),
    ],
  },
  {
    apiName: "CsDelivery",
    displayName: "Cs Delivery",
    pluralDisplayName: "Cs Deliveries",
    description: "ClearSpend: 1 version of a delivery receipt with its acceptance test. A correction replaces it (D4).",
    icon: "truck",
    primaryKey: "version_id",
    title: "external_id",
    fixture: "deliveries.csv",
    properties: [
      ...evidenceIdentity("receipt_id"),
      p("order_logical_id", "string", "The purchase order's logical ID.", { source: "order_id" }),
      p("commodity", "string", "The delivered food.", { source: "commodity" }),
      ...quantityPair("quantity_received", "quantity_received"),
      p("received_at", "timestamp", "When the program received the batch.", { source: "received_at" }),
      p("handover_at", "timestamp", "When responsibility passed from the supplier to the program.", {
        source: "handover_at",
      }),
      p("moisture_permille", "integer", "Measured moisture. Null when not measured.", {
        nullable: true,
        source: "moisture_permille",
      }),
      p("acceptance_result", "string", "PASS, FAIL, or NOT_TESTED.", { source: "acceptance_result" }),
    ],
  },
  {
    apiName: "CsIncident",
    displayName: "Cs Incident",
    pluralDisplayName: "Cs Incidents",
    description: "ClearSpend: 1 version of a reported loss with its source documents. Documents are untrusted model input.",
    icon: "warning-sign",
    primaryKey: "version_id",
    title: "external_id",
    fixture: "incidents.json",
    properties: [
      ...evidenceIdentity("incident_id"),
      p("order_logical_id", "string", "The purchase order's logical ID.", { source: "order_id" }),
      p("reported_at", "timestamp", "When the incident was reported.", { source: "reported_at" }),
      p("source_affected_quantity", "long", "Affected quantity as written in the source, in kilograms.", {
        source: "affected_quantity_kg",
      }),
      p("base_unit", "string", "g or ml."),
      p("affected_quantity", "long", "Affected quantity in base units."),
      p("documents", "documentArray", "The source documents: ID, author role, time, and text.", {
        source: "documents",
      }),
    ],
  },
  {
    apiName: "CsMarketPrice",
    displayName: "Cs Market Price",
    pluralDisplayName: "Cs Market Prices",
    description: "ClearSpend: 1 monthly WFP retail price for 1 market and series. Source: WFP, via HDX (CC BY-IGO).",
    icon: "timeline-line-chart",
    primaryKey: "price_id",
    title: "price_id",
    existingDataset: "cs_market_price",
    properties: [
      p("price_id", "string", "Primary key: marketId:series:date.", { source: "price_id" }),
      p("date", "date", "The month of the observation, as published.", { source: "date" }),
      p("admin1", "string", "Region.", { source: "admin1" }),
      p("admin2", "string", "District.", { source: "admin2" }),
      p("market", "string", "Market name.", { source: "market" }),
      p("market_id", "string", "WFP market ID.", { source: "market_id" }),
      p("series", "string", "WFP commodity series name.", { source: "commodity" }),
      p("unit", "string", "KG or L.", { source: "unit" }),
      p("price_type", "string", "Retail.", { source: "pricetype" }),
      p("currency", "string", "Local currency of the local price.", { source: "currency" }),
      p("local_price_text", "string", "Local price as published.", { source: "price" }),
      p("usd_price_text", "string", "USD price as published.", { source: "usdprice" }),
      p("usd_price_micros", "long", "Exact USD price in micro-dollars.", { source: "usd_price_micros" }),
      p("source_url", "string", "The HDX dataset page.", { source: "source_url" }),
      p("downloaded_at", "date", "When Roshan downloaded the file.", { source: "downloaded_at" }),
    ],
  },
  {
    apiName: "CsImportBatch",
    displayName: "Cs Import Batch",
    pluralDisplayName: "Cs Import Batches",
    description: "ClearSpend: the report of 1 applied evidence file. Replays, conflicts, and unmatched rows stay visible.",
    icon: "import",
    primaryKey: "import_batch_id",
    title: "file_name",
    properties: [
      p("import_batch_id", "string", "Primary key: expansionId:fileDigest. The same file again is REPLAYED (D6.7)."),
      p("expansion_id", "string", "The CsExpansion."),
      p("file_name", "string", "The fixture file name."),
      p("file_kind", "string", "suppliers, profiles, orders, payments, invoices, deliveries, or incidents."),
      p("file_digest", "string", "SHA-256 of the file bytes."),
      p("imported_at", "timestamp", "When the Action applied the batch."),
      p("actor_user_id", "string", "The Foundry user who applied the batch."),
      p("input_rows", "integer", "Rows in the file."),
      p("accepted", "integer", "New logical records stored."),
      p("replayed", "integer", "Same logical ID and same digest. Not stored again."),
      p("versioned", "integer", "New versions that supersede an earlier version."),
      p("conflicting", "integer", "Changed payments, stored as conflicts."),
      p("unmatched", "integer", "Rows that reference an unknown ID. Not stored."),
      p("report_json", "longText", "The row-level report: row number, logical ID, result, and reason."),
      p("evidence_revision_after", "long", "The evidence revision that this batch created. Unchanged when it stored nothing new (D6.7)."),
    ],
  },
  {
    apiName: "CsCostSnapshot",
    displayName: "Cs Cost Snapshot",
    pluralDisplayName: "Cs Cost Snapshots",
    description: "ClearSpend: the calculated results for 1 evidence revision. Immutable.",
    icon: "calculator",
    primaryKey: "snapshot_id",
    title: "snapshot_id",
    properties: [
      p("snapshot_id", "string", "Primary key: expansionId@revision."),
      p("expansion_id", "string", "The CsExpansion."),
      p("evidence_revision", "long", "The evidence revision that this snapshot calculates."),
      p("rules_version", "string", "The version of packages/domain that calculated it."),
      p("created_at", "timestamp", "When the Action calculated it."),
      p("market_indicators_json", "longText", "Market pressure and price change for each series, as exact ratios."),
      p("market_data_as_of", "string", "The latest market month used, YYYY-MM (D6, I8).", { editOnly: true }),
      p("purchases_json", "longText", "Each purchase's reconciliation status and every finding (Screen B). Null before function 0.1.1.", { nullable: true, editOnly: true }),
      p("incidents_json", "longText", "Each incident's cause status and the cause the cost model used (Screen B). Null before function 0.1.1.", { nullable: true, editOnly: true }),
    ],
  },
  {
    apiName: "CsCostLine",
    displayName: "Cs Cost Line",
    pluralDisplayName: "Cs Cost Lines",
    description: "ClearSpend: the cost of 1 supplier or route for 1 food in 1 snapshot (D11). Immutable.",
    icon: "th-list",
    primaryKey: "cost_line_id",
    title: "cost_line_id",
    properties: [
      p("cost_line_id", "string", "Primary key: snapshotId:supplierLogicalId:commodity."),
      p("snapshot_id", "string", "The CsCostSnapshot."),
      p("expansion_id", "string", "The CsExpansion."),
      p("supplier_logical_id", "string", "The CsSupplier."),
      p("route", "string", "IMPORT or LOCAL."),
      p("commodity", "string", "The food."),
      p("nominal_exact", "string", "USD cents for each base unit, as n/d. Null with no reconciled purchase.", {
        nullable: true,
      }),
      p("supplier_low_exact", "string", "C3 supplier cost, low bound, as n/d.", { nullable: true }),
      p("supplier_high_exact", "string", "C3 supplier cost, high bound, as n/d.", { nullable: true }),
      p("route_low_exact", "string", "C4 route cost, low bound, as n/d.", { nullable: true }),
      p("route_high_exact", "string", "C4 route cost, high bound, as n/d.", { nullable: true }),
      p("batch_count", "integer", "C6: reconciled batches, including replacements."),
      p("supplier_failures", "integer", "Failures confirmed as the supplier's cause."),
      p("other_failures", "integer", "Failures with another confirmed cause."),
      p("unconfirmed_failures", "integer", "Failures with no confirmed cause. They make a range (C5)."),
      p("failure_risk", "string", "KNOWN, or UNKNOWN with 0 batches (C6)."),
      p("quoted_cents_per_1000", "long", "A local lead's quote for each kilogram or litre.", { nullable: true }),
      p("eligibility", "string", "The supplier's eligibility state (D5)."),
      p("excluded_json", "longText", "C2: purchases left out of the paid cost, with their status."),
      p("ambiguous_replacements", "stringArray", "Replacement orders whose loss cannot be identified."),
      p("per_meal_json", "longText", "Exact cents for 1 meal: nominal, supplier, and route bounds (D11). Null before function 0.1.1.", { nullable: true, editOnly: true }),
    ],
  },
  {
    apiName: "CsCauseProposal",
    displayName: "Cs Cause Proposal",
    pluralDisplayName: "Cs Cause Proposals",
    description: "ClearSpend: a proposed cause for 1 incident version, from a rule or from AI. Never a decision.",
    icon: "lightbulb",
    primaryKey: "proposal_id",
    title: "proposal_id",
    properties: [
      p("proposal_id", "string", "Primary key. Generated on the server."),
      p("expansion_id", "string", "The CsExpansion."),
      p("incident_version_id", "string", "The CsIncident version that this proposal read."),
      p("incident_logical_id", "string", "The incident's logical ID."),
      p("source", "string", "RULE or AI."),
      p("ai_run_id", "string", "The CsAiRun, for an AI proposal.", { nullable: true }),
      p("proposed_cause", "string", "SUPPLIER, TRANSPORT_AFTER_HANDOVER, STORAGE, BUYER, or UNKNOWN."),
      p("citations_json", "longText", "The document or evidence IDs that support the cause."),
      p("conflicts_json", "longText", "Statements in the documents that disagree."),
      p("unknowns_json", "longText", "What the evidence does not say."),
      p("evidence_revision", "long", "The evidence revision that the proposal used."),
      p("created_at", "timestamp", "When the proposal was stored."),
    ],
  },
  {
    apiName: "CsDecision",
    displayName: "Cs Decision",
    pluralDisplayName: "Cs Decisions",
    description: "ClearSpend: 1 decision by a person. Append-only. A later decision supersedes, never edits.",
    icon: "take-action",
    primaryKey: "decision_id",
    title: "decision_id",
    properties: [
      p("decision_id", "string", "Primary key: the caller's requestId. A retry with the same ID is REPLAYED (D6)."),
      p("expansion_id", "string", "The CsExpansion."),
      p("decision_type", "string", "CONFIRM_CAUSE, SELECT_FIELD_VISIT, APPROVE_OUTREACH, REJECT_OUTREACH, SOURCING_DECISION, or SET_TARGET."),
      p("subject_id", "string", "The object that the decision is about, for example an incident's logical ID."),
      p("answers_proposal_id", "string", "The CsCauseProposal that the decision answers.", { nullable: true }),
      p("chosen_cause", "string", "For CONFIRM_CAUSE: the cause that the person chose.", { nullable: true }),
      p("rationale", "longText", "The person's reason, in their words."),
      p("actor_user_id", "string", "The Foundry user who decided."),
      p("created_at", "timestamp", "When the decision was stored."),
      p("evidence_revision", "long", "The evidence revision that the person saw."),
      p("request_digest", "string", "SHA-256 of the canonical command, with the expected counters (D6).", {
        editOnly: true,
      }),
      p("supersedes_decision_id", "string", "The earlier decision that this one supersedes.", { nullable: true }),
      p("target_cents_per_1000", "long", "For SET_TARGET: the declared target, cents per 1,000 base units (UI4).", { nullable: true, editOnly: true }),
    ],
  },
  {
    apiName: "CsAiRun",
    displayName: "Cs AI Run",
    pluralDisplayName: "Cs AI Runs",
    description: "ClearSpend: 1 run of an AI job (D7). Its output is a proposal or an explanation, never a decision.",
    icon: "predictive-analysis",
    primaryKey: "ai_run_id",
    title: "ai_run_id",
    properties: [
      p("ai_run_id", "string", "Primary key: the caller's requestId (D6)."),
      p("expansion_id", "string", "The CsExpansion."),
      p("job", "string", "CAUSE, EXTRACTION, EXPLANATION, or OUTREACH_DRAFT."),
      p("subject_id", "string", "What the job is about: an incident, a supplier, or the expansion."),
      p("subject_version_id", "string", "The version of the subject that the job read.", { nullable: true }),
      p("evidence_revision", "long", "The evidence revision that the job read (I6)."),
      p("logic_function_rid", "string", "The AIP Logic function that called the model."),
      p("logic_function_version", "string", "Its version."),
      p("model", "string", "The model, for example GPT-4o."),
      p("started_at", "timestamp", "When the run started."),
      p("finished_at", "timestamp", "When the run ended."),
      p("status", "string", "SUCCEEDED, INVALID, or FAILED (D7, D8)."),
      p("reasons_json", "longText", "Why a run is INVALID or FAILED. Empty list when it succeeded."),
      p("output_json", "longText", "The validated output. Null unless SUCCEEDED.", { nullable: true }),
      p("input_digest", "string", "SHA-256 of the input that was sent."),
      p("input_truncated", "boolean", "True when an input limit cut the text (D7.4)."),
      p("token_use_json", "longText", "Token use, when the platform reports it.", { nullable: true }),
      p("actor_user_id", "string", "The person who started the run."),
      p("request_digest", "string", "SHA-256 of the canonical command (D6)."),
    ],
  },
  {
    apiName: "CsFieldVerification",
    displayName: "Cs Field Verification",
    pluralDisplayName: "Cs Field Verifications",
    description: "ClearSpend: 1 field visit result, recorded by a field verifier. Evidence: it raises the revision (D4).",
    icon: "clipboard",
    primaryKey: "verification_id",
    title: "verification_id",
    properties: [
      p("verification_id", "string", "Primary key: the caller's requestId (D6)."),
      p("expansion_id", "string", "The CsExpansion."),
      p("supplier_logical_id", "string", "The CsSupplier."),
      p("ration_version", "integer", "The ration version that the visit checked against (C9)."),
      p("visited_at", "timestamp", "When the visit happened."),
      p("result", "string", "PASS or FAIL."),
      p("moisture_permille", "integer", "Measured moisture. Null when not measured.", { nullable: true }),
      p("source_confirmed_capacity_per_month", "long", "Confirmed capacity as written, in kilograms."),
      p("confirmed_capacity_per_month", "long", "Confirmed capacity in base units."),
      p("notes", "longText", "The verifier's notes."),
      p("source_system", "string", "The source of an imported result, for example harbor-field.", { nullable: true }),
      p("external_id", "string", "The source's verification ID.", { nullable: true }),
      p("verifier_user_id", "string", "The Foundry user who recorded it."),
      p("created_at", "timestamp", "When it was recorded."),
      p("evidence_revision", "long", "The evidence revision that this result created (I1)."),
      p("request_digest", "string", "SHA-256 of the canonical command (D6)."),
    ],
  },
  {
    apiName: "CsOutreachMessage",
    displayName: "Cs Outreach Message",
    pluralDisplayName: "Cs Outreach Messages",
    description: "ClearSpend: 1 approved message to a supplier. Sent only as a notification to Roshan's own user (D2, D9).",
    icon: "envelope",
    primaryKey: "message_id",
    title: "message_id",
    properties: [
      p("message_id", "string", "Primary key: the caller's requestId (D6)."),
      p("expansion_id", "string", "The CsExpansion."),
      p("supplier_logical_id", "string", "The CsSupplier."),
      p("ai_run_id", "string", "The CsAiRun of the draft."),
      p("approved_text", "longText", "The text that the person approved."),
      p("status", "string", "NOTIFICATION_REQUESTED (D5, D6.6)."),
      p("approved_by_decision_id", "string", "The APPROVE_OUTREACH CsDecision."),
      p("created_at", "timestamp", "When it was approved."),
    ],
  },
  // Portfolio (Roshan, 2026-10-01: "Portfolio on the core"). Reference rows come from the portfolio generator
  // and are uploaded by script (D2 decision 6); investigations, bookings, and schedule versions come from Actions.
  {
    apiName: "CsCountry",
    displayName: "Cs Country",
    pluralDisplayName: "Cs Countries",
    description: "ClearSpend portfolio: 1 country program and its school meals expansion. Synthetic except Madagascar's market prices.",
    icon: "globe",
    primaryKey: "country_iso3",
    title: "name",
    properties: [
      p("country_iso3", "string", "Primary key: ISO 3166-1 alpha-3 code."),
      p("name", "string", "Country name."),
      p("flag", "string", "Flag emoji, for display."),
      p("program_region", "string", "The region the school meals program serves (the expansion's region)."),
      p("expansion_id", "string", "The CsExpansion of the program."),
      p("status", "string", "ACTIVE (meals served, suppliers in place) or NEW (no supplier yet)."),
      p("schools", "long", "Schools in the program."),
      p("students", "long", "Students fed each school day."),
      p("hub", "string", "Regional hub that fly-in investigators come from: NBO, DKR, JNB, PTY, or BKK."),
      p("currency", "string", "Local currency code."),
      p("synthetic", "boolean", "True when the program figures are generated test data."),
    ],
  },
  {
    apiName: "CsMeal",
    displayName: "Cs Meal",
    pluralDisplayName: "Cs Meals",
    description: "ClearSpend portfolio: 1 ration of a country program (a school meal, a general ration, or a nutrition supplement), with its recipe in grams or millilitres per serving.",
    icon: "cube",
    primaryKey: "meal_id",
    title: "name",
    properties: [
      p("meal_id", "string", "Primary key, for example KEN-M1."),
      p("country_iso3", "string", "The CsCountry."),
      p("expansion_id", "string", "The CsExpansion."),
      p("name", "string", "Ration or meal name."),
      p("servings_per_month", "long", "Rations planned each month: people × days served."),
      p("days_served", "string", "When it is served, for example Mon Wed Fri, or every day."),
      p("ingredients_json", "longText", "Recipe: a JSON list of {commodity, quantity} with whole g or ml per serving."),
      p("activity", "string", "SCHOOL_MEALS, GENERAL_DISTRIBUTION, or NUTRITION_SUPPORT (WFP-style activities, 2026-10-01).", { nullable: true }),
      p("beneficiary_group", "string", "SCHOOL_CHILD, GENERAL_POPULATION, or YOUNG_CHILD: whose nutrient reference applies.", { nullable: true }),
      p("beneficiaries", "long", "People this ration reaches.", { nullable: true }),
    ],
  },
  {
    apiName: "CsInvestigator",
    displayName: "Cs Investigator",
    pluralDisplayName: "Cs Investigators",
    description: "ClearSpend portfolio: 1 field investigator who visits suppliers and markets. Fictional people.",
    icon: "person",
    primaryKey: "investigator_id",
    title: "name",
    properties: [
      p("investigator_id", "string", "Primary key."),
      p("name", "string", "Fictional name."),
      p("home_country_iso3", "string", "Country they live and work in."),
      p("base_city", "string", "City they travel from."),
      p("hub", "string", "Regional hub: NBO, DKR, JNB, PTY, or BKK. Travel between hubs takes longer."),
      p("kind", "string", "LOCAL (works in the home country) or REGIONAL (flies in across the hub)."),
      p("skills", "string", "Space-separated: SUPPLIER_AUDIT MARKET_SURVEY."),
      p("schedule_version", "long", "Raised by each booking, so 2 bookings of 1 person conflict (D6).", { nullable: true, editOnly: true }),
    ],
  },
  {
    apiName: "CsInvestigatorBusy",
    displayName: "Cs Investigator Busy",
    pluralDisplayName: "Cs Investigator Busy Blocks",
    description: "ClearSpend portfolio: 1 block of days when an investigator is not free, inclusive of both dates.",
    icon: "calendar",
    primaryKey: "busy_id",
    title: "busy_id",
    properties: [
      p("busy_id", "string", "Primary key; for a booking, the booking's requestId."),
      p("investigator_id", "string", "The CsInvestigator."),
      p("start_date", "date", "First busy day."),
      p("end_date", "date", "Last busy day."),
      p("reason", "string", "Why: leave, another program, or an investigation booking."),
      p("investigation_id", "string", "The CsInvestigation, for a booking.", { nullable: true }),
    ],
  },
  {
    apiName: "CsInvestigation",
    displayName: "Cs Investigation",
    pluralDisplayName: "Cs Investigations",
    description: "ClearSpend portfolio: a request to check a supplier or a market on the ground, and its booking. A person tags and books it.",
    icon: "search",
    primaryKey: "investigation_id",
    title: "investigation_id",
    properties: [
      p("investigation_id", "string", "Primary key: the tagging request's requestId (D6)."),
      p("expansion_id", "string", "The CsExpansion."),
      p("country_iso3", "string", "The CsCountry."),
      p("subject_type", "string", "SUPPLIER (audit a supplier or lead) or MARKET (survey a market for 1 food)."),
      p("subject_id", "string", "The supplier logical ID, or the commodity for a market survey."),
      p("commodity", "string", "The food concerned."),
      p("reason", "longText", "Why, in the tagging person's words."),
      p("required_skill", "string", "SUPPLIER_AUDIT or MARKET_SURVEY."),
      p("duration_days", "long", "Days on the ground."),
      p("status", "string", "OPEN, SCHEDULED, DONE, or CANCELLED."),
      p("created_by", "string", "The Foundry user who tagged it."),
      p("created_at", "timestamp", "When it was tagged."),
      p("request_digest", "string", "SHA-256 of the canonical tagging command (D6)."),
      p("investigator_id", "string", "The booked CsInvestigator.", { nullable: true }),
      p("travel_days", "long", "Travel days each way for the booking.", { nullable: true }),
      p("on_ground_start", "date", "First day on the ground.", { nullable: true }),
      p("on_ground_end", "date", "Last day on the ground.", { nullable: true }),
      p("booked_by", "string", "The Foundry user who confirmed the booking.", { nullable: true }),
      p("booked_at", "timestamp", "When the booking was confirmed.", { nullable: true }),
    ],
  },
  // Supplier site (Roshan, 2026-10-01, P10 and P11): a supplier's own offer. It counts only after a person accepts it.
  {
    apiName: "CsSupplierBid",
    displayName: "Cs Supplier Bid",
    pluralDisplayName: "Cs Supplier Bids",
    description: "ClearSpend supplier site: a price and monthly quantity that a supplier offers for 1 food in 1 program. It counts as a lead only after a person accepts it.",
    icon: "shop",
    primaryKey: "bid_id",
    title: "business_name",
    properties: [
      p("bid_id", "string", "Primary key: the submitting request's requestId (D6)."),
      p("country_iso3", "string", "The CsCountry the offer is for."),
      p("expansion_id", "string", "The CsExpansion of that country."),
      p("commodity", "string", "The food offered."),
      p("business_name", "string", "The supplier's business name, as entered."),
      p("contact", "string", "Phone or email, as entered."),
      p("delivery_area", "string", "Where the supplier can deliver, as entered."),
      p("price_cents_per_1000", "long", "Offered price in USD cents per 1,000 g (or 1,000 ml for oil): cents per kg or per L."),
      p("source_unit", "string", "kg or L, as entered."),
      p("source_quantity_per_month", "long", "Monthly quantity as entered, in kg or L."),
      p("base_unit", "string", "g or ml."),
      p("quantity_per_month", "long", "Monthly quantity in whole grams or millilitres."),
      p("earliest_start", "date", "First month the supplier can deliver."),
      p("note", "longText", "Anything else the supplier wants to say.", { nullable: true }),
      p("status", "string", "SUBMITTED, ACCEPTED, or REJECTED."),
      p("submitted_by", "string", "The Foundry user who submitted it."),
      p("submitted_at", "timestamp", "When it was submitted."),
      p("request_digest", "string", "SHA-256 of the canonical submit command (D6)."),
      p("reviewed_by", "string", "The Foundry user who accepted or rejected it.", { nullable: true }),
      p("reviewed_at", "timestamp", "When it was reviewed.", { nullable: true }),
      p("review_note", "longText", "Why, in the reviewer's words.", { nullable: true }),
    ],
  },
];

/**
 * A one-to-many Foundry link type: `foreignKey` on the `many` type holds the primary key of the `one` type.
 * Only targets without versions, or a specific version, can be the `one` side (see the file header).
 */
export interface LinkTypeSpec {
  readonly id: string;
  readonly one: string;
  readonly many: string;
  readonly foreignKey: string;
  /** API names as seen from each side. */
  readonly toMany: string;
  readonly toOne: string;
}

export const LINK_TYPES: readonly LinkTypeSpec[] = [
  { id: "cs-expansion-commodities", one: "CsExpansion", many: "CsExpansionCommodity", foreignKey: "expansion_id", toMany: "commodities", toOne: "expansion" },
  { id: "cs-expansion-purchase-orders", one: "CsExpansion", many: "CsPurchaseOrder", foreignKey: "expansion_id", toMany: "purchaseOrders", toOne: "expansion" },
  { id: "cs-expansion-cost-snapshots", one: "CsExpansion", many: "CsCostSnapshot", foreignKey: "expansion_id", toMany: "costSnapshots", toOne: "expansion" },
  { id: "cs-expansion-decisions", one: "CsExpansion", many: "CsDecision", foreignKey: "expansion_id", toMany: "decisions", toOne: "expansion" },
  { id: "cs-expansion-import-batches", one: "CsExpansion", many: "CsImportBatch", foreignKey: "expansion_id", toMany: "importBatches", toOne: "expansion" },
  { id: "cs-expansion-cause-proposals", one: "CsExpansion", many: "CsCauseProposal", foreignKey: "expansion_id", toMany: "causeProposals", toOne: "expansion" },
  { id: "cs-supplier-purchase-orders", one: "CsSupplier", many: "CsPurchaseOrder", foreignKey: "supplier_logical_id", toMany: "purchaseOrders", toOne: "supplier" },
  { id: "cs-supplier-profile-versions", one: "CsSupplier", many: "CsSupplierProfileVersion", foreignKey: "supplier_logical_id", toMany: "profileVersions", toOne: "supplier" },
  { id: "cs-supplier-cost-lines", one: "CsSupplier", many: "CsCostLine", foreignKey: "supplier_logical_id", toMany: "costLines", toOne: "supplier" },
  { id: "cs-snapshot-cost-lines", one: "CsCostSnapshot", many: "CsCostLine", foreignKey: "snapshot_id", toMany: "costLines", toOne: "snapshot" },
  { id: "cs-incident-cause-proposals", one: "CsIncident", many: "CsCauseProposal", foreignKey: "incident_version_id", toMany: "causeProposals", toOne: "incident" },
  { id: "cs-proposal-decisions", one: "CsCauseProposal", many: "CsDecision", foreignKey: "answers_proposal_id", toMany: "answeringDecisions", toOne: "answersProposal" },
  { id: "cs-expansion-ai-runs", one: "CsExpansion", many: "CsAiRun", foreignKey: "expansion_id", toMany: "aiRuns", toOne: "expansion" },
  { id: "cs-ai-run-cause-proposals", one: "CsAiRun", many: "CsCauseProposal", foreignKey: "ai_run_id", toMany: "causeProposals", toOne: "aiRun" },
  { id: "cs-expansion-field-verifications", one: "CsExpansion", many: "CsFieldVerification", foreignKey: "expansion_id", toMany: "fieldVerifications", toOne: "expansion" },
  { id: "cs-supplier-field-verifications", one: "CsSupplier", many: "CsFieldVerification", foreignKey: "supplier_logical_id", toMany: "fieldVerifications", toOne: "supplier" },
  { id: "cs-expansion-outreach-messages", one: "CsExpansion", many: "CsOutreachMessage", foreignKey: "expansion_id", toMany: "outreachMessages", toOne: "expansion" },
  { id: "cs-supplier-outreach-messages", one: "CsSupplier", many: "CsOutreachMessage", foreignKey: "supplier_logical_id", toMany: "outreachMessages", toOne: "supplier" },
];
