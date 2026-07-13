import { describe, expect, test } from "vitest";
import type { LocalLedgerRecord } from "../manualLedger/records";
import { enqueueDraftSync, enqueueRecordSync, markCloudSyncFailure, markCloudSynced, markCloudSyncing, pendingCloudSyncItems } from "./syncQueue";

const record = { id: "record-1", idempotencyKey: "action-1", version: 1, updatedAt: "2026-07-13T00:00:00.000Z" } as LocalLedgerRecord;
const draft = { id: "draft-1" } as Parameters<typeof enqueueDraftSync>[1];
const now = "2026-07-13T00:00:00.000Z";

describe("cloud sync queue", () => {
  test("deduplicates record and draft targets", () => {
    const withRecord = enqueueRecordSync([], record, now);
    const withDraft = enqueueDraftSync(withRecord, draft, now);

    expect(enqueueRecordSync(withDraft, record, now)).toHaveLength(2);
    expect(enqueueDraftSync(withDraft, draft, now)).toHaveLength(2);
  });

  test("tracks attempt state and removes synced items from pending work", () => {
    const queued = enqueueRecordSync([], record, now);
    const syncing = markCloudSyncing(queued, queued[0].id, now);
    const synced = markCloudSynced(syncing, queued[0].id, now);

    expect(syncing[0]).toMatchObject({ state: "syncing", attempts: 1 });
    expect(pendingCloudSyncItems(synced, now)).toEqual([]);
  });

  test("schedules retryable failures and stops non-retryable failures", () => {
    const queued = enqueueRecordSync([], record, now);
    const syncing = markCloudSyncing(queued, queued[0].id, now);
    const retryable = markCloudSyncFailure(syncing, queued[0].id, "network", true, now);
    const failed = markCloudSyncFailure(syncing, queued[0].id, "denied", false, now);
    const conflict = markCloudSyncFailure(syncing, queued[0].id, "stale", false, now, "conflict");

    expect(retryable[0]).toMatchObject({ state: "retryable-error", nextAttemptAt: "2026-07-13T00:00:01.000Z" });
    expect(failed[0]).toMatchObject({ state: "failed", nextAttemptAt: null });
    expect(conflict[0]).toMatchObject({ state: "conflict", nextAttemptAt: null });
  });
});
