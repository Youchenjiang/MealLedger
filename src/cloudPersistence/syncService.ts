import type { ReferenceBootstrapClient } from "./bootstrap";
import { bootstrapReferences } from "./bootstrap";
import type { CloudPersistenceClient } from "./contracts";
import { mapDraft, mapLedgerRecord, mapMealEntry, mapMediaAsset, mapTemporaryScan, mapTemporaryScanMediaLink } from "./mappers";
import { persistDraft, persistMealBundle, persistMediaAsset, persistRecordBundle, persistSourcePayload } from "./repository";
import {
  enqueueDraftSync,
  enqueueRecordSync,
  markCloudSyncFailure,
  markCloudSynced,
  markCloudSyncing,
  enqueueMealSync,
  enqueueMediaSync,
  enqueueScanSync,
  pendingCloudSyncItems,
  type CloudSyncQueueItem,
} from "./syncQueue";
import type { TransactionDraft } from "../appShell/drafts";
import type { LocalAccount } from "../manualLedger/accounts";
import type { LocalLedgerRecord } from "../manualLedger/records";
import type { MealEntry } from "../captureMedia/meals";
import type { TemporaryScan } from "../captureMedia/media";
import type { UploadQueueItem } from "../captureMedia/upload";

export type SyncLocalChangesInput = {
  client: CloudPersistenceClient;
  referenceClient: ReferenceBootstrapClient;
  userId: string;
  accounts: LocalAccount[];
  categories: string[];
  tags: string[];
  events: string[];
  auditEvents: import("../manualLedger/records").LocalAuditEvent[];
  records: LocalLedgerRecord[];
  drafts: TransactionDraft[];
  meals: MealEntry[];
  media: UploadQueueItem[];
  scans: TemporaryScan[];
  queue: CloudSyncQueueItem[];
  now: string;
};

export type SyncLocalChangesResult = {
  records: LocalLedgerRecord[];
  meals: MealEntry[];
  media: UploadQueueItem[];
  scans: TemporaryScan[];
  queue: CloudSyncQueueItem[];
};

function orderPendingSyncItems(items: CloudSyncQueueItem[], records: LocalLedgerRecord[]): CloudSyncQueueItem[] {
  const recordById = new Map(records.map((record) => [record.id, record]));
  return [...items].sort((left, right) => {
    const leftRecord = left.target === "record" ? recordById.get(left.targetId) : undefined;
    const rightRecord = right.target === "record" ? recordById.get(right.targetId) : undefined;
    const leftIsFee = Boolean(leftRecord?.linkedRecordId);
    const rightIsFee = Boolean(rightRecord?.linkedRecordId);
    return Number(rightIsFee) - Number(leftIsFee);
  });
}

// skipcq: JS-R1005
export async function syncLocalChanges(input: SyncLocalChangesInput): Promise<SyncLocalChangesResult> {
  let nextRecords = input.records;
  let nextMeals = input.meals;
  let nextMedia = input.media;
  let nextScans = input.scans;
  let nextQueue = input.queue;
  const pending = orderPendingSyncItems(pendingCloudSyncItems(input.queue, input.now), input.records);
  if (pending.length === 0) return { records: nextRecords, meals: nextMeals, media: nextMedia, scans: nextScans, queue: nextQueue };

  const bootstrap = await bootstrapReferences(input.referenceClient, {
    userId: input.userId,
    accounts: input.accounts,
    categories: input.categories,
    tags: input.tags,
    events: input.events,
  });
  if (!bootstrap.ok) {
    nextQueue = pending.reduce(
      (current, item) => markCloudSyncFailure(current, item.id, bootstrap.message, true, input.now),
      nextQueue,
    );
    return { records: nextRecords, meals: nextMeals, media: nextMedia, scans: nextScans, queue: nextQueue };
  }

  for (const item of pending) {
    nextQueue = markCloudSyncing(nextQueue, item.id, input.now);
    if (item.target === "draft") {
      const draft = input.drafts.find((candidate) => candidate.id === item.targetId);
      if (!draft) {
        nextQueue = markCloudSyncFailure(nextQueue, item.id, "Local draft is no longer available.", false, input.now);
        continue;
      }

      const result = await persistDraft(input.client, mapDraft(draft, input.userId));
      nextQueue = result.ok
        ? markCloudSynced(nextQueue, item.id, input.now)
        : markCloudSyncFailure(nextQueue, item.id, result.failure.message, result.failure.retryable, input.now, result.failure.code === "conflict" ? "conflict" : undefined);
      continue;
    }

    if (item.target === "media") {
      const media = input.media.find((candidate) => candidate.id === item.targetId);
      if (!media) {
        nextQueue = markCloudSyncFailure(nextQueue, item.id, "Local media metadata is no longer available.", false, input.now);
        continue;
      }

      const result = await persistMediaAsset(input.client, mapMediaAsset(media, input.userId, input.now));
      if (result.ok) {
        nextMedia = nextMedia.map((candidate) => candidate.id === media.id ? { ...candidate, metadataStatus: "synced" } : candidate);
        nextQueue = markCloudSynced(nextQueue, item.id, input.now);
      } else {
        nextQueue = markCloudSyncFailure(nextQueue, item.id, result.failure.message, result.failure.retryable, input.now, result.failure.code === "conflict" ? "conflict" : undefined);
      }
      continue;
    }

    if (item.target === "scan") {
      const scan = input.scans.find((candidate) => candidate.id === item.targetId);
      if (!scan) {
        nextQueue = markCloudSyncFailure(nextQueue, item.id, "Local scan metadata is no longer available.", false, input.now);
        continue;
      }

      const mediaLink = input.media.some((candidate) => candidate.id === scan.id)
        ? [mapTemporaryScanMediaLink(scan, input.userId)]
        : [];
      const result = await persistSourcePayload(input.client, mapTemporaryScan(scan, input.userId), mediaLink);
      if (result.ok) {
        nextScans = nextScans.map((candidate) => candidate.id === scan.id ? { ...candidate, cloudStatus: "synced" } : candidate);
        nextQueue = markCloudSynced(nextQueue, item.id, input.now);
      } else {
        nextQueue = markCloudSyncFailure(nextQueue, item.id, result.failure.message, result.failure.retryable, input.now, result.failure.code === "conflict" ? "conflict" : undefined);
      }
      continue;
    }

    if (item.target === "meal") {
      const meal = input.meals.find((candidate) => candidate.id === item.targetId);
      if (!meal) {
        nextQueue = markCloudSyncFailure(nextQueue, item.id, "Local meal metadata is no longer available.", false, input.now);
        continue;
      }

      const mappedMeal = mapMealEntry(meal, input.userId, bootstrap.references);
      if (!mappedMeal.ok) {
        nextQueue = markCloudSyncFailure(nextQueue, item.id, mappedMeal.issues.map((entry) => entry.message).join(" "), false, input.now);
        continue;
      }

      const result = await persistMealBundle(input.client, mappedMeal.value);
      if (result.ok) {
        nextMeals = nextMeals.map((candidate) => candidate.id === meal.id ? { ...candidate, status: "synced" } : candidate);
        nextQueue = markCloudSynced(nextQueue, item.id, input.now);
      } else {
        nextQueue = markCloudSyncFailure(nextQueue, item.id, result.failure.message, result.failure.retryable, input.now, result.failure.code === "conflict" ? "conflict" : undefined);
      }
      continue;
    }

    const record = input.records.find((candidate) => candidate.id === item.targetId);
    if (!record) {
      nextQueue = markCloudSyncFailure(nextQueue, item.id, "Local record is no longer available.", false, input.now);
      continue;
    }

    const feeRecord = record.kind === "transfer"
      ? input.records.find((candidate) => candidate.kind === "expense" && candidate.linkedRecordId === record.id)
      : undefined;
    const mapped = mapLedgerRecord(record, input.userId, bootstrap.references, "Asia/Taipei", input.auditEvents, feeRecord?.id);
    if (!mapped.ok) {
      nextQueue = markCloudSyncFailure(nextQueue, item.id, mapped.issues.map((entry) => entry.message).join(" "), false, input.now);
      continue;
    }

    const result = await persistRecordBundle(input.client, {
      userId: input.userId,
      actionType: item.actionType,
      idempotencyKey: item.idempotencyKey,
      requestHash: item.requestHash,
      expiresAt: new Date(new Date(input.now).getTime() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    }, mapped.value);
    if (result.ok) {
      nextRecords = nextRecords.map((candidate) => candidate.id === record.id ? { ...candidate, status: "synced" } : candidate);
      nextQueue = markCloudSynced(nextQueue, item.id, input.now);
    } else {
      nextQueue = markCloudSyncFailure(nextQueue, item.id, result.failure.message, result.failure.retryable, input.now, result.failure.code === "conflict" ? "conflict" : undefined);
    }
  }

  return { records: nextRecords, meals: nextMeals, media: nextMedia, scans: nextScans, queue: nextQueue };
}

export function enqueueLocalChanges(
  queue: CloudSyncQueueItem[],
  records: LocalLedgerRecord[],
  drafts: TransactionDraft[],
  meals: MealEntry[],
  media: UploadQueueItem[],
  scans: TemporaryScan[],
  now: string,
): CloudSyncQueueItem[] {
  let next = queue;
  for (const item of media) {
    next = enqueueMediaSync(next, item, now);
  }
  const orderedRecords = [...records].sort((left, right) => {
    const leftIsFee = Boolean(left.linkedRecordId);
    const rightIsFee = Boolean(right.linkedRecordId);
    return Number(rightIsFee) - Number(leftIsFee);
  });
  for (const record of orderedRecords) next = enqueueRecordSync(next, record, now);
  for (const draft of drafts) next = enqueueDraftSync(next, draft, now);
  for (const scan of scans) next = enqueueScanSync(next, scan, now);
  for (const meal of meals) next = enqueueMealSync(next, meal, now);
  return next;
}
