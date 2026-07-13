import { describe, expect, test } from "vitest";
import type { LocalAccount } from "./accounts";
import { calculateAccountBalances } from "./balances";
import type { LocalLedgerRecord } from "./records";
import { calculateAccountReports } from "./reports";

const accounts: LocalAccount[] = [
  { id: "cash", name: "Cash", currency: "TWD" },
  { id: "bank", name: "Bank", currency: "TWD" },
  { id: "jpy", name: "Japan cash", currency: "JPY" },
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

describe("V1 accounting regression cases", () => {
  test("keeps balance flows separate from income and spending totals", () => {
    const records = [
      record({ id: "fund", kind: "fund-addition", amount: "5000", counterparty: "Initial funds" }),
      record({ id: "income", kind: "income", amount: "1000", counterparty: "Allowance" }),
      record({ id: "expense", kind: "expense", amount: "500" }),
      record({ id: "refund", kind: "refund", amount: "100", refundReason: "Store refund" }),
      record({ id: "adjustment", kind: "adjustment", amount: "-50", reason: "Cash count correction" }),
      record({ id: "unresolved", kind: "unresolved-expense", amount: "25", timePrecision: "month", periodStart: "2026-07-01", periodEnd: "2026-07-31" }),
      record({ id: "transfer", kind: "transfer", amount: "200", transferAccountId: "bank", transferAccountName: "Bank" }),
    ];

    const cash = calculateAccountReports(accounts, records).find((report) => report.id === "cash");
    const balances = calculateAccountBalances(accounts, records);

    expect(cash).toMatchObject({
      incomeTotal: 1000,
      expenseTotal: 525,
      refundTotal: 100,
      fundAdditionTotal: 5000,
      adjustmentTotal: -50,
      transferOutTotal: 200,
      netSpendingTotal: 425,
      cashFlowTotal: 5325,
      closingBalance: 5325,
    });
    expect(balances.find((account) => account.id === "bank")?.balance).toBe(200);
  });

  test("stores cross-currency transfer legs without combining currencies", () => {
    const records = [
      record({
        id: "exchange",
        kind: "transfer",
        amount: "10000",
        currency: "TWD",
        transferAccountId: "jpy",
        transferAccountName: "Japan cash",
        transferMode: "cross-currency",
        destinationAmount: "46000",
        destinationCurrency: "JPY",
      }),
      record({ id: "jpy-expense", accountId: "jpy", accountName: "Japan cash", amount: "1200", currency: "JPY" }),
    ];

    const reports = calculateAccountReports(accounts, records);

    expect(reports.find((report) => report.id === "cash")).toMatchObject({
      currency: "TWD",
      transferOutTotal: 10000,
      expenseTotal: 0,
      closingBalance: -10000,
    });
    expect(reports.find((report) => report.id === "jpy")).toMatchObject({
      currency: "JPY",
      transferInTotal: 46000,
      expenseTotal: 1200,
      closingBalance: 44800,
    });
  });
});
