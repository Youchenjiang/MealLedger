import { describe, expect, test } from "vitest";
import type { LocalLedgerRecord } from "../manualLedger/records";
import { detectImportDuplicates } from "./duplicates";

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
    accountId: "cash-id",
    accountName: "Cash",
    amount: "100",
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
    note: "",
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("import duplicate detection", () => {
  test("detects an expense duplicate against an active record", () => {
    const result = detectImportDuplicates([{
      rowNumber: 2,
      normalized: { kind: "expense", date: "2026-07-13", account: "Cash", amount: "100", currency: "TWD", merchant: "Store", item_name: "Tea" },
    }], [record()]);

    expect(result.get(2)).toMatchObject([{ candidateType: "existing-record", candidateId: "record-1" }]);
  });

  test("does not flag voided records", () => {
    const result = detectImportDuplicates([{
      rowNumber: 2,
      normalized: { kind: "expense", date: "2026-07-13", account: "Cash", amount: "100", currency: "TWD", merchant: "Store", item_name: "Tea" },
    }], [record({ recordState: "voided" })]);

    expect(result.has(2)).toBe(false);
  });

  test("detects transfer, fund addition, adjustment, and refund duplicates", () => {
    const rows = [
      { rowNumber: 2, normalized: { kind: "transfer", date: "2026-07-13", account: "Cash", amount: "100", currency: "TWD", target_account: "Savings", target_amount: "100", target_currency: "TWD" } },
      { rowNumber: 3, normalized: { kind: "fund-addition", date: "2026-07-13", account: "Cash", amount: "200", currency: "TWD", source: "Initial" } },
      { rowNumber: 4, normalized: { kind: "adjustment", date: "2026-07-13", account: "Cash", amount: "-10", currency: "TWD", reason: "Count correction" } },
      { rowNumber: 5, normalized: { kind: "refund", date: "2026-07-13", account: "Cash", amount: "50", currency: "TWD", merchant: "Store", refund_subtype: "refund", refund_reason: "Return", refund_linked_record_id: "record-1" } },
    ];
    const records = [
      record({ kind: "transfer", amount: "100", transferAccountName: "Savings", destinationAmount: "100", destinationCurrency: "TWD" }),
      record({ id: "fund-1", kind: "fund-addition", amount: "200", counterparty: "Initial" }),
      record({ id: "adjust-1", kind: "adjustment", amount: "-10", reason: "Count correction" }),
      record({ id: "refund-1", kind: "refund", amount: "50", counterparty: "Store", refundLinkedRecordId: "record-1", refundReason: "Return" }),
    ];

    expect(detectImportDuplicates(rows, records).size).toBe(4);
  });

  test("detects duplicate rows inside the same import batch", () => {
    const result = detectImportDuplicates([
      { rowNumber: 2, normalized: { kind: "income", date: "2026-07-13", account: "Cash", amount: "500", currency: "TWD", source: "Work" } },
      { rowNumber: 3, normalized: { kind: "income", date: "2026-07-13", account: "Cash", amount: "500", currency: "TWD", source: "Work" } },
    ], []);

    expect(result.get(3)).toMatchObject([{ candidateType: "batch-row", candidateRowNumber: 2 }]);
  });
});
