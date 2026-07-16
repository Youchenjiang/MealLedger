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

function existing(current: CloudSyncQueueItem[], target: CloudSyncTarget, targetId: string): CloudSyncQueueItem | undefined {
  return current.find((item) => item.target === target && item.targetId === targetId);
}

function refreshExisting(
  current: CloudSyncQueueItem[],
  target: CloudSyncTarget,
  targetId: string,
  requestHash: string,
  idempotencyKey: string,
  now: string,
): CloudSyncQueueItem[] | null {
  const prior = existing(current, target, targetId);
  if (!prior) return null;
  if (prior.requestHash === requestHash && prior.idempotencyKey === idempotencyKey) return current;

  return current.map((item) => item.id === prior.id
    ? {
      ...item,
      requestHash,
      idempotencyKey,
      state: "pending",
      attempts: 0,
      nextAttemptAt: now,
      lastError: "",
      updatedAt: now,
    }
    : item);
}

export function enqueueRecordSync(
  current: CloudSyncQueueItem[],
  record: LocalLedgerRecord,
  now: string,
): CloudSyncQueueItem[] {
  const requestHash = `${record.id}:${record.version}:${record.updatedAt}`;
  const refreshed = refreshExisting(current, "record", record.id, requestHash, record.idempotencyKey, now);
  if (refreshed) return refreshed;
  if (record.status === "synced") return current;
  return [...current, {
    id: queueId("record", record.id),
    target: "record",
    targetId: record.id,
    actionType: "record-bundle",
    idempotencyKey: record.idempotencyKey,
    requestHash,
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
  const idempotencyKey = `draft:${draft.id}`;
  const requestHash = `draft:${draft.id}:${JSON.stringify(draft)}`;
  const refreshed = refreshExisting(current, "draft", draft.id, requestHash, idempotencyKey, now);
  if (refreshed) return refreshed;
  return [...current, {
    id: queueId("draft", draft.id),
    target: "draft",
    targetId: draft.id,
    actionType: "draft-create",
    idempotencyKey,
    requestHash,
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
  const idempotencyKey = `meal:${meal.id}`;
  const requestHash = `meal:${meal.id}:${JSON.stringify(meal)}`;
  if (meal.status === "synced") return current;
  const refreshed = refreshExisting(current, "meal", meal.id, requestHash, idempotencyKey, now);
  if (refreshed) return refreshed;
  return [...current, {
    id: queueId("meal", meal.id),
    target: "meal",
    targetId: meal.id,
    actionType: "meal-create",
    idempotencyKey,
    requestHash,
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
  const idempotencyKey = `media:${media.id}`;
  const requestHash = `media:${media.id}:${JSON.stringify({ name: media.name, type: media.type, size: media.size, status: media.status, kind: media.kind })}`;
  if (media.metadataStatus === "synced") return current;
  const refreshed = refreshExisting(current, "media", media.id, requestHash, idempotencyKey, now);
  if (refreshed) return refreshed;
  return [...current, {
    id: queueId("media", media.id),
    target: "media",
    targetId: media.id,
    actionType: "media-metadata",
    idempotencyKey,
    requestHash,
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
  const idempotencyKey = `scan:${scan.id}`;
  const requestHash = `scan:${scan.id}:${JSON.stringify(scan)}`;
  if (scan.cloudStatus === "synced") return current;
  const refreshed = refreshExisting(current, "scan", scan.id, requestHash, idempotencyKey, now);
  if (refreshed) return refreshed;
  return [...current, {
    id: queueId("scan", scan.id),
    target: "scan",
    targetId: scan.id,
    actionType: "source-payload",
    idempotencyKey,
    requestHash,
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

export function retryCloudSyncItem(items: CloudSyncQueueItem[], id: string, now: string): CloudSyncQueueItem[] {
  return items.map((item) => item.id === id && (item.state === "failed" || item.state === "retryable-error")
    ? { ...item, state: "pending", attempts: 0, nextAttemptAt: now, lastError: "", updatedAt: now }
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
