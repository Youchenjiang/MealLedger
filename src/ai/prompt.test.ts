import { describe, expect, test } from "vitest";
import { buildLedgerSystemPrompt, buildUserPrompt } from "./prompt";

describe("buildUserPrompt", () => {
  test("returns the trimmed text when the user typed something", () => {
    expect(buildUserPrompt("  7/25 吃麵 480  ")).toBe("7/25 吃麵 480");
  });

  test("returns the line-item receipt prompt when only an image is provided", () => {
    const prompt = buildUserPrompt("", "data:image/png;base64,AAAA");
    expect(prompt).toContain("逐行辨識");
    expect(prompt).toContain("75g");
    expect(prompt).toContain("總計");
  });

  test("returns an empty string with no text and no image", () => {
    expect(buildUserPrompt("")).toBe("");
  });
});

describe("buildLedgerSystemPrompt", () => {
  const context = {
    accounts: [{ name: "現金", currency: "TWD" }],
    categories: ["飲食", "交通"],
    today: "2026-08-08",
    entityPolicy: { account: "existing", category: "existing" } as const,
  };

  test("includes the accounts, categories, and today in the prompt", () => {
    const prompt = buildLedgerSystemPrompt(context);
    expect(prompt).toContain("現金");
    expect(prompt).toContain("飲食");
    expect(prompt).toContain("2026-08-08");
  });

  test("instructs the model to return JSON only", () => {
    const prompt = buildLedgerSystemPrompt(context);
    expect(prompt).toContain("只能回傳 JSON");
  });

  test("asks the model to report which fields the user explicitly mentioned", () => {
    const prompt = buildLedgerSystemPrompt(context);
    expect(prompt).toContain("explicit");
    expect(prompt).toContain("明確說出");
  });

  test("restricts accounts and categories to the lists under the existing policy", () => {
    const prompt = buildLedgerSystemPrompt(context);
    expect(prompt).toContain("account 只能從這些帳戶選");
    expect(prompt).toContain("category 只能從這些類別選");
    expect(prompt).not.toContain("用使用者講的帳戶名");
  });

  test("allows new account and category names when the policy permits them", () => {
    const prompt = buildLedgerSystemPrompt({
      ...context,
      entityPolicy: { account: "auto", category: "ask" },
    });
    expect(prompt).toContain("account 用使用者講的帳戶名");
    expect(prompt).toContain("category 用使用者講的類別名");
    expect(prompt).toContain("現有帳戶:現金");
    expect(prompt).toContain("現有類別:飲食、交通");
  });

  test("tells the model not to invent amounts and to keep times out of entity fields", () => {
    const prompt = buildLedgerSystemPrompt(context);
    expect(prompt).toContain("不要猜數字");
    expect(prompt).toContain("「7/25」「25號」是日期,不是金額");
    expect(prompt).toContain("「中午」「下午」「晚上」是時間");
    expect(prompt).toContain("counterparty 是店家或同行的人");
  });
});
