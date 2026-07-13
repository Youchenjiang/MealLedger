import { describe, expect, test } from "vitest";
import { isUsableSupabaseConfig } from "./supabaseConfig";

describe("Supabase configuration validation", () => {
  test("rejects example placeholders from the environment template", () => {
    expect(isUsableSupabaseConfig({
      url: "https://your-project.supabase.co",
      anonKey: "replace-with-anon-key",
    })).toBe(false);
  });

  test("accepts a concrete HTTPS project URL and key", () => {
    expect(isUsableSupabaseConfig({
      url: "https://meal-ledger.supabase.co",
      anonKey: "a-concrete-anon-key",
    })).toBe(true);
  });

  test("accepts HTTP only when explicitly enabled for local development", () => {
    expect(isUsableSupabaseConfig({
      url: "http://127.0.0.1:54321",
      anonKey: "a-local-anon-key",
    }, { allowHttp: true })).toBe(true);
    expect(isUsableSupabaseConfig({
      url: "http://127.0.0.1:54321",
      anonKey: "a-local-anon-key",
    })).toBe(false);
  });

  test("rejects malformed URLs and incomplete values", () => {
    expect(isUsableSupabaseConfig({ url: "not-a-url", anonKey: "key" })).toBe(false);
    expect(isUsableSupabaseConfig({ url: "https://meal-ledger.supabase.co" })).toBe(false);
    expect(isUsableSupabaseConfig({ anonKey: "key" })).toBe(false);
  });
});
