import { describe, expect, test, vi } from "vitest";
import type { LocalAccount } from "../manualLedger/accounts";
import { bootstrapReferences, type ReferenceBootstrapClient } from "./bootstrap";

const accounts: LocalAccount[] = [
  { id: "account-local-1", name: "Cash", currency: "TWD" },
];

function client(options: { omitTable?: string } = {}): ReferenceBootstrapClient & { calls: string[]; conflicts: string[] } {
  const calls: string[] = [];
  const conflicts: string[] = [];
  return {
    calls,
    conflicts,
    from(table: string) {
      return {
        upsert: vi.fn((rows: Array<Record<string, unknown>>, upsertOptions?: { onConflict?: string }) => ({
          select: vi.fn(() => {
            calls.push(table);
            conflicts.push(upsertOptions?.onConflict ?? "");
            if (options.omitTable === table) return Promise.resolve({ data: [], error: null });
            return Promise.resolve({
              data: rows.map((row, index) => ({
                id: `remote-${table}-${index}`,
                name: row.name,
              })),
              error: null,
            });
          }),
        })),
      };
    },
  } as ReferenceBootstrapClient & { calls: string[]; conflicts: string[] };
}

describe("cloud reference bootstrap", () => {
  test("upserts names and returns remote reference maps", async () => {
    const mock = client();
    const result = await bootstrapReferences(mock, {
      userId: "user-1",
      accounts,
      categories: ["Daily", "Daily"],
      tags: ["Subscription"],
      events: ["Trip"],
    });

    expect(result).toEqual({
      ok: true,
      references: {
        accountIds: { "account-local-1": "remote-accounts-0" },
        categoryIds: { Daily: "remote-categories-0" },
        merchantIds: {},
        tagIds: { Subscription: "remote-tags-0" },
        eventIds: { Trip: "remote-events-0" },
      },
    });
    expect(mock.calls).toEqual(["accounts", "categories", "tags", "events"]);
    expect(mock.conflicts).toEqual(["user_id,name", "user_id,parent_key,name", "user_id,name", "user_id,name"]);
  });

  test("does not continue when a reference response is incomplete", async () => {
    const mock = client({ omitTable: "categories" });
    const result = await bootstrapReferences(mock, {
      userId: "user-1",
      accounts,
      categories: ["Daily"],
      tags: ["Subscription"],
    });

    expect(result).toEqual({ ok: false, table: "categories", message: "Cloud reference response omitted: Daily." });
    expect(mock.calls).toEqual(["accounts", "categories"]);
  });

  test("skips empty optional reference groups", async () => {
    const mock = client();
    await bootstrapReferences(mock, { userId: "user-1", accounts });

    expect(mock.calls).toEqual(["accounts"]);
  });

  test("bootstraps merchant names with a normalized uniqueness key", async () => {
    const mock = client();
    const result = await bootstrapReferences(mock, { userId: "user-1", accounts, merchants: [" Market "] });

    expect(result).toMatchObject({ ok: true, references: { merchantIds: { Market: "remote-merchants-0" } } });
    expect(mock.calls).toEqual(["accounts", "merchants"]);
    expect(mock.conflicts).toEqual(["user_id,name", "user_id,normalized_name"]);
  });
});
