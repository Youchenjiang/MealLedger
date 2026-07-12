import { describe, expect, test } from "vitest";
import { canCreateManualDraft, createTransactionDraft, type DraftForm } from "./drafts";

const completeExpense: DraftForm = {
  date: "2026-07-11",
  account: "Daily wallet",
  kind: "expense",
  category: "Daily",
  counterparty: "7-Eleven",
  itemName: "Tea egg",
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
  period: "",
  note: "",
};

describe("manual transaction drafts", () => {
  test.each(["account", "category", "counterparty", "itemName", "amount"] as const)("rejects blank expense %s after trimming", (field) => {
    expect(canCreateManualDraft({ ...completeExpense, [field]: "   " })).toBe(false);
  });

  test("uses transfer-specific requirements without merchant or category", () => {
    const transfer: DraftForm = {
      ...completeExpense,
      kind: "transfer",
      category: "",
      counterparty: "",
      itemName: "",
      transferAccount: "Savings",
    };

    expect(canCreateManualDraft(transfer)).toBe(true);
    expect(canCreateManualDraft({ ...transfer, transferAccount: "" })).toBe(false);
  });

  test("requires both amounts and currencies for cross-currency transfers", () => {
    const transfer: DraftForm = {
      ...completeExpense,
      kind: "transfer",
      category: "",
      counterparty: "",
      itemName: "",
      transferAccount: "Japan cash",
      transferMode: "cross-currency",
      destinationAmount: "46000",
      destinationCurrency: "JPY",
    };

    expect(canCreateManualDraft(transfer)).toBe(true);
    expect(canCreateManualDraft({ ...transfer, destinationAmount: "" })).toBe(false);
  });

  test("requires complete fee fields when a transfer fee is enabled", () => {
    const transfer: DraftForm = {
      ...completeExpense,
      kind: "transfer",
      category: "",
      counterparty: "",
      itemName: "",
      transferAccount: "Savings",
      feeEnabled: true,
      feeAccount: "Daily wallet",
      feeAmount: "15",
      feeCurrency: "TWD",
      feeCategory: "Fees",
    };

    expect(canCreateManualDraft(transfer)).toBe(true);
    expect(canCreateManualDraft({ ...transfer, feeCategory: "" })).toBe(false);
  });

  test("uses distinct fields for income, refunds, funding, adjustments, and unresolved expenses", () => {
    expect(canCreateManualDraft({ ...completeExpense, kind: "income", itemName: "" })).toBe(true);
    expect(canCreateManualDraft({ ...completeExpense, kind: "refund", itemName: "", refundReason: "Returned item" })).toBe(true);
    expect(canCreateManualDraft({ ...completeExpense, kind: "fund-addition", category: "", itemName: "" })).toBe(true);
    expect(canCreateManualDraft({ ...completeExpense, kind: "adjustment", category: "", counterparty: "", itemName: "", reason: "Balance correction" })).toBe(true);
    expect(canCreateManualDraft({ ...completeExpense, kind: "unresolved-expense", date: "", category: "", counterparty: "", itemName: "", timePrecision: "month", period: "2026-07" })).toBe(true);
  });

  test("trims fields before a draft is created", () => {
    expect(
      createTransactionDraft(
        {
          ...completeExpense,
          account: " Daily wallet ",
          category: " Daily ",
          counterparty: " 全聯 ",
          itemName: " 茶葉蛋 ",
          amount: " 417 ",
          note: " dinner ",
        },
        "draft-1",
      ),
    ).toMatchObject({
      id: "draft-1",
      account: "Daily wallet",
      category: "Daily",
      counterparty: "全聯",
      itemName: "茶葉蛋",
      amount: "417",
      note: "dinner",
    });
  });

  test("creates only a local draft shape, never a confirmed ledger record", () => {
    const draft = createTransactionDraft(completeExpense, "draft-1");

    expect(draft).toMatchObject({ id: "draft-1", counterparty: "7-Eleven" });
    expect(draft).not.toHaveProperty("status");
    expect(draft).not.toHaveProperty("recordId");
  });
});
