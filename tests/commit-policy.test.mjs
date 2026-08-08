import { describe, expect, it } from "vitest";
import {
  POLICY,
  areasForPaths,
  scopeHintsForPaths,
  suggestScopesForPaths,
  validateCommitMessage,
  validateSubject,
} from "../scripts/commit-policy.mjs";

// These tests cover the single source of truth used by both the local
// commit-msg hook and the CI policy workflow. See docs/engineering/commit-policy.md.

describe("commit policy: subject", () => {
  it("accepts a valid subject", () => {
    expect(validateSubject("feat(meal): add photo-linked meal entries")).toEqual([]);
  });

  it("rejects a missing scope", () => {
    expect(validateSubject("feat: add photo-linked meal entries").length).toBeGreaterThan(0);
  });

  it("rejects an unknown type", () => {
    expect(validateSubject("feta(meal): add photo-linked meal entries").length).toBeGreaterThan(0);
  });

  it("rejects an unknown scope", () => {
    expect(validateSubject("feat(nonsense): add photo-linked entries").length).toBeGreaterThan(0);
  });

  it("rejects a subject over 72 characters", () => {
    expect(validateSubject(`feat(meal): ${"x".repeat(70)}`).length).toBeGreaterThan(0);
  });

  it("rejects an uppercase description start", () => {
    expect(validateSubject("feat(meal): Add photo-linked entries").length).toBeGreaterThan(0);
  });

  it("rejects a trailing period", () => {
    expect(validateSubject("feat(meal): add photo-linked entries.").length).toBeGreaterThan(0);
  });

  it("rejects vague descriptions", () => {
    expect(validateSubject("chore(ci): update").length).toBeGreaterThan(0);
  });

  it("accepts the quality scope used in real history", () => {
    expect(validateSubject("chore(quality): exclude RLS tests from analysis")).toEqual([]);
  });
});

describe("commit policy: message body", () => {
  it("accepts a numbered list body", () => {
    const message = [
      "feat(meal): add photo-linked entries",
      "",
      "1. Add the entry form.",
      "2. Wire the media picker.",
      "",
    ].join("\n");
    expect(validateCommitMessage(message)).toEqual([]);
  });

  it("accepts a body using '1)' style numbering", () => {
    const message = ["feat(meal): add photo-linked entries", "", "1) Add the entry form.", ""].join("\n");
    expect(validateCommitMessage(message)).toEqual([]);
  });

  it("rejects a bulleted-only body", () => {
    const message = [
      "feat(meal): add photo-linked entries",
      "",
      "Why:",
      "",
      "- something",
      "",
    ].join("\n");
    expect(validateCommitMessage(message).length).toBeGreaterThan(0);
  });

  it("rejects an empty body", () => {
    expect(validateCommitMessage("feat(meal): add photo-linked entries").length).toBeGreaterThan(0);
  });

  it("ignores git comment lines", () => {
    const message = [
      "feat(meal): add photo-linked entries",
      "",
      "1. Add the entry form.",
      "# Please enter the commit message for your changes.",
      "",
    ].join("\n");
    expect(validateCommitMessage(message)).toEqual([]);
  });

  it("rejects a bad subject even when the body is fine", () => {
    const message = ["feat: add photo-linked entries", "", "1. Add the entry form.", ""].join("\n");
    expect(validateCommitMessage(message).length).toBeGreaterThan(0);
  });
});

describe("commit policy: pre-commit scope hints", () => {
  it("suggests ledger scope for manualLedger changes", () => {
    const scopes = suggestScopesForPaths(["src/manualLedger/records.ts", "src/manualLedger/export.ts"]);
    expect(scopes).toContain("ledger");
  });

  it("maps docs changes to the docs scope", () => {
    expect(suggestScopesForPaths(["docs/engineering/commit-policy.md"])).toEqual(["docs"]);
  });

  it("maps supabase migrations to the supabase scope", () => {
    expect(suggestScopesForPaths(["supabase/migrations/0001_init.sql"])).toEqual(["supabase"]);
  });

  it("maps capture uploads to r2 and media", () => {
    const scopes = suggestScopesForPaths(["src/captureMedia/upload.ts"]);
    expect(scopes).toContain("r2");
    expect(scopes).toContain("media");
  });

  it("maps tests to the test scope", () => {
    expect(suggestScopesForPaths(["tests/commit-policy.test.mjs"])).toContain("test");
  });

  it("returns an empty list for unknown paths", () => {
    expect(suggestScopesForPaths(["mystery/file.bin"])).toEqual([]);
  });

  it("reports per-path hints for the --json output", () => {
    const hints = scopeHintsForPaths(["src/manualLedger/records.ts", "mystery/file.bin"]);
    expect(hints[0].path).toBe("src/manualLedger/records.ts");
    expect(hints[0].suggestedScopes).toContain("ledger");
    expect(hints[1].path).toBe("mystery/file.bin");
    expect(hints[1].suggestedScopes).toEqual([]);
  });

  it("normalizes Windows-style separators in path hints", () => {
    const hints = scopeHintsForPaths(["src\\manualLedger\\records.ts"]);
    expect(hints[0].path).toBe("src/manualLedger/records.ts");
    expect(hints[0].suggestedScopes).toContain("ledger");
  });

  it("keeps related prefixes in one area (no split nudge)", () => {
    // manualLedger and importExport are both the ledger area.
    expect(areasForPaths(["src/manualLedger/records.ts", "src/importExport/csv.ts"])).toEqual(["ledger"]);
  });

  it("flags unrelated areas for the atomic-commit tip", () => {
    expect(areasForPaths(["src/manualLedger/records.ts", "docs/engineering/foo.md"])).toEqual(["ledger", "docs"]);
  });

  it("returns no areas for unknown paths", () => {
    expect(areasForPaths(["mystery/file.bin"])).toEqual([]);
  });

  it("only ever suggests scopes from the allowlist", () => {
    for (const scope of suggestScopesForPaths(["src/manualLedger/records.ts", "src/ai/client.ts"])) {
      expect(POLICY.scopes).toContain(scope);
    }
  });
});
