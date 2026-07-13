import { describe, expect, test, vi } from "vitest";
import type { ReferenceBootstrapClient } from "./bootstrap";
import type { CloudPersistenceClient, CloudRow } from "./contracts";
import { enqueueLocalChanges, syncLocalChanges } from "./syncService";
import type { LocalAccount } from "../manualLedger/accounts";
import type { LocalLedgerRecord } from "../manualLedger/records";
import type { MealEntry } from "../captureMedia/meals";
import type { TemporaryScan } from "../captureMedia/media";
import type { UploadQueueItem } from "../captureMedia/upload";

const account: LocalAccount = { id: "account-1", name: "Cash", currency: "TWD" };
const baseRecord = {
  id: "record-1", idempotencyKey: "action-1", userId: "local-user", kind: "expense", status: "local-only", recordState: "active", version: 1,
  localDate: "2026-07-13", accountId: "account-1", accountName: "Cash", amount: "100", currency: "TWD", category: "Daily", counterparty: "Store", counterpartyMissing: false, itemName: "Tea", itemNameMissing: false,
  transferAccountId: "", transferAccountName: "", transferMode: "same-currency", destinationAmount: "", destinationCurrency: "", feeAccountId: "", feeAccountName: "", feeAmount: "", feeCurrency: "", feeCategory: "", refundReason: "", refundSubtype: "refund", refundLinkedRecordId: "", refundExcessHandling: "unclassified", recurrenceChoice: "current-cycle-only", recurrenceAmountMode: "fixed", recurrenceStatus: "inactive", reason: "", timePrecision: "day", periodStart: "", periodEnd: "", note: "", createdAt: "2026-07-13T00:00:00.000Z", updatedAt: "2026-07-13T00:00:00.000Z",
} as LocalLedgerRecord;

function persistenceClient(failTable?: string): CloudPersistenceClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    from(table: string) {
      return {
        select() {
          const filter = { eq: () => filter, maybeSingle: async () => ({ data: null, error: null }) };
          return filter;
        },
        upsert: vi.fn(async () => {
          calls.push(table);
          return failTable === table ? { data: null, error: { message: `${table} failed`, code: "network" } } : { data: null, error: null };
        }),
      };
    },
  } as CloudPersistenceClient & { calls: string[] };
}

function referenceClient(): ReferenceBootstrapClient {
  return {
    from(table: string) {
      return {
        upsert(rows) {
          const batch = Array.isArray(rows) ? rows : [rows];
          return {
            select: async () => ({
              data: batch.map((row, index) => ({ id: `remote-${table}-${index}`, name: (row as CloudRow).name })),
              error: null,
            }),
          };
        },
      };
    },
  };
}

function input(overrides: Partial<Parameters<typeof syncLocalChanges>[0]> = {}) {
  return {
    client: persistenceClient(),
    referenceClient: referenceClient(),
    userId: "user-1",
    accounts: [account],
    categories: ["Daily"],
    tags: [],
    events: [],
    auditEvents: [],
    records: [baseRecord],
    drafts: [],
    meals: [] as MealEntry[],
    media: [] as UploadQueueItem[],
    scans: [] as TemporaryScan[],
    queue: enqueueLocalChanges([], [baseRecord], [], [], [], [], "2026-07-13T00:00:00.000Z"),
    now: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("cloud sync service", () => {
  test("bootstraps references and marks a successful record synced", async () => {
    const result = await syncLocalChanges(input());

    expect(result.records[0].status).toBe("synced");
    expect(result.queue[0].state).toBe("synced");
  });

  test("keeps the local record and retryable queue state on transport failure", async () => {
    const failedClient = persistenceClient("ledger_records");
    const result = await syncLocalChanges(input({ client: failedClient }));

    expect(result.records[0].status).toBe("local-only");
    expect(result.queue[0]).toMatchObject({ state: "retryable-error", lastError: "ledger_records failed" });
  });

  test("does not retry an incomplete reference bootstrap forever without changing local data", async () => {
    const result = await syncLocalChanges(input({
      referenceClient: {
        from: () => ({ upsert: () => ({ select: async () => ({ data: [], error: null }) }) }),
      },
    }));

    expect(result.records[0].status).toBe("local-only");
    expect(result.queue[0]).toMatchObject({ state: "retryable-error", lastError: expect.stringContaining("omitted") });
  });

  test("syncs meal, media metadata, and temporary scan source rows independently", async () => {
    const meal = {
      id: "meal-1",
      occurredAt: "2026-07-13T12:30",
      note: "Lunch",
      transactionIds: [baseRecord.id],
      mediaAssetIds: ["meal-1-0-lunch.jpg"],
      status: "local-only" as const,
    };
    const media = {
      id: "meal-1-0-lunch.jpg",
      name: "lunch.jpg",
      type: "image/jpeg",
      size: 2048,
      status: "queued" as const,
      kind: "meal-photo" as const,
    };
    const scan = {
      id: "scan-1",
      intent: "scan-receipt" as const,
      fileName: "receipt.jpg",
      mimeType: "image/jpeg",
      byteSize: 1024,
      state: "temporary" as const,
      cloudStatus: "local-only" as const,
      createdAt: "2026-07-13T10:00:00.000Z",
      expiresAt: "2026-07-14T10:00:00.000Z",
    };
    const result = await syncLocalChanges(input({
      meals: [meal],
      media: [media],
      scans: [scan],
      queue: enqueueLocalChanges([], [baseRecord], [], [meal], [media], [scan], "2026-07-13T00:00:00.000Z"),
    }));

    expect(result.meals[0].status).toBe("synced");
    expect(result.media[0].metadataStatus).toBe("synced");
    expect(result.scans[0].cloudStatus).toBe("synced");
    expect(result.queue.every((item) => item.state === "synced")).toBe(true);
  });
});
