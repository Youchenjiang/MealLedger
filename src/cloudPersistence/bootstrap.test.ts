import { describe, expect, test, vi } from "vitest";
import type { LocalAccount } from "../manualLedger/accounts";
import { bootstrapReferences, type ReferenceBootstrapClient } from "./bootstrap";

const accounts: LocalAccount[] = [
  { id: "account-local-1", name: "Cash", currency: "TWD" },
];

function client(options: { omitTable?: string } = {}): ReferenceBootstrapClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    from(table: string) {
      return {
        upsert: vi.fn((rows: Array<Record<string, unknown>>, _options?: { onConflict?: string }) => ({
          select: vi.fn(async () => {
            calls.push(table);
            if (options.omitTable === table) return { data: [], error: null };
            return {
              data: rows.map((row, index) => ({
                id: `remote-${table}-${index}`,
                name: row.name,
              })),
              error: null,
            };
          }),
        })),
      };
    },
  } as ReferenceBootstrapClient & { calls: string[] };
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
        accountIds: { Cash: "remote-accounts-0" },
        categoryIds: { Daily: "remote-categories-0" },
        tagIds: { Subscription: "remote-tags-0" },
        eventIds: { Trip: "remote-events-0" },
      },
    });
    expect(mock.calls).toEqual(["accounts", "categories", "tags", "events"]);
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
});
