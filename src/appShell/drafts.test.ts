import { describe, expect, test } from "vitest";
import { canCreateManualDraft, createTransactionDraft, type DraftForm } from "./drafts";

const completeExpense: DraftForm = {
  date: "2026-07-11",
  account: "Cash",
  kind: "expense",
  category: "Daily",
  counterparty: "7-Eleven",
  transferAccount: "",
  amount: "100",
  currency: "TWD",
  note: "",
};

describe("manual transaction drafts", () => {
  test.each(["account", "category", "counterparty", "amount"] as const)("rejects blank %s after trimming", (field) => {
    expect(canCreateManualDraft({ ...completeExpense, [field]: "   " })).toBe(false);
  });

  test("requires a destination account for transfers", () => {
    expect(canCreateManualDraft({ ...completeExpense, kind: "transfer" })).toBe(false);
    expect(canCreateManualDraft({ ...completeExpense, kind: "transfer", transferAccount: "Post office savings" })).toBe(true);
  });

  test.each(["expense", "income", "refund", "adjustment"] as const)("does not require a destination account for %s", (kind) => {
    expect(canCreateManualDraft({ ...completeExpense, kind, transferAccount: "" })).toBe(true);
  });

  test("trims fields before a draft is created", () => {
    expect(
      createTransactionDraft(
        {
          ...completeExpense,
          account: " Cash ",
          category: " Daily ",
          counterparty: " 全聯 ",
          amount: " 417 ",
          note: " dinner ",
        },
        "draft-1",
      ),
    ).toEqual({
      ...completeExpense,
      id: "draft-1",
      account: "Cash",
      category: "Daily",
      counterparty: "全聯",
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
