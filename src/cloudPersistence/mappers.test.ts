import { describe, expect, test } from "vitest";
import type { MealEntry } from "../captureMedia/meals";
import type { TemporaryScan } from "../captureMedia/media";
import type { UploadQueueItem } from "../captureMedia/upload";
import type { LocalLedgerRecord } from "../manualLedger/records";
import { mapLedgerRecord, mapLocalAccount, mapMealEntry, mapMediaAsset, mapTemporaryScan, mapTemporaryScanMediaLink } from "./mappers";

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
  const media: UploadQueueItem = {
    id: "meal-1-0-lunch.jpg",
    name: "lunch.jpg",
    type: "image/jpeg",
    size: 2048,
    status: "queued",
    kind: "meal-photo",
  };

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

  test("maps non-UUID audit ids to stable cloud ids for retries", () => {
    const first = mapLedgerRecord(record(), "user-1", references);
    const second = mapLedgerRecord(record(), "user-1", references);

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    if (first.ok && second.ok) {
      expect(first.value.auditEvents[0].id).toBe(second.value.auditEvents[0].id);
      expect(first.value.auditEvents[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
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

  test("keeps a transfer fee linked to its expense record", () => {
    const result = mapLedgerRecord(record({
      kind: "transfer",
      transferAccountId: "account-local-2",
      destinationAmount: "100",
      destinationCurrency: "USD",
    }), "user-1", references, "Asia/Taipei", [], "fee-record-1");

    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.transferDetails).toMatchObject({ fee_ledger_record_id: expect.any(String) });
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

  test("maps ordinary refunds and tags to canonical links", () => {
    const result = mapLedgerRecord(record({
      kind: "refund",
      refundSubtype: "refund",
      refundLinkedRecordId: "record-original-1",
      tags: ["Subscription"],
    }), "user-1", {
      ...references,
      tagIds: { Subscription: "77777777-7777-4777-8777-777777777777" },
    });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.value.refundLinks[0]).toMatchObject({ refund_subtype: "refund" });
      expect(result.value.ledgerRecordTags[0]).toMatchObject({ tag_id: "77777777-7777-4777-8777-777777777777" });
    }
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

  test("maps media metadata without embedding file bytes", () => {
    const result = mapMediaAsset(media, "user-1", "2026-07-13T10:00:00.000Z");

    expect(result).toMatchObject({
      user_id: "user-1",
      media_kind: "meal-photo",
      content_type: "image/jpeg",
      byte_size: 2048,
      upload_status: "queued",
    });
    expect(result).not.toHaveProperty("bytes");
    expect(JSON.stringify(result)).not.toContain("base64");
    expect(result.object_key).toContain("pending/user-1/");
  });

  test("maps a temporary scan as a source payload without creating a ledger record", () => {
    const scan: TemporaryScan = {
      id: "scan-1",
      intent: "scan-receipt",
      fileName: "receipt.jpg",
      mimeType: "image/jpeg",
      byteSize: 1024,
      state: "temporary",
      cloudStatus: "local-only",
      createdAt: "2026-07-13T10:00:00.000Z",
      expiresAt: "2026-07-14T10:00:00.000Z",
    };
    const result = mapTemporaryScan(scan, "user-1");

    expect(result).toMatchObject({ user_id: "user-1", source_type: "receipt-scan", source_state: "temporary" });
    expect(result.payload_json).toEqual(expect.objectContaining({ file_name: "receipt.jpg", byte_size: 1024 }));
    expect(JSON.stringify(result)).not.toContain("ledger_records");
    expect(mapTemporaryScanMediaLink(scan, "user-1")).toMatchObject({ target_type: "source-payload", link_intent: "receipt-evidence" });

    expect(mapTemporaryScanMediaLink({ ...scan, intent: "scan-invoice" }, "user-1")).toMatchObject({
      target_type: "source-payload",
      link_intent: "invoice-scan",
    });
  });

  test("maps a meal with multiple photos and transaction links", () => {
    const meal: MealEntry = {
      id: "meal-1",
      occurredAt: "2026-07-13T12:30",
      note: "Lunch",
      transactionIds: ["record-local-1"],
      mediaAssetIds: [media.id, "meal-1-1-dessert.jpg"],
      status: "local-only",
    };
    const result = mapMealEntry(meal, "user-1", references);

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.value.transactionLinks).toHaveLength(1);
      expect(result.value.mediaLinks).toHaveLength(2);
      expect(result.value.mediaLinks[0]).toMatchObject({ target_type: "meal", link_intent: "meal-photo" });
    }
  });
});
