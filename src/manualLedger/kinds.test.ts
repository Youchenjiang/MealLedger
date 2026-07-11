import { describe, expect, test } from "vitest";
import { getManualRecordConfig, manualRecordKinds, requiredFieldsFor } from "./kinds";

describe("manual ledger kind configuration", () => {
  test("keeps all V1 manual record kinds available", () => {
    expect(manualRecordKinds).toEqual([
      "expense",
      "income",
      "transfer",
      "refund",
      "fund-addition",
      "adjustment",
      "unresolved-expense",
    ]);
  });

  test("uses account selectors instead of free-text accounts", () => {
    for (const kind of manualRecordKinds) {
      const accountFields = getManualRecordConfig(kind).fields.filter((field) => field.id.includes("account"));
      expect(accountFields.every((field) => field.control === "account-select")).toBe(true);
    }
  });

  test("requires the spreadsheet-equivalent fields for expenses and income", () => {
    expect(requiredFieldsFor("expense")).toEqual(["date", "account", "amount", "currency", "merchant", "item-name", "category"]);
    expect(requiredFieldsFor("income")).toEqual(["date", "account", "amount", "currency", "category", "source"]);
  });

  test("uses distinct same-currency and cross-currency transfer requirements", () => {
    expect(requiredFieldsFor("transfer", "same-currency")).toEqual([
      "date",
      "source-account",
      "destination-account",
      "amount",
      "currency",
    ]);
    expect(requiredFieldsFor("transfer", "cross-currency")).toEqual([
      "date",
      "source-account",
      "source-amount",
      "source-currency",
      "destination-account",
      "destination-amount",
      "destination-currency",
    ]);
  });

  test("keeps transfer fees optional and represented as separate accountable fields", () => {
    const variants = getManualRecordConfig("transfer").transferVariants;
    const feeFields = ["fee-account", "fee-amount", "fee-currency", "fee-category"];

    expect(variants).toHaveLength(2);
    expect(variants?.every((variant) => JSON.stringify(variant.optionalFieldIds) === JSON.stringify(feeFields))).toBe(true);
  });

  test("preserves distinct required fields for refunds, funding, adjustments, and unresolved expenses", () => {
    expect(requiredFieldsFor("refund")).toEqual([
      "date",
      "account",
      "amount",
      "currency",
      "merchant",
      "category",
      "refund-reason",
    ]);
    expect(requiredFieldsFor("fund-addition")).toEqual(["date", "account", "amount", "currency", "source"]);
    expect(requiredFieldsFor("adjustment")).toEqual(["date", "account", "amount", "currency", "reason"]);
    expect(requiredFieldsFor("unresolved-expense")).toEqual(["account", "amount", "currency", "time-precision"]);
  });
});
