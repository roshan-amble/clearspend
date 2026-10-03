/**
 * UI3 A check, read-only: every stored evidence record of 1 expansion must rebuild into a source row whose digest
 * equals the stored `contentDigest`. Then the data studio's "edit as a new version" writes exactly what it shows,
 * and an unchanged record imports as REPLAYED. It reads Foundry and writes nothing.
 *
 * Run: npm run test:studio -- --namespace demo
 */
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { canonicalJson, EDITABLE_KINDS, parseEvidenceRows, sourceRowOf, type EditableKind, type Json } from "@clearspend/domain";
import { propsOf } from "../apps/web/src/studio-rows.js";
import { searchObjects } from "./lib/foundry.js";
import { namespaceExpansion } from "./lib/namespace.js";

const OBJECT_TYPE: Record<EditableKind, string> = {
  orders: "CsPurchaseOrder",
  payments: "CsPayment",
  invoices: "CsInvoice",
  deliveries: "CsDelivery",
  incidents: "CsIncident",
  "supplier-profiles": "CsSupplierProfileVersion",
};

const { values } = parseArgs({ options: { namespace: { type: "string" } } });
const expansionId = namespaceExpansion("EXP-ANDROY-2026", values.namespace ?? null);
const orders = await searchObjects("CsPurchaseOrder", "expansionId", expansionId);
const orderIds = [...new Set(orders.map((o) => String(o.logicalId)))];
const batches = await searchObjects("CsImportBatch", "expansionId", expansionId);

let failures = 0;
for (const kind of EDITABLE_KINDS) {
  const objects =
    kind === "orders"
      ? orders
      : kind === "supplier-profiles"
        ? (await Promise.all(batches.filter((b) => b.fileKind === kind).map((b) => searchObjects(OBJECT_TYPE[kind], "importBatchId", String(b.importBatchId))))).flat()
        : (await Promise.all(orderIds.map((id) => searchObjects(OBJECT_TYPE[kind], "orderLogicalId", id)))).flat();
  let matched = 0;
  for (const object of objects) {
    const logicalId = String(object.logicalId);
    const row = sourceRowOf(kind as "orders", logicalId, propsOf(kind, object as never) as never);
    const [parsed] = parseEvidenceRows(kind, [row]);
    const digest = createHash("sha256")
      .update(canonicalJson(parsed?.props as unknown as Json), "utf-8")
      .digest("hex");
    if (parsed?.logicalId === logicalId && digest === object.contentDigest) matched += 1;
    else {
      failures += 1;
      console.error(`${kind} ${String(object.versionId)}: rebuilt ${parsed?.logicalId} digest ${digest.slice(0, 12)}, stored ${String(object.contentDigest).slice(0, 12)}`);
    }
  }
  console.log(`${kind}: ${matched} of ${objects.length} stored versions round-trip.`);
}
if (failures > 0) {
  console.error(`FAILED: ${failures} records do not round-trip. The studio would disable editing for them.`);
  process.exitCode = 1;
} else console.log(`PASS: every stored record of ${expansionId} rebuilds to its stored digest.`);
