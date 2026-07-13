import { describe, expect, test } from "vitest";
import type { LocalLedgerRecord } from "../manualLedger/records";
import { mapLedgerRecord, mapLocalAccount } from "./mappers";

function record(overrides: Partial<LocalLedgerRecord> = {}): LocalLedgerRecord {
  return {
    id: "record-local-1",
    idempotencyKey: "action-1",
    userId: "user-1",
    kind: "expense",
    status: "local-only",
    recordState: "active",
    version: 1,
    localDate: "2026-07-13",
    accountId: "account-local-1",
    accountName: "Cash",
    amount: "12.34",
    currency: "USD",
    category: "Daily",
    counterparty: "Market",
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

const references = {
  accountIds: { "account-local-1": "11111111-1111-4111-8111-111111111111", "account-local-2": "22222222-2222-4222-8222-222222222222" },
  categoryIds: { Daily: "33333333-3333-4333-8333-333333333333" },
  ledgerRecordIds: {
    "record-local-1": "44444444-4444-4444-8444-444444444444",
    "record-original-1": "55555555-5555-4555-8555-555555555555",
    "record-original-2": "66666666-6666-4666-8666-666666666666",
  },
};

describe("cloud row mappers", () => {
  test("maps a local account without treating a client key as a UUID", () => {
    expect(mapLocalAccount({ id: "account-local-1", name: " Cash ", currency: "twd" }, "user-1")).toEqual({
      user_id: "user-1",
      name: " Cash ",
      currency: "TWD",
      account_type: "cash",
      allow_negative_balance: true,
    });
  });

  test("preserves exact minor units and record kind", () => {
    const result = mapLedgerRecord(record({ kind: "fund-addition", amount: "1000", currency: "TWD", category: "", counterparty: "Initial funds" }), "user-1", references);

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.value.ledgerRecord).toMatchObject({ kind: "fund-addition", amount_minor: "1000", source: "Initial funds" });
    }
  });

  test("maps a cross-currency transfer with destination amount", () => {
    const result = mapLedgerRecord(record({
      kind: "transfer",
      accountId: "account-local-1",
      amount: "10000",
      currency: "TWD",
      category: "",
      counterparty: "",
      transferAccountId: "account-local-2",
      destinationAmount: "46000",
      destinationCurrency: "JPY",
    }), "user-1", references);

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.value.transferDetails).toEqual(expect.objectContaining({
        destination_amount_minor: "46000",
        destination_currency: "JPY",
      }));
    }
  });

  test("maps one refund to explicit multiple payback allocations", () => {
    const result = mapLedgerRecord(record({
      kind: "refund",
      refundSubtype: "payback",
      category: "Daily",
      refundLinkedRecordIds: ["record-original-1", "record-original-2"],
    }), "user-1", {
      ...references,
      refundAllocations: {
        "record-local-1": [
          { originalRecordId: "record-original-1", amount: "5.00", currency: "USD" },
          { originalRecordId: "record-original-2", amount: "7.34", currency: "USD" },
        ],
      },
    });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.refundLinks).toHaveLength(2);
  });

  test("rejects ambiguous multiple payback links without allocations", () => {
    const result = mapLedgerRecord(record({
      kind: "refund",
      refundSubtype: "payback",
      category: "Daily",
      refundLinkedRecordIds: ["record-original-1", "record-original-2"],
    }), "user-1", references);

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "missing-refund-allocation" })]));
  });
});
