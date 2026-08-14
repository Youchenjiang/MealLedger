import { describe, expect, test } from "vitest";
import { DEFAULT_AI_ENTITY_POLICY, type AiEntityPolicy } from "./entityPolicy";
import {
  buildFieldCorrectionSystemPrompt,
  buildModeBDraft,
  modeBStepsFor,
  parseFieldCorrection,
  parseSpokenDate,
  type ModeBField,
} from "./modeB";

const accounts = [{ name: "Daily wallet", currency: "TWD" }];
const categories = ["午餐"];
const today = "2026-07-25";

const fullValues: Partial<Record<ModeBField, string>> = {
  date: "2026-07-25",
  kind: "expense",
  account: "Daily wallet",
  category: "午餐",
  counterparty: "麵店",
  itemName: "牛肉麵",
  amount: "480",
};

describe("mode B step sequence", () => {
  test("walks the fixed field order for ordinary kinds", () => {
    // skipcq: JS-W1042 -- the argument is explicit; the parameter is typed
    // as required (string | undefined) so TS rejects the no-arg form.
    expect(modeBStepsFor(undefined)).toEqual(["date", "kind", "account", "category", "counterparty", "itemName", "amount"]);
    expect(modeBStepsFor("expense")).toEqual(["date", "kind", "account", "category", "counterparty", "itemName", "amount"]);
  });

  test("inserts a transfer destination and drops the category step for transfers", () => {
    expect(modeBStepsFor("transfer")).toEqual(["date", "kind", "account", "transferAccount", "counterparty", "itemName", "amount"]);
  });
});

describe("per-field correction prompt", () => {
  const context = { accounts, categories, today, entityPolicy: DEFAULT_AI_ENTITY_POLICY };

  test("normalizes amount transcripts to digits", () => {
    const prompt = buildFieldCorrectionSystemPrompt("amount", context);
    expect(prompt).toContain("兩百五十");
    expect(prompt).toContain('{"value"');
  });

  test("converts dates to YYYY-MM-DD with the current year", () => {
    const prompt = buildFieldCorrectionSystemPrompt("date", context);
    expect(prompt).toContain("2026-07-25");
    expect(prompt).toContain("七月二十五");
  });

  test("restricts the kind to the three ledger kinds", () => {
    const prompt = buildFieldCorrectionSystemPrompt("kind", context);
    expect(prompt).toContain("expense");
    expect(prompt).toContain("transfer");
  });

  test("names the account list under the existing-only policy", () => {
    const prompt = buildFieldCorrectionSystemPrompt("account", context);
    expect(prompt).toContain("Daily wallet");
    expect(prompt).toContain("只能用現有帳戶名稱");
  });

  test("keeps the spoken name under an ask policy", () => {
    const prompt = buildFieldCorrectionSystemPrompt("account", {
      ...context,
      entityPolicy: { account: "ask", category: "existing" },
    });
    expect(prompt).toContain("用使用者講的帳戶名稱");
  });
});

describe("parseSpokenDate", () => {
  test("keeps a canonical ISO date padded", () => {
    expect(parseSpokenDate("2026-07-05", today)).toBe("2026-07-05");
    expect(parseSpokenDate("2026/7/5", today)).toBe("2026-07-05");
  });

  test("adds the current year to short slash dates", () => {
    expect(parseSpokenDate("7/25", today)).toBe("2026-07-25");
    expect(parseSpokenDate("7-5", today)).toBe("2026-07-05");
  });

  test("resolves Chinese-numeral dates", () => {
    expect(parseSpokenDate("七月二十五", today)).toBe("2026-07-25");
    expect(parseSpokenDate("7月25日", today)).toBe("2026-07-25");
    expect(parseSpokenDate("十二月三", today)).toBe("2026-12-03");
  });

  test("resolves relative dates", () => {
    expect(parseSpokenDate("今天", today)).toBe("2026-07-25");
    expect(parseSpokenDate("昨天", today)).toBe("2026-07-24");
    expect(parseSpokenDate("前天", today)).toBe("2026-07-23");
    expect(parseSpokenDate("明天", today)).toBe("2026-07-26");
  });

  test("returns null for unresolvable input", () => {
    expect(parseSpokenDate("", today)).toBeNull();
    expect(parseSpokenDate("   ", today)).toBeNull();
    expect(parseSpokenDate("下週二", today)).toBeNull();
    expect(parseSpokenDate("隨便", today)).toBeNull();
  });
});

describe("parseFieldCorrection", () => {
  test("extracts and trims a string value", () => {
    expect(parseFieldCorrection({ value: "  250  " })).toBe("250");
  });

  test("accepts numeric values", () => {
    expect(parseFieldCorrection({ value: 250 })).toBe("250");
  });

  test("returns an empty string for malformed payloads", () => {
    expect(parseFieldCorrection(null)).toBe("");
    expect(parseFieldCorrection({})).toBe("");
    expect(parseFieldCorrection({ value: { nested: true } })).toBe("");
  });
});

describe("buildModeBDraft", () => {
  test("builds a valid draft from complete values", () => {
    const result = buildModeBDraft(fullValues, accounts, categories, today, DEFAULT_AI_ENTITY_POLICY);
    expect(result.issues).toEqual([]);
    expect(result.draft).not.toBeNull();
    expect(result.draft?.amount).toBe("480");
    expect(result.draft?.account).toBe("Daily wallet");
    expect(result.draft?.kind).toBe("expense");
  });

  test("reports missing required fields", () => {
    const result = buildModeBDraft({ ...fullValues, amount: "" }, accounts, categories, today, DEFAULT_AI_ENTITY_POLICY);
    expect(result.draft).toBeNull();
    expect(result.issues).toContain("金額為空白。");
  });

  test("parses a typed spoken date into YYYY-MM-DD", () => {
    const result = buildModeBDraft({ ...fullValues, date: "七月二十五" }, accounts, categories, today, DEFAULT_AI_ENTITY_POLICY);
    expect(result.issues).toEqual([]);
    expect(result.draft?.date).toBe("2026-07-25");
  });

  test("adds the current year to a typed short date", () => {
    const result = buildModeBDraft({ ...fullValues, date: "7/25" }, accounts, categories, today, DEFAULT_AI_ENTITY_POLICY);
    expect(result.issues).toEqual([]);
    expect(result.draft?.date).toBe("2026-07-25");
  });

  test("rejects an unresolvable typed date instead of writing it raw", () => {
    const result = buildModeBDraft({ ...fullValues, date: "下週二" }, accounts, categories, today, DEFAULT_AI_ENTITY_POLICY);
    expect(result.draft).toBeNull();
    expect(result.issues.some((issue) => issue.includes("日期") && issue.includes("下週二"))).toBe(true);
  });

  test("rejects an unknown account under the existing-only policy", () => {
    const result = buildModeBDraft({ ...fullValues, account: "新錢包" }, accounts, categories, today, DEFAULT_AI_ENTITY_POLICY);
    expect(result.draft).toBeNull();
    expect(result.issues.some((issue) => issue.includes("新錢包"))).toBe(true);
  });

  test("carries a new account under the auto policy", () => {
    const autoPolicy: AiEntityPolicy = { account: "auto", category: "existing" };
    const result = buildModeBDraft({ ...fullValues, account: "新錢包" }, accounts, categories, today, autoPolicy);
    expect(result.newAccount).toBe("新錢包");
    expect(result.draft).not.toBeNull();
    expect(result.issues).toEqual([]);
  });

  test("builds a transfer draft with a new destination", () => {
    const autoPolicy: AiEntityPolicy = { account: "auto", category: "auto" };
    const result = buildModeBDraft(
      { ...fullValues, kind: "transfer", transferAccount: "新儲蓄戶", category: "" },
      accounts,
      categories,
      today,
      autoPolicy,
    );
    expect(result.newTransferAccount).toBe("新儲蓄戶");
    expect(result.draft?.kind).toBe("transfer");
    expect(result.draft?.transferAccount).toBe("新儲蓄戶");
  });

  test("rejects a transfer to the source account", () => {
    const result = buildModeBDraft(
      { ...fullValues, kind: "transfer", transferAccount: "Daily wallet", category: "" },
      accounts,
      categories,
      today,
      DEFAULT_AI_ENTITY_POLICY,
    );
    expect(result.draft).toBeNull();
  });
});
