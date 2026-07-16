import { describe, expect, test, vi } from "vitest";
import { createSupabasePersistenceClient, createSupabaseReferenceBootstrapClient, type RawSupabaseClient } from "./supabaseClient";

function rawClient(): RawSupabaseClient & { upsert: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> } {
  const upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const eq = vi.fn();
  const query = {
    eq: (column: string, value: unknown) => {
      eq(column, value);
      return query;
    },
    maybeSingle: () => Promise.resolve({ data: { request_hash: "hash-1" }, error: null }),
  };
  return {
    upsert,
    eq,
    from: vi.fn(() => ({
      upsert: () => ({
        select: () => Promise.resolve({ data: [{ id: "remote-1", name: "Daily" }], error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(upsert()).then(resolve),
      }),
      select: () => query,
    })),
  } as unknown as RawSupabaseClient & { upsert: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
}

describe("Supabase client boundary", () => {
  test("normalizes query builder operations for repository calls", async () => {
    const raw = rawClient();
    const client = createSupabasePersistenceClient(raw);
    const read = await client.from("idempotency_keys").select("request_hash").eq("user_id", "user-1").eq("idempotency_key", "key").maybeSingle();

    expect(read).toEqual({ data: { request_hash: "hash-1" }, error: null });
    expect(raw.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(raw.eq).toHaveBeenCalledWith("idempotency_key", "key");
  });

  test("keeps returning select for reference bootstrap", async () => {
    const raw = rawClient();
    const client = createSupabaseReferenceBootstrapClient(raw);
    const result = await client.from("categories").upsert([{ name: "Daily" }], { onConflict: "user_id,name" }).select("id,name");

    expect(result).toEqual({ data: [{ id: "remote-1", name: "Daily" }], error: null });
  });
});
