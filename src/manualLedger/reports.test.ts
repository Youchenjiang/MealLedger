import { describe, expect, test } from "vitest";
import type { LocalAccount } from "./accounts";
import { calculateAccountReports } from "./reports";
import type { LocalLedgerRecord } from "./records";

const accounts: LocalAccount[] = [
  { id: "cash", name: "Cash", currency: "TWD" },
  { id: "jpy", name: "Travel cash", currency: "JPY" },
];

function record(overrides: Partial<LocalLedgerRecord>): LocalLedgerRecord {
  return {
    id: "record",
    idempotencyKey: "action",
    userId: "local-user",
    kind: "expense",
    status: "local-only",
    recordState: "active",
    version: 1,
    localDate: "2026-07-13",
    accountId: "cash",
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

describe("account report projections", () => {
  test("separates income, spending, refunds, additions, adjustments, and cash flow", () => {
    const reports = calculateAccountReports(accounts, [
      record({ id: "income", kind: "income", amount: "500" }),
      record({ id: "expense", amount: "100" }),
      record({ id: "refund", kind: "refund", amount: "20" }),
      record({ id: "fund", kind: "fund-addition", amount: "300" }),
      record({ id: "adjustment", kind: "adjustment", amount: "-5" }),
    ]);

    expect(reports[0]).toMatchObject({
      recordCount: 5,
      incomeTotal: 500,
      expenseTotal: 100,
      refundTotal: 20,
      fundAdditionTotal: 300,
      adjustmentTotal: -5,
      netSpendingTotal: 80,
      cashFlowTotal: 715,
      closingBalance: 715,
    });
  });

  test("keeps transfer legs and currencies separate and ignores voided records", () => {
    const reports = calculateAccountReports(accounts, [
      record({
        id: "transfer",
        kind: "transfer",
        amount: "1000",
        transferAccountId: "jpy",
        destinationAmount: "4500",
        destinationCurrency: "JPY",
      }),
      record({ id: "voided", amount: "999", recordState: "voided" }),
    ]);

    expect(reports[0]).toMatchObject({
      recordCount: 1,
      transferOutTotal: 1000,
      cashFlowTotal: -1000,
      closingBalance: -1000,
    });
    expect(reports[1]).toMatchObject({
      recordCount: 0,
      transferInTotal: 4500,
      cashFlowTotal: 4500,
      closingBalance: 4500,
    });
  });

  test("aggregates decimal currencies in minor units before formatting totals", () => {
    const usdAccounts: LocalAccount[] = [{ id: "usd", name: "USD wallet", currency: "USD" }];
    const reports = calculateAccountReports(usdAccounts, [
      record({ id: "usd-1", accountId: "usd", accountName: "USD wallet", amount: "0.10", currency: "USD" }),
      record({ id: "usd-2", accountId: "usd", accountName: "USD wallet", amount: "0.20", currency: "USD" }),
    ]);

    expect(reports[0]).toMatchObject({ expenseTotal: 0.3, netSpendingTotal: 0.3, closingBalance: -0.3 });
  });
});
