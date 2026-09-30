import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  heads,
  parseEvidenceRows,
  planImport,
  versionIdOf,
  type AnyEvidenceRow,
  type Json,
  type StoredVersion,
} from "./evidence.js";

const sha = (row: AnyEvidenceRow): string =>
  createHash("sha256").update(canonicalJson(row.props as unknown as Json)).digest("hex");

const payment = (id: string, amount: string) => ({
  source_system: "harbor-erp",
  payment_id: id,
  order_id: "PO-1",
  amount_cents: amount,
  currency: "USD",
  paid_at: "2026-03-25T08:00:00Z",
});

const delivery = (id: string, received: string) => ({
  source_system: "harbor-erp",
  receipt_id: id,
  order_id: "PO-1",
  commodity: "RICE",
  unit: "kg",
  quantity_received: received,
  received_at: "2026-03-18T08:00:00Z",
  handover_at: "2026-03-18T08:00:00Z",
  moisture_permille: "128",
  acceptance_result: "PASS",
});

const known = (orders: string[] = ["harbor-erp:PO-1"]) => ({
  expansion: new Set<string>(),
  suppliers: new Set<string>(),
  orders: new Set(orders),
});

function plan(kind: "payments" | "deliveries", raw: object[], stored: ReadonlyMap<string, readonly StoredVersion[]> = new Map(), orders?: string[]) {
  const rows = parseEvidenceRows(kind, raw);
  return planImport({ rows, digests: rows.map(sha), stored, known: known(orders) });
}

describe("evidence rows (D4 validation)", () => {
  it("converts kilograms to grams and keeps the source value and unit next to it", () => {
    const [row] = parseEvidenceRows("deliveries", [delivery("DEL-1", "10000")]);

    expect(row?.logicalId).toBe("harbor-erp:DEL-1");
    expect(row?.props).toMatchObject({ sourceUnit: "kg", sourceQuantityReceived: 10_000, baseUnit: "g", quantityReceived: 10_000_000 });
  });

  it("names the row and the field of a bad value, and never accepts a decimal amount", () => {
    expect(() => parseEvidenceRows("payments", [payment("PAY-1", "4400.50")])).toThrowError(/Row 1, field "amount_cents"/);
    expect(() => parseEvidenceRows("payments", [{ ...payment("PAY-1", "1"), paid_at: "2026-03-25" }])).toThrowError(
      /Row 1, field "paid_at": must be an ISO 8601 UTC time/,
    );
  });

  it("refuses a unit it cannot convert, instead of guessing", () => {
    expect(() => parseEvidenceRows("deliveries", [{ ...delivery("DEL-1", "1"), unit: "bags" }])).toThrowError(/field "unit"/);
  });

  it("makes the same canonical JSON whatever the key order", () => {
    expect(canonicalJson({ b: 1, a: [{ d: null, c: "x" }] })).toBe(canonicalJson({ a: [{ c: "x", d: null }], b: 1 }));
  });
});

describe("import plan (D4 identity rules)", () => {
  it("accepts a new row, and replays the same row with no new record", () => {
    const first = plan("payments", [payment("PAY-1", "440000")]);
    const [planned] = first.rows;
    const stored = new Map([["harbor-erp:PAY-1", [{ versionId: planned?.versionId ?? "", contentDigest: planned?.digest ?? "", supersedesVersionId: null }]]]);
    const again = plan("payments", [payment("PAY-1", "440000")], stored);

    expect(first.counts).toMatchObject({ accepted: 1, replayed: 0 });
    expect(again.counts).toMatchObject({ accepted: 0, replayed: 1 });
    expect(again.changesEvidence).toBe(false);
  });

  it("stores a changed payment as a conflict, never as a replacement", () => {
    const old = plan("payments", [payment("PAY-1", "440000")]).rows[0];
    const stored = new Map([["harbor-erp:PAY-1", [{ versionId: old?.versionId ?? "", contentDigest: old?.digest ?? "", supersedesVersionId: null }]]]);
    const changed = plan("payments", [payment("PAY-1", "450000")], stored);

    expect(changed.rows[0]?.outcome).toEqual({ result: "CONFLICTING", stored: true });
    expect(changed.changesEvidence).toBe(true);
  });

  it("makes a corrected delivery a new version that supersedes the old one, so it is not counted twice", () => {
    const old = plan("deliveries", [delivery("DEL-1", "9000")]).rows[0];
    const stored = new Map([["harbor-erp:DEL-1", [{ versionId: old?.versionId ?? "", contentDigest: old?.digest ?? "", supersedesVersionId: null }]]]);
    const corrected = plan("deliveries", [delivery("DEL-1", "10000")], stored);
    const next = corrected.rows[0];

    expect(next?.outcome).toEqual({ result: "VERSIONED", supersedesVersionId: old?.versionId });
    expect(heads([...(stored.get("harbor-erp:DEL-1") ?? []), { versionId: next?.versionId ?? "", contentDigest: next?.digest ?? "", supersedesVersionId: old?.versionId ?? "" }]).map((v) => v.versionId)).toEqual([next?.versionId]);
  });

  it("treats 2 payments with different IDs and the same amount as 2 payments", () => {
    const result = plan("payments", [payment("PAY-1", "440000"), payment("PAY-2", "440000")]);

    expect(result.counts.accepted).toBe(2);
  });

  it("does not store a row that names an unknown order, and lists it as unmatched", () => {
    const result = plan("payments", [payment("PAY-1", "440000")], new Map(), []);

    expect(result.rows[0]?.outcome).toEqual({ result: "UNMATCHED", missing: ["harbor-erp:PO-1"] });
    expect(result.changesEvidence).toBe(false);
  });

  it("lets a replacement order name an order earlier in the same file", () => {
    const order = (id: string, replaces: string) => ({
      source_system: "harbor-erp",
      order_id: id,
      expansion_id: "EXP-1",
      supplier_id: "SUP-A",
      commodity: "RICE",
      unit: "kg",
      quantity: "10",
      unit_price_cents: "44",
      total_cents: "440",
      currency: "USD",
      replaces_order_id: replaces,
      replaces_incident_id: "",
      recorded_at: "2026-03-10T08:00:00Z",
    });
    const rows = parseEvidenceRows("orders", [order("PO-A3", ""), order("PO-A3R", "PO-A3")]);
    const result = planImport({
      rows,
      digests: rows.map(sha),
      stored: new Map(),
      known: { expansion: new Set(["EXP-1"]), suppliers: new Set(["harbor-erp:SUP-A"]), orders: new Set() },
    });

    expect(result.counts).toMatchObject({ accepted: 2, unmatched: 0 });
  });

  it("builds version IDs as logicalId@first 12 characters of the digest", () => {
    expect(versionIdOf("harbor-erp:PAY-1", "0123456789abcdef")).toBe("harbor-erp:PAY-1@0123456789ab");
  });
});
