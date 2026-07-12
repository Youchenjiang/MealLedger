import { describe, expect, test } from "vitest";
import { mapImportHeaders, mapImportRow } from "./mapping";

describe("import header mapping", () => {
  test("maps the user's expense spreadsheet headers to normalized fields", () => {
    const headers = ["日期", "店家", "名稱", "種類", "金額", "帳戶"];
    const result = mapImportHeaders(headers);

    expect(result.mapping).toEqual({
      date: "日期",
      merchant: "店家",
      item_name: "名稱",
      category: "種類",
      amount: "金額",
      account: "帳戶",
    });
    expect(result.mapping.category).toBe("種類");
    expect(result.mapping.kind).toBeUndefined();
  });

  test("maps transfer source and destination accounts distinctly", () => {
    const headers = ["日期", "原帳戶", "金額", "後帳戶"];
    const result = mapImportHeaders(headers);

    expect(result.mapping).toMatchObject({ date: "日期", account: "原帳戶", amount: "金額", target_account: "後帳戶" });
  });

  test("reports unmapped and duplicate canonical columns", () => {
    const result = mapImportHeaders(["date", "日期", "金額", "未知欄位"]);

    expect(result.conflicts).toContain("Multiple columns map to date: date and 日期.");
    expect(result.unmappedHeaders).toEqual(["未知欄位"]);
  });

  test("normalizes mapped row values and leaves unmapped columns out", () => {
    const headers = ["日期", "帳戶", "金額", "店家", "備註"];
    const result = mapImportRow(headers, [" 2026/07/13 ", " 小狗錢包 ", " 70 ", " 全聯 ", "月底補登 "]);

    expect(result).toEqual({ date: "2026/07/13", account: "小狗錢包", amount: "70", merchant: "全聯", notes: "月底補登" });
  });
});
