import { describe, expect, test } from "vitest";
import type { MealEntry } from "../captureMedia/meals";
import type { TemporaryScan } from "../captureMedia/media";
import type { LocalLedgerRecord } from "../manualLedger/records";
import type { UploadQueueItem } from "../captureMedia/upload";
import { enqueueAccountSync, enqueueDraftSync, enqueueMealSync, enqueueMediaSync, enqueueRecordSync, enqueueScanSync, markCloudSyncFailure, markCloudSynced, markCloudSyncing, pendingCloudSyncItems, retryCloudSyncItem } from "./syncQueue";

const record = { id: "record-1", idempotencyKey: "action-1", version: 1, updatedAt: "2026-07-13T00:00:00.000Z" } as LocalLedgerRecord;
const draft = { id: "draft-1" } as Parameters<typeof enqueueDraftSync>[1];
const now = "2026-07-13T00:00:00.000Z";
const account = { id: "account-1", name: "Daily wallet", currency: "TWD", accountType: "cash", allowNegativeBalance: true };

describe("cloud sync queue", () => {
  test("queues an account before any record exists", () => {
    const queued = enqueueAccountSync([], account, now);

    expect(queued).toMatchObject([{
      target: "account",
      targetId: "account-1",
      actionType: "account-reference",
      idempotencyKey: "account:account-1",
      state: "pending",
    }]);
    expect(enqueueAccountSync(queued, account, now)).toBe(queued);
  });

  test("deduplicates record and draft targets", () => {
    const withRecord = enqueueRecordSync([], record, now);
    const withDraft = enqueueDraftSync(withRecord, draft, now);

    expect(enqueueRecordSync(withDraft, record, now)).toHaveLength(2);
    expect(enqueueDraftSync(withDraft, draft, now)).toHaveLength(2);
  });

  test("queues linked transfer fees before their transfer parent", async () => {
    const { enqueueLocalChanges } = await import("./syncService");
    const transfer = { ...record, id: "transfer-1", kind: "transfer" } as LocalLedgerRecord;
    const fee = { ...record, id: "fee-1", linkedRecordId: "transfer-1" } as LocalLedgerRecord;

    expect(enqueueLocalChanges([], [], [transfer, fee], [], [], [], [], now).map((item) => item.targetId)).toEqual(["fee-1", "transfer-1"]);
  });

  test("reopens a synced record when its version or updated time changes", () => {
    const queued = enqueueRecordSync([], { ...record, status: "synced" }, now);
    expect(queued).toEqual([]);

    const local = enqueueRecordSync([], { ...record, status: "local-only" }, now);
    const synced = markCloudSynced(local, local[0].id, now);
    const edited = enqueueRecordSync(synced, { ...record, status: "synced", version: 2, updatedAt: "2026-07-13T01:00:00.000Z" }, now);

    expect(edited[0]).toMatchObject({ state: "pending", requestHash: "record-1:2:2026-07-13T01:00:00.000Z", lastError: "" });
  });

  test("reopens changed draft, meal, and scan targets after they were synced", () => {
    const firstDraft = enqueueDraftSync([], { id: "draft-1", note: "before" } as Parameters<typeof enqueueDraftSync>[1], now);
    const syncedDraft = markCloudSynced(firstDraft, firstDraft[0].id, now);
    const changedDraft = enqueueDraftSync(syncedDraft, { id: "draft-1", note: "after" } as Parameters<typeof enqueueDraftSync>[1], "2026-07-13T01:00:00.000Z");

    const meal = { id: "meal-1", occurredAt: "2026-07-13T12:30", note: "before", transactionIds: [], mediaAssetIds: [], status: "local-only" as const } satisfies MealEntry;
    const firstMeal = enqueueMealSync([], meal, now);
    const syncedMeal = markCloudSynced(firstMeal, firstMeal[0].id, now);
    const changedMeal = enqueueMealSync(syncedMeal, { ...meal, note: "after", status: "local-only" }, "2026-07-13T01:00:00.000Z");

    const scan = { id: "scan-1", intent: "scan-receipt" as const, fileName: "receipt.jpg", mimeType: "image/jpeg", byteSize: 10, state: "temporary" as const, cloudStatus: "local-only" as const, createdAt: now, expiresAt: "2026-07-14T00:00:00.000Z" } satisfies TemporaryScan;
    const firstScan = enqueueScanSync([], scan, now);
    const syncedScan = markCloudSynced(firstScan, firstScan[0].id, now);
    const changedScan = enqueueScanSync(syncedScan, { ...scan, state: "retained", cloudStatus: "local-only", expiresAt: null }, "2026-07-13T01:00:00.000Z");

    const media = { id: "media-1", name: "receipt.jpg", type: "image/jpeg", size: 10, status: "queued", kind: "receipt-scan", metadataStatus: "local-only" } satisfies UploadQueueItem;
    const firstMedia = enqueueMediaSync([], media, now);
    const syncedMedia = markCloudSynced(firstMedia, firstMedia[0].id, now);
    const changedMedia = enqueueMediaSync(syncedMedia, { ...media, size: 20, metadataStatus: "local-only" }, "2026-07-13T01:00:00.000Z");

    expect(changedDraft[0]).toMatchObject({ state: "pending", attempts: 0, nextAttemptAt: "2026-07-13T01:00:00.000Z" });
    expect(changedMeal[0]).toMatchObject({ state: "pending", attempts: 0, nextAttemptAt: "2026-07-13T01:00:00.000Z" });
    expect(changedScan[0]).toMatchObject({ state: "pending", attempts: 0, nextAttemptAt: "2026-07-13T01:00:00.000Z" });
    expect(changedMedia[0]).toMatchObject({ state: "pending", attempts: 0, nextAttemptAt: "2026-07-13T01:00:00.000Z" });
  });

  test("keeps successful meal, media, and scan sync items closed", () => {
    const meal = { id: "meal-closed", occurredAt: "2026-07-13T12:30", note: "meal", transactionIds: [], mediaAssetIds: [], status: "local-only" as const } satisfies MealEntry;
    const mealSynced = markCloudSynced(enqueueMealSync([], meal, now), "cloud-sync-meal-meal-closed", now);

    const media = { id: "media-closed", name: "meal.jpg", type: "image/jpeg", size: 10, status: "queued", kind: "meal-photo", metadataStatus: "local-only" } satisfies UploadQueueItem;
    const mediaSynced = markCloudSynced(enqueueMediaSync([], media, now), "cloud-sync-media-media-closed", now);

    const scan = { id: "scan-closed", intent: "scan-receipt" as const, fileName: "receipt.jpg", mimeType: "image/jpeg", byteSize: 10, state: "temporary" as const, cloudStatus: "local-only" as const, createdAt: now, expiresAt: "2026-07-14T00:00:00.000Z" } satisfies TemporaryScan;
    const scanSynced = markCloudSynced(enqueueScanSync([], scan, now), "cloud-sync-scan-scan-closed", now);

    expect(enqueueMealSync(mealSynced, { ...meal, note: "same remote version", status: "synced" }, "2026-07-13T01:00:00.000Z")[0].state).toBe("synced");
    expect(enqueueMediaSync(mediaSynced, { ...media, size: 20, metadataStatus: "synced" }, "2026-07-13T01:00:00.000Z")[0].state).toBe("synced");
    expect(enqueueScanSync(scanSynced, { ...scan, state: "retained", cloudStatus: "synced", expiresAt: null }, "2026-07-13T01:00:00.000Z")[0].state).toBe("synced");
  });

  test("tracks attempt state and removes synced items from pending work", () => {
    const queued = enqueueRecordSync([], record, now);
    const syncing = markCloudSyncing(queued, queued[0].id, now);
    const synced = markCloudSynced(syncing, queued[0].id, now);

    expect(syncing[0]).toMatchObject({ state: "syncing", attempts: 1 });
    expect(pendingCloudSyncItems(synced, now)).toEqual([]);
  });

  test("reopens failed sync work without changing conflict items", () => {
    const queued = enqueueRecordSync([], record, now);
    const queueItemId = queued[0].id;
    const failed = markCloudSyncFailure(queued, queueItemId, "network failed", false, now);
    const conflicted = markCloudSyncFailure(failed, queueItemId, "version conflict", false, now, "conflict");
    const retried = retryCloudSyncItem(conflicted, queueItemId, "2026-07-13T01:00:00.000Z");

    expect(retryCloudSyncItem(failed, queueItemId, "2026-07-13T01:00:00.000Z")[0]).toMatchObject({ state: "pending", attempts: 0, lastError: "" });
    expect(retried[0]).toMatchObject({ state: "conflict", lastError: "version conflict" });
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
