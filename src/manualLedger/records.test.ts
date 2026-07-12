import { describe, expect, test } from "vitest";
import type { TransactionDraft } from "../appShell/drafts";
import type { LocalAccount } from "./accounts";
import { appendIdempotentRecords, createOfficialRecordBundle, updateOfficialRecord, voidOfficialRecord } from "./records";

const accounts: LocalAccount[] = [
  { id: "cash-id", name: "Cash", currency: "TWD" },
  { id: "savings-id", name: "Savings", currency: "TWD" },
];

const expense: TransactionDraft = {
  id: "draft-1",
  date: "2026-07-12",
  account: "Cash",
  kind: "expense",
  category: "Daily",
  counterparty: "Store",
  itemName: "Tea",
  transferAccount: "",
  transferMode: "same-currency",
  amount: "100",
  currency: "TWD",
  destinationAmount: "",
  destinationCurrency: "",
  feeEnabled: false,
  feeAccount: "",
  feeAmount: "",
  feeCurrency: "",
  feeCategory: "",
  refundReason: "",
  reason: "",
  timePrecision: "day",
  periodStart: "",
  periodEnd: "",
  note: "",
};

const options = {
  userId: "local-user",
  recordId: "record-1",
  idempotencyKey: "action-1",
  createdAt: "2026-07-12T12:00:00.000Z",
};

describe("local official ledger records", () => {
  test("creates a local-only official record with an audit event", () => {
    const bundle = createOfficialRecordBundle(expense, accounts, options);

    expect(bundle?.records).toHaveLength(1);
    expect(bundle?.records[0]).toMatchObject({
      id: "record-1",
      status: "local-only",
      recordState: "active",
      version: 1,
      accountId: "cash-id",
      amount: "100",
      currency: "TWD",
      idempotencyKey: "action-1",
    });
    expect(bundle?.auditEvents[0]).toMatchObject({
      targetId: "record-1",
      eventType: "record-created",
    });
  });

  test("updates editable fields with a new version and audit event", () => {
    const bundle = createOfficialRecordBundle(expense, accounts, options);
    if (!bundle) {
      throw new Error("Expected a valid record bundle.");
    }

    const result = updateOfficialRecord(bundle.records[0], { amount: "120", note: "Corrected" }, "2026-07-12T13:00:00.000Z");

    expect(result.record).toMatchObject({ amount: "120", note: "Corrected", version: 2, recordState: "active" });
    expect(result.auditEvent).toMatchObject({ eventType: "record-updated", changedFields: ["amount", "note"] });
  });

  test("voids a record without deleting its audit target", () => {
    const bundle = createOfficialRecordBundle(expense, accounts, options);
    if (!bundle) {
      throw new Error("Expected a valid record bundle.");
    }

    const result = voidOfficialRecord(bundle.records[0], "2026-07-12T13:30:00.000Z");

    expect(result.record).toMatchObject({ id: "record-1", recordState: "voided", version: 2 });
    expect(result.auditEvent).toMatchObject({ eventType: "record-voided", targetId: "record-1" });
  });

  test("creates a linked expense record for a transfer fee", () => {
    const transfer: TransactionDraft = {
      ...expense,
      id: "draft-transfer",
      kind: "transfer",
      category: "",
      counterparty: "",
      itemName: "",
      transferAccount: "Savings",
      feeEnabled: true,
      feeAccount: "Cash",
      feeAmount: "10",
      feeCurrency: "TWD",
      feeCategory: "Fees",
    };

    const bundle = createOfficialRecordBundle(transfer, accounts, options);

    expect(bundle?.records).toHaveLength(2);
    expect(bundle?.records[0].kind).toBe("transfer");
    expect(bundle?.records[1]).toMatchObject({
      kind: "expense",
      accountName: "Cash",
      amount: "10",
      category: "Fees",
      linkedRecordId: "record-1",
    });
  });

  test("rejects a record whose account or currency does not match", () => {
    expect(createOfficialRecordBundle({ ...expense, account: "Missing" }, accounts, options)).toBeNull();
    expect(createOfficialRecordBundle({ ...expense, currency: "JPY" }, accounts, options)).toBeNull();
  });

  test("does not append a repeated idempotency key", () => {
    const bundle = createOfficialRecordBundle(expense, accounts, options);
    if (!bundle) {
      throw new Error("Expected a valid record bundle.");
    }

    expect(appendIdempotentRecords(bundle.records, bundle)).toHaveLength(1);
    expect(appendIdempotentRecords([], bundle)).toHaveLength(1);
  });
});
