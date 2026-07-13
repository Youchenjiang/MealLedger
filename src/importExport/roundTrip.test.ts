import { describe, expect, test } from "vitest";
import { mapImportHeaders, mapImportRow } from "./mapping";
import { validateCsvText } from "./csv";
import { validateImportRows } from "./rowValidation";
import { serializeCleanCsv, toCleanExportRow } from "../manualLedger/export";
import type { LocalLedgerRecord } from "../manualLedger/records";

const accounts = [
  { name: "Cash", currency: "TWD" },
  { name: "Japan cash", currency: "JPY" },
];

function record(overrides: Partial<LocalLedgerRecord> = {}): LocalLedgerRecord {
  return {
    id: "record-1",
    idempotencyKey: "action-1",
    userId: "local-user",
    kind: "expense",
    status: "local-only",
    recordState: "active",
    version: 1,
    localDate: "2026-07-13",
    accountId: "cash",
    accountName: "Cash",
    amount: "417",
    currency: "TWD",
    category: "Daily",
    counterparty: "Store",
    counterpartyMissing: false,
    itemName: "Tea",
    itemNameMissing: false,
    transferAccountId: "",
    transferAccountName: "",
    transferMode: "same-currency",
    destinationAmount: "",
    destinationCurrency: "",
    feeAccountId: "",
    feeAccountName: "",
    feeAmount: "",
    feeCurrency: "",
    feeCategory: "",
    refundReason: "",
    refundSubtype: "refund",
    refundLinkedRecordId: "",
    refundExcessHandling: "unclassified",
    recurrenceChoice: "current-cycle-only",
    recurrenceAmountMode: "fixed",
    recurrenceStatus: "inactive",
    reason: "",
    timePrecision: "day",
    periodStart: "",
    periodEnd: "",
    note: "Bought after work",
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

function importExportRows(records: LocalLedgerRecord[]) {
  const validation = validateCsvText(serializeCleanCsv(records));
  expect(validation.ok).toBe(true);

  const mapping = mapImportHeaders(validation.headers);
  return validation.rows.map((row) => mapImportRow(validation.headers, row, mapping));
}

describe("clean export and import round-trip", () => {
  test("maps exported expense fields back into a valid import row", () => {
    const [row] = importExportRows([record({ counterparty: "全聯", itemName: "香蕉" })]);
    const [result] = validateImportRows([row], accounts);

    expect(result).toMatchObject({ ok: true });
    expect(result.normalized).toMatchObject({
      date: "2026-07-13",
      kind: "expense",
      account: "Cash",
      amount: "417",
      merchant: "全聯",
      item_name: "香蕉",
      notes: "Bought after work",
    });
  });

  test("preserves transfer legs and refund links through a clean CSV round-trip", () => {
    const rows = importExportRows([
      record({
        id: "transfer-1",
        kind: "transfer",
        amount: "10000",
        currency: "TWD",
        category: "",
        counterparty: "",
        itemName: "",
        transferAccountName: "Japan cash",
        transferMode: "cross-currency",
        destinationAmount: "46000",
        destinationCurrency: "JPY",
      }),
      record({
        id: "refund-1",
        kind: "refund",
        amount: "50",
        counterparty: "Store",
        itemName: "",
        category: "Daily",
        refundReason: "Return",
        refundLinkedRecordId: "expense-1",
        refundLinkedRecordIds: ["expense-1", "expense-2"],
      }),
    ]);
    const results = validateImportRows(rows, accounts);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ ok: true, normalized: { target_account: "Japan cash", target_amount: "46000", target_currency: "JPY" } });
    expect(results[1]).toMatchObject({ ok: true, normalized: { merchant: "Store", refund_linked_record_ids: "expense-1|expense-2" } });
  });

  test("does not put media bytes or base64 fields into the round-trip payload", () => {
    const csv = serializeCleanCsv([record()]);

    expect(csv).not.toContain("base64");
    expect(csv).not.toContain("image_bytes");
    expect(csv).not.toContain("data:image");
    expect(JSON.stringify(toCleanExportRow(record()))).not.toContain("media");
  });
});
