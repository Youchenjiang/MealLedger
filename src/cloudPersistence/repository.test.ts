import { describe, expect, test, vi } from "vitest";
import type { CloudPersistenceClient, CloudRecordBundle, CloudRow } from "./contracts";
import { persistRecordBundle } from "./repository";

function bundle(): CloudRecordBundle {
  return {
    ledgerRecord: { id: "record-1", user_id: "user-1", kind: "expense", amount_minor: "100" },
    refundLinks: [],
    auditEvents: [{ id: "audit-1", user_id: "user-1" }],
  };
}

function client(options: { existing?: CloudRow | null; failTable?: string } = {}): CloudPersistenceClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    from(table: string) {
      return {
        select() {
          return {
            eq() { return this; },
            maybeSingle: vi.fn(async () => ({ data: options.existing ?? null, error: null })),
          };
        },
        upsert: vi.fn(async () => {
          calls.push(table);
          return options.failTable === table
            ? { data: null, error: { message: `${table} failed`, code: "network" } }
            : { data: null, error: null };
        }),
      };
    },
  } as CloudPersistenceClient & { calls: string[] };
}

const request = {
  userId: "user-1",
  actionType: "record-create",
  idempotencyKey: "action-1",
  requestHash: "hash-1",
  expiresAt: "2026-07-14T00:00:00.000Z",
};

describe("cloud persistence repository", () => {
  test("writes a bundle in dependency order", async () => {
    const mock = client();
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: true, replayed: false });
    expect(mock.calls).toEqual(["idempotency_keys", "ledger_records", "audit_events"]);
  });

  test("replays the same idempotency key without writing again", async () => {
    const mock = client({ existing: { request_hash: "hash-1" } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toEqual({ ok: true, replayed: true, tables: ["idempotency_keys"] });
    expect(mock.calls).toEqual([]);
  });

  test("rejects a reused key with a different request hash", async () => {
    const mock = client({ existing: { request_hash: "old-hash" } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: false, failure: { code: "idempotency", retryable: false } });
  });

  test("keeps child failure retryable and does not report success", async () => {
    const mock = client({ failTable: "audit_events" });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: false, failure: { code: "transport", retryable: true, table: "audit_events" } });
    expect(mock.calls).toEqual(["idempotency_keys", "ledger_records", "audit_events"]);
  });
});
