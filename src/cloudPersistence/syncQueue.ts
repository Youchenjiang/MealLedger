import type { TransactionDraft } from "../appShell/drafts";
import type { LocalLedgerRecord } from "../manualLedger/records";
import type { MealEntry } from "../captureMedia/meals";
import type { TemporaryScan } from "../captureMedia/media";
import type { UploadQueueItem } from "../captureMedia/upload";
import { nextRetryAt } from "./retry";

export type CloudSyncTarget = "record" | "draft" | "meal" | "media" | "scan";
export type CloudSyncState = "pending" | "syncing" | "retryable-error" | "failed" | "conflict" | "synced";

export type CloudSyncQueueItem = {
  id: string;
  target: CloudSyncTarget;
  targetId: string;
  actionType: string;
  idempotencyKey: string;
  requestHash: string;
  state: CloudSyncState;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

function queueId(target: CloudSyncTarget, targetId: string): string {
  return `cloud-sync-${target}-${targetId}`;
}

function existing(current: CloudSyncQueueItem[], target: CloudSyncTarget, targetId: string): boolean {
  return current.some((item) => item.target === target && item.targetId === targetId);
}

export function enqueueRecordSync(
  current: CloudSyncQueueItem[],
  record: LocalLedgerRecord,
  now: string,
): CloudSyncQueueItem[] {
  if (existing(current, "record", record.id)) return current;
  return [...current, {
    id: queueId("record", record.id),
    target: "record",
    targetId: record.id,
    actionType: "record-bundle",
    idempotencyKey: record.idempotencyKey,
    requestHash: `${record.id}:${record.version}:${record.updatedAt}`,
    state: "pending",
    attempts: 0,
    nextAttemptAt: now,
    lastError: "",
    createdAt: now,
    updatedAt: now,
  }];
}

export function enqueueDraftSync(
  current: CloudSyncQueueItem[],
  draft: TransactionDraft,
  now: string,
): CloudSyncQueueItem[] {
  if (existing(current, "draft", draft.id)) return current;
  return [...current, {
    id: queueId("draft", draft.id),
    target: "draft",
    targetId: draft.id,
    actionType: "draft-create",
    idempotencyKey: `draft:${draft.id}`,
    requestHash: `draft:${draft.id}`,
    state: "pending",
    attempts: 0,
    nextAttemptAt: now,
    lastError: "",
    createdAt: now,
    updatedAt: now,
  }];
}

export function enqueueMealSync(
  current: CloudSyncQueueItem[],
  meal: MealEntry,
  now: string,
): CloudSyncQueueItem[] {
  if (existing(current, "meal", meal.id)) return current;
  return [...current, {
    id: queueId("meal", meal.id),
    target: "meal",
    targetId: meal.id,
    actionType: "meal-create",
    idempotencyKey: `meal:${meal.id}`,
    requestHash: `meal:${meal.id}:${meal.occurredAt}:${meal.note}`,
    state: "pending",
    attempts: 0,
    nextAttemptAt: now,
    lastError: "",
    createdAt: now,
    updatedAt: now,
  }];
}

export function enqueueMediaSync(
  current: CloudSyncQueueItem[],
  media: UploadQueueItem,
  now: string,
): CloudSyncQueueItem[] {
  if (existing(current, "media", media.id)) return current;
  return [...current, {
    id: queueId("media", media.id),
    target: "media",
    targetId: media.id,
    actionType: "media-metadata",
    idempotencyKey: `media:${media.id}`,
    requestHash: `media:${media.id}:${media.size}:${media.type}`,
    state: "pending",
    attempts: 0,
    nextAttemptAt: now,
    lastError: "",
    createdAt: now,
    updatedAt: now,
  }];
}

export function enqueueScanSync(
  current: CloudSyncQueueItem[],
  scan: TemporaryScan,
  now: string,
): CloudSyncQueueItem[] {
  if (existing(current, "scan", scan.id)) return current;
  return [...current, {
    id: queueId("scan", scan.id),
    target: "scan",
    targetId: scan.id,
    actionType: "source-payload",
    idempotencyKey: `scan:${scan.id}`,
    requestHash: `scan:${scan.id}:${scan.state}:${scan.expiresAt ?? ""}`,
    state: "pending",
    attempts: 0,
    nextAttemptAt: now,
    lastError: "",
    createdAt: now,
    updatedAt: now,
  }];
}

export function pendingCloudSyncItems(items: CloudSyncQueueItem[], now: string): CloudSyncQueueItem[] {
  const currentTime = new Date(now).getTime();
  return items.filter((item) => (
    (item.state === "pending" || item.state === "syncing" || item.state === "retryable-error")
    && (item.nextAttemptAt === null || new Date(item.nextAttemptAt).getTime() <= currentTime)
  ));
}

export function markCloudSyncing(items: CloudSyncQueueItem[], id: string, now: string): CloudSyncQueueItem[] {
  return items.map((item) => item.id === id
    ? { ...item, state: "syncing", attempts: item.attempts + 1, updatedAt: now }
    : item);
}

export function markCloudSynced(items: CloudSyncQueueItem[], id: string, now: string): CloudSyncQueueItem[] {
  return items.map((item) => item.id === id
    ? { ...item, state: "synced", nextAttemptAt: null, lastError: "", updatedAt: now }
    : item);
}

export function markCloudSyncFailure(
  items: CloudSyncQueueItem[],
  id: string,
  error: string,
  retryable: boolean,
  now: string,
  code?: "conflict",
): CloudSyncQueueItem[] {
  return items.map((item) => {
    if (item.id !== id) return item;
    const nextAttempt = retryable ? nextRetryAt(item.attempts, new Date(now)) : null;
    return {
      ...item,
      state: code ?? (retryable && nextAttempt ? "retryable-error" : "failed"),
      nextAttemptAt: nextAttempt,
      lastError: error,
      updatedAt: now,
    };
  });
}
