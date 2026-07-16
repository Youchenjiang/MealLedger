import { describe, expect, test, vi } from "vitest";
import type { CloudMealBundle, CloudPersistenceClient, CloudRecordBundle, CloudRow } from "./contracts";
import { persistMealBundle, persistMediaAsset, persistRecordBundle, persistSourcePayload } from "./repository";

function bundle(): CloudRecordBundle {
  return {
    ledgerRecord: { id: "record-1", user_id: "user-1", kind: "expense", amount_minor: "100" },
    refundLinks: [],
    ledgerRecordTags: [],
    auditEvents: [{ id: "audit-1", user_id: "user-1" }],
  };
}

function client(options: { existing?: CloudRow | null; ledgerVersion?: number; failTable?: string; rpc?: boolean } = {}): CloudPersistenceClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    ...(options.rpc ? { rpc: vi.fn(() => Promise.resolve({ data: { replayed: false }, error: null })) } : {}),
    from(table: string) {
      return {
        select() {
          return {
            eq() { return this; },
            maybeSingle: vi.fn(() => Promise.resolve({
              data: table === "idempotency_keys" ? options.existing ?? null : options.ledgerVersion === undefined ? null : { version: options.ledgerVersion },
              error: null,
            })),
          };
        },
        upsert: vi.fn(() => {
          calls.push(table);
          return Promise.resolve(options.failTable === table
            ? { data: null, error: { message: `${table} failed`, code: "network" } }
            : { data: null, error: null });
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
    expect(mock.calls).toEqual(["idempotency_keys", "ledger_records", "audit_events", "idempotency_keys"]);
  });

  test("persists record tags after the ledger parent", async () => {
    const mock = client();
    const result = await persistRecordBundle(mock, request, {
      ...bundle(),
      ledgerRecordTags: [{ user_id: "user-1", ledger_record_id: "record-1", tag_id: "tag-1" }],
    });

    expect(result).toMatchObject({ ok: true, tables: ["idempotency_keys", "ledger_records", "ledger_record_tags", "audit_events"] });
    expect(mock.calls).toEqual(["idempotency_keys", "ledger_records", "ledger_record_tags", "audit_events", "idempotency_keys"]);
  });

  test("replays the same idempotency key without writing again", async () => {
    const mock = client({ existing: { request_hash: "hash-1" } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: true, replayed: true, tables: ["idempotency_keys", "ledger_records", "audit_events"] });
    expect(mock.calls).toEqual(["idempotency_keys", "ledger_records", "audit_events", "idempotency_keys"]);
  });

  test("rejects a reused key with a different request hash", async () => {
    const mock = client({ existing: { request_hash: "old-hash" } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: false, failure: { code: "idempotency", retryable: false } });
  });

  test("allows an expired key to be reused with a new request hash", async () => {
    const mock = client({ existing: { request_hash: "old-hash", expires_at: "2000-01-01T00:00:00.000Z" } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: true, replayed: false });
    expect(mock.calls).toContain("ledger_records");
  });

  test("does not reuse an expired key after a successful result was stored", async () => {
    const mock = client({ existing: { request_hash: "hash-1", expires_at: "2000-01-01T00:00:00.000Z", response_json: { ledger_record_id: "record-1" } } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: true, replayed: true, completed: true, tables: ["idempotency_keys"] });
    expect(mock.calls).toEqual([]);
  });

  test("keeps child failure retryable and does not report success", async () => {
    const mock = client({ failTable: "audit_events" });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: false, failure: { code: "transport", retryable: true, table: "audit_events" } });
    expect(mock.calls).toEqual(["idempotency_keys", "ledger_records", "audit_events"]);
  });

  test("writes media metadata, source payload, and meal links without media bytes", async () => {
    const mock = client();
    const mediaResult = await persistMediaAsset(mock, { id: "media-1", user_id: "user-1", object_key: "pending/media-1" });
    const sourceResult = await persistSourcePayload(
      mock,
      { id: "source-1", user_id: "user-1", source_state: "temporary" },
      [{ media_asset_id: "media-1", target_type: "source-payload", target_id: "source-1", link_intent: "receipt-evidence", user_id: "user-1" }],
    );
    const meal: CloudMealBundle = {
      mealEntry: { id: "meal-1", user_id: "user-1", meal_at: "2026-07-13T04:30:00.000Z" },
      transactionLinks: [{ meal_id: "meal-1", ledger_record_id: "record-1", user_id: "user-1" }],
      mediaLinks: [{ media_asset_id: "media-1", target_type: "meal", target_id: "meal-1", link_intent: "meal-photo", user_id: "user-1" }],
    };
    const mealResult = await persistMealBundle(mock, meal);

    expect(mediaResult).toMatchObject({ ok: true, tables: ["media_assets"] });
    expect(sourceResult).toMatchObject({ ok: true, tables: ["source_payloads", "media_links"] });
    expect(mealResult).toMatchObject({ ok: true, tables: ["meal_entries", "meal_transaction_links", "media_links"] });
    expect(mock.calls).toEqual(["media_assets", "source_payloads", "media_links", "meal_entries", "meal_transaction_links", "media_links"]);
  });

  test("rejects a stale ledger version before overwriting the cloud row", async () => {
    const mock = client({ ledgerVersion: 4 });
    const result = await persistRecordBundle(mock, request, {
      ...bundle(),
      ledgerRecord: { ...bundle().ledgerRecord, version: 2 },
    });

    expect(result).toMatchObject({ ok: false, failure: { code: "conflict", table: "ledger_records" } });
    expect(mock.calls).toEqual([]);
  });

  test("does not pretend a transfer is synced without an atomic RPC boundary", async () => {
    const mock = client();
    const result = await persistRecordBundle(mock, request, {
      ...bundle(),
      transferDetails: { ledger_record_id: "record-1", destination_account_id: "account-2" },
    });

    expect(result).toMatchObject({ ok: false, failure: { code: "validation", table: "transfer_details" } });
    expect(mock.calls).toEqual([]);
  });

  test("uses the atomic RPC boundary for transfer bundles", async () => {
    const mock = client({ rpc: true });
    const result = await persistRecordBundle(mock, request, {
      ...bundle(),
      transferDetails: { ledger_record_id: "record-1", destination_account_id: "account-2" },
    });

    expect(result).toMatchObject({ ok: true, replayed: false, tables: expect.arrayContaining(["transfer_details"]) });
    expect(mock.rpc).toHaveBeenCalledWith("persist_ledger_record_bundle", expect.objectContaining({ p_transfer_details: expect.any(Object) }));
    expect(mock.calls).toEqual([]);
  });
});
