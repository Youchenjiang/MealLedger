import { describe, expect, test } from "vitest";
import { serializeCleanCsv, serializeCleanJson, toCleanExportRow } from "./export";
import type { LocalLedgerRecord } from "./records";

const record: LocalLedgerRecord = {
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
  counterparty: "Store, North",
  counterpartyMissing: false,
  itemName: "Tea\negg",
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
  note: "Plain note",
  createdAt: "2026-07-13T00:00:00.000Z",
  updatedAt: "2026-07-13T00:00:00.000Z",
};

describe("clean ledger export", () => {
  test("maps a record to the normalized export shape without media fields", () => {
    const row = toCleanExportRow(record);

    expect(row).toMatchObject({ id: "record-1", date: "2026-07-13", account: "Cash", amount: "417" });
    expect(row).not.toHaveProperty("media");
    expect(row).not.toHaveProperty("bytes");
    expect(row).not.toHaveProperty("base64");
  });

  test("serializes CSV with BOM, escaping, and ISO date", () => {
    const csv = serializeCleanCsv([record]);

    expect(csv.startsWith("\ufeffid,kind,date")).toBe(true);
    expect(csv).toContain('"Store, North"');
    expect(csv).toContain('"Tea\negg"');
    expect(csv).toContain("2026-07-13");
  });

  test("serializes JSON without media bytes and excludes voided records", () => {
    const json = serializeCleanJson([record, { ...record, id: "voided", recordState: "voided" }]);
    const parsed = JSON.parse(json) as Array<Record<string, unknown>>;

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: "record-1", kind: "expense" });
    expect(json).not.toContain("base64");
    expect(json).not.toContain("media");
    expect(json).not.toContain("base64");
  });
});
