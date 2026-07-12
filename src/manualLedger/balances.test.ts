import { describe, expect, test } from "vitest";
import type { LocalAccount } from "./accounts";
import { calculateAccountBalances, formatAccountBalance } from "./balances";
import type { LocalLedgerRecord } from "./records";

const accounts: LocalAccount[] = [
  { id: "cash", name: "Cash", currency: "TWD" },
  { id: "bank", name: "Bank", currency: "TWD" },
  { id: "jpy", name: "Japan cash", currency: "JPY" },
];

function record(overrides: Partial<LocalLedgerRecord>): LocalLedgerRecord {
  return {
    id: "record",
    idempotencyKey: "action",
    userId: "user",
    kind: "expense",
    status: "local-only",
    recordState: "active",
    version: 1,
    localDate: "2026-07-12",
    accountId: "cash",
    accountName: "Cash",
    amount: "100",
    currency: "TWD",
    category: "Daily",
    counterparty: "Store",
    itemName: "Tea",
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
    reason: "",
    timePrecision: "day",
    periodStart: "",
    periodEnd: "",
    note: "",
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("account balance projections", () => {
  test("applies income, expense, refund, fund addition, adjustment, and unresolved expense", () => {
    const balances = calculateAccountBalances(accounts, [
      record({ id: "fund", kind: "fund-addition", amount: "1000", counterparty: "Initial" }),
      record({ id: "income", kind: "income", amount: "500" }),
      record({ id: "expense", kind: "expense", amount: "100" }),
      record({ id: "refund", kind: "refund", amount: "20" }),
      record({ id: "adjustment", kind: "adjustment", amount: "-30" }),
      record({ id: "unresolved", kind: "unresolved-expense", amount: "10" }),
    ]);

    expect(balances.find((account) => account.id === "cash")?.balance).toBe(1380);
  });

  test("moves same and cross-currency transfer amounts to the destination account", () => {
    const balances = calculateAccountBalances(accounts, [
      record({ id: "same", kind: "transfer", amount: "100", transferAccountId: "bank", transferAccountName: "Bank" }),
      record({
        id: "cross",
        kind: "transfer",
        amount: "1000",
        currency: "TWD",
        transferAccountId: "jpy",
        transferAccountName: "Japan cash",
        transferMode: "cross-currency",
        destinationAmount: "4600",
        destinationCurrency: "JPY",
      }),
    ]);

    expect(balances.find((account) => account.id === "cash")?.balance).toBe(-1100);
    expect(balances.find((account) => account.id === "bank")?.balance).toBe(100);
    expect(balances.find((account) => account.id === "jpy")?.balance).toBe(4600);
  });

  test("excludes voided records and formats balances by currency", () => {
    const balances = calculateAccountBalances(accounts, [record({ amount: "100", recordState: "voided" })]);

    expect(balances.find((account) => account.id === "cash")?.balance).toBe(0);
    expect(formatAccountBalance(1234.5, "TWD")).toBe("TWD 1,234.5");
  });
});
