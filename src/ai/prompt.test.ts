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
});
