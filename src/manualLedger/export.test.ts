import { describe, expect, test } from "vitest";
import { createMultiTableExport, createMultiTableExportWithProgress, serializeCleanCsv, serializeCleanJson, toCleanExportRow } from "./export";
import type { LocalAccount } from "./accounts";
import type { LocalLedgerRecord } from "./records";

const account: LocalAccount = { id: "cash", name: "Cash", currency: "TWD" };

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

  test("preserves multiple refund links as a portable delimited field", () => {
    const row = toCleanExportRow({
      ...record,
      kind: "refund",
      refundLinkedRecordId: "expense-1",
      refundLinkedRecordIds: ["expense-1", "expense-2"],
    });

    expect(row.refund_linked_record_id).toBe("expense-1");
    expect(row.refund_linked_record_ids).toBe("expense-1|expense-2");
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

  test("builds the spreadsheet-style ZIP with manifest counts and account summary", () => {
    const income = { ...record, id: "income-1", kind: "income" as const, amount: "1000", category: "Allowance" };
    const transfer = {
      ...record,
      id: "transfer-1",
      kind: "transfer" as const,
      accountId: "cash",
      transferAccountId: "cash",
      transferAccountName: "Cash",
      destinationAmount: "1000",
    };
    const bundle = createMultiTableExport([account], [record, income, transfer], "2026-07-13T00:00:00.000Z");

    expect(bundle.manifest.files).toEqual([
      "manifest.json",
      "ledger/transactions.csv",
      "ledger/transfers.csv",
      "ledger/fund_additions.csv",
      "ledger/refunds.csv",
      "ledger/unresolved_expenses.csv",
      "ledger/adjustments.csv",
      "reports/account_summary.csv",
    ]);
    expect(bundle.manifest.record_counts["ledger/transactions.csv"]).toBe(2);
    expect(bundle.manifest.currency_modes).toEqual(["TWD"]);
    expect(bundle.files["reports/account_summary.csv"]).toContain("fund_addition_total");
    expect(bundle.files["reports/account_summary.csv"]).toContain("Cash");
    expect(bundle.zip[0]).toBe(0x50);
    expect(bundle.zip[1]).toBe(0x4b);
    expect(new TextDecoder().decode(bundle.zip)).toContain("ledger/transactions.csv");
  });

  test("reports progress while building a large export", async () => {
    const progress: number[] = [];
    const bundle = await createMultiTableExportWithProgress([account], [record], (percentage) => progress.push(percentage), "2026-07-13T00:00:00.000Z");

    expect(progress).toEqual([0, 25, 60, 100]);
    expect(bundle.manifest.export_mode).toBe("multi-table");
  });

  test("writes decimal account summaries from exact minor-unit totals", () => {
    const usdAccount: LocalAccount = { id: "usd", name: "USD wallet", currency: "USD" };
    const usdRecords = [
      { ...record, id: "usd-1", accountId: "usd", accountName: "USD wallet", currency: "USD", amount: "0.10" },
      { ...record, id: "usd-2", accountId: "usd", accountName: "USD wallet", currency: "USD", amount: "0.20" },
    ];
    const bundle = createMultiTableExport([usdAccount], usdRecords, "2026-07-13T00:00:00.000Z");

    expect(bundle.files["reports/account_summary.csv"]).toContain("0.3");
    expect(bundle.files["reports/account_summary.csv"]).not.toContain("0.30000000000000004");
  });
});
