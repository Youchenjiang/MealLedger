import { describe, expect, test, vi } from "vitest";
import type { CloudMealBundle, CloudMutationError, CloudPersistenceClient, CloudRecordBundle, CloudRow } from "./contracts";
import { persistMealBundle, persistMediaAsset, persistProfile, persistRecordBundle, persistSourcePayload } from "./repository";

function bundle(): CloudRecordBundle {
  return {
    ledgerRecord: { id: "record-1", user_id: "user-1", kind: "expense", amount_minor: "100" },
    refundLinks: [],
    ledgerRecordTags: [],
    auditEvents: [{ id: "audit-1", user_id: "user-1" }],
  };
}

function client(options: { existing?: CloudRow | null; failTable?: string; rpc?: boolean; rpcError?: CloudMutationError } = {}): CloudPersistenceClient & { calls: string[] } {
  const calls: string[] = [];
  // The server RPC reports a replay only when the idempotency key was claimed
  // and is still valid; an expired claim is deleted and written fresh.
  const existingExpired = Boolean(
    options.existing
    && typeof options.existing.expires_at === "string"
    && Date.parse(options.existing.expires_at) <= Date.now()
    && !options.existing.response_json,
  );
  const rpcReplayed = Boolean(options.existing && !options.existing.response_json && !existingExpired);
  return {
    calls,
    ...(options.rpc ? {
      rpc: vi.fn(() => Promise.resolve(
        options.rpcError
          ? { data: null, error: options.rpcError }
          : options.failTable
            ? { data: null, error: { message: `${options.failTable} failed`, code: "network" } }
            : { data: { replayed: rpcReplayed }, error: null },
      )),
    } : {}),
    from(table: string) {
      return {
        select() {
          return {
            eq() { return this; },
            maybeSingle: vi.fn(() => Promise.resolve({
              data: table === "idempotency_keys" ? options.existing ?? null : null,
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
  test("persists a profile with the authenticated owner key", async () => {
    const mock = client();
    const result = await persistProfile(mock, { user_id: "user-1", default_currency: "TWD", default_timezone: "Asia/Taipei" });

    expect(result).toMatchObject({ ok: true, tables: ["profiles"] });
    expect(mock.calls).toEqual(["profiles"]);
  });

  test("writes a ledger bundle through the atomic RPC boundary", async () => {
    const mock = client({ rpc: true });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({
      ok: true,
      replayed: false,
      tables: expect.arrayContaining(["idempotency_keys", "ledger_records", "audit_events"]),
    });
    expect(mock.rpc).toHaveBeenCalledWith("persist_ledger_record_bundle_resolved", expect.objectContaining({
      p_ledger_record: expect.objectContaining({ id: "record-1" }),
      p_transfer_details: {},
      p_refund_links: [],
    }));
    expect(mock.calls).toEqual([]);
  });

  test("passes refund links, tags, and audit events to the RPC", async () => {
    const mock = client({ rpc: true });
    const result = await persistRecordBundle(mock, request, {
      ...bundle(),
      refundLinks: [{ refund_record_id: "record-1", original_record_id: "original-1", amount_minor: "100", currency: "TWD" }],
      ledgerRecordTags: [{ user_id: "user-1", ledger_record_id: "record-1", tag_id: "tag-1" }],
    });

    expect(result).toMatchObject({
      ok: true,
      tables: expect.arrayContaining(["refund_links", "ledger_record_tags"]),
    });
    expect(mock.rpc).toHaveBeenCalledWith("persist_ledger_record_bundle_resolved", expect.objectContaining({
      p_refund_links: [{ refund_record_id: "record-1", original_record_id: "original-1", amount_minor: "100", currency: "TWD" }],
      p_ledger_record_tags: [{ user_id: "user-1", ledger_record_id: "record-1", tag_id: "tag-1" }],
      p_audit_events: [{ id: "audit-1", user_id: "user-1" }],
    }));
  });

  test("forwards a claimed but incomplete idempotency key to the RPC", async () => {
    const mock = client({ rpc: true, existing: { request_hash: "hash-1" } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: true, replayed: true });
    expect(mock.rpc).toHaveBeenCalled();
    expect(mock.calls).toEqual([]);
  });

  test("rejects a reused key with a different request hash", async () => {
    const mock = client({ existing: { request_hash: "old-hash" } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: false, failure: { code: "idempotency", retryable: false } });
  });

  test("allows an expired key to be reused with a new request hash", async () => {
    const mock = client({ rpc: true, existing: { request_hash: "old-hash", expires_at: "2000-01-01T00:00:00.000Z" } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: true, replayed: false });
    expect(mock.rpc).toHaveBeenCalled();
  });

  test("does not reuse an expired key after a successful result was stored", async () => {
    const mock = client({ existing: { request_hash: "hash-1", expires_at: "2000-01-01T00:00:00.000Z", response_json: { ledger_record_id: "record-1" } } });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({ ok: true, replayed: true, completed: true, tables: ["idempotency_keys"] });
    expect(mock.calls).toEqual([]);
  });

  test("reports an RPC failure as retryable without marking synced", async () => {
    const mock = client({ rpc: true, failTable: "audit_events" });
    const result = await persistRecordBundle(mock, request, bundle());

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "transport", retryable: true, table: "persist_ledger_record_bundle_resolved" },
    });
    expect(mock.calls).toEqual([]);
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

  test("rejects a stale ledger version reported by the RPC", async () => {
    const mock = client({ rpc: true, rpcError: { message: "ledger record version conflict", code: "ME002" } });
    const result = await persistRecordBundle(mock, request, {
      ...bundle(),
      ledgerRecord: { ...bundle().ledgerRecord, version: 2 },
    });

    expect(result).toMatchObject({
      ok: false,
      failure: { code: "conflict", retryable: false, table: "persist_ledger_record_bundle_resolved" },
    });
  });

  test("does not pretend a ledger record is synced without an atomic RPC boundary", async () => {
    const mock = client();
    const result = await persistRecordBundle(mock, request, {
      ...bundle(),
      transferDetails: { ledger_record_id: "record-1", destination_account_id: "account-2" },
    });

    expect(result).toMatchObject({ ok: false, failure: { code: "validation", table: "ledger_records" } });
    expect(mock.calls).toEqual([]);
  });

  test("routes transfer bundles through the same atomic RPC boundary", async () => {
    const mock = client({ rpc: true });
    const result = await persistRecordBundle(mock, request, {
      ...bundle(),
      transferDetails: { ledger_record_id: "record-1", destination_account_id: "account-2" },
    });

    expect(result).toMatchObject({ ok: true, replayed: false, tables: expect.arrayContaining(["transfer_details"]) });
    expect(mock.rpc).toHaveBeenCalledWith("persist_ledger_record_bundle_resolved", expect.objectContaining({
      p_request: {
        user_id: "user-1",
        action_type: "record-create",
        idempotency_key: "action-1",
        request_hash: "hash-1",
        expires_at: "2026-07-14T00:00:00.000Z",
      },
      p_transfer_details: expect.objectContaining({ ledger_record_id: "record-1", destination_account_id: "account-2" }),
    }));
    expect(mock.calls).toEqual([]);
  });
});
