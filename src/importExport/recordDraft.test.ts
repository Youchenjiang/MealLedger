import { describe, expect, test } from "vitest";
import { toImportedTransactionDraft } from "./recordDraft";

describe("imported record draft conversion", () => {
  test("converts a normalized expense row to the shared draft shape", () => {
    const draft = toImportedTransactionDraft({
      kind: "expense",
      date: "2026-07-13",
      account: "Cash",
      amount: "417",
      currency: "TWD",
      category: "日用",
      merchant: "全聯",
      item_name: "香蕉",
    }, "import-row-2");

    expect(draft).toMatchObject({ id: "import-row-2", kind: "expense", counterparty: "全聯", itemName: "香蕉", recurrenceChoice: "current-cycle-only" });
  });

  test("converts cross-currency transfer fields and rejects incomplete rows", () => {
    const draft = toImportedTransactionDraft({
      kind: "transfer",
      date: "2026-07-13",
      account: "Cash",
      amount: "10000",
      currency: "TWD",
      target_account: "Japan cash",
      target_amount: "45000",
      target_currency: "JPY",
    }, "import-transfer-2");

    expect(draft).toMatchObject({ transferMode: "cross-currency", destinationAmount: "45000", destinationCurrency: "JPY" });
    expect(toImportedTransactionDraft({ kind: "expense", account: "Cash" }, "invalid")).toBeNull();
  });

  test("restores multiple refund links from the portable delimiter", () => {
    const draft = toImportedTransactionDraft({
      kind: "refund",
      date: "2026-07-13",
      account: "Cash",
      amount: "80",
      currency: "TWD",
      category: "Shared",
      merchant: "Friend",
      refund_reason: "Shared payback",
      refund_subtype: "payback",
      refund_linked_record_ids: "expense-1|expense-2",
    }, "import-refund-3");

    expect(draft).toMatchObject({
      refundLinkedRecordId: "",
      refundLinkedRecordIds: ["expense-1", "expense-2"],
    });
  });

  test("preserves exchange-difference classification on imported refunds", () => {
    const draft = toImportedTransactionDraft({
      kind: "refund",
      date: "2026-07-13",
      account: "Cash",
      amount: "80",
      currency: "TWD",
      category: "Shared",
      merchant: "Friend",
      refund_reason: "Foreign currency refund",
      refund_subtype: "payback",
      refund_excess_handling: "exchange_difference",
    }, "import-refund-4");

    expect(draft?.refundExcessHandling).toBe("exchange_difference");
  });

  test("preserves grouping metadata from an imported row", () => {
    const draft = toImportedTransactionDraft({
      kind: "income",
      date: "2026-07-13",
      account: "Cash",
      amount: "80",
      currency: "TWD",
      category: "Salary",
      source: "Part-time job",
      tags: "monthly|work",
      event: "summer",
      source_label: "statement",
    }, "import-income-4");

    expect(draft).toMatchObject({
      tags: ["monthly", "work"],
      event: "summer",
      sourceLabel: "statement",
      counterparty: "Part-time job",
    });
  });
});
