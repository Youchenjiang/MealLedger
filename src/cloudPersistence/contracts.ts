import type { LocalAccount } from "../manualLedger/accounts";
import type { LocalAuditEvent, LocalLedgerRecord } from "../manualLedger/records";
import type { TransactionDraft } from "../appShell/drafts";

export type CloudRow = Record<string, unknown>;

export type CloudReferenceMap = {
  accountIds: Record<string, string>;
  categoryIds?: Record<string, string>;
  eventIds?: Record<string, string>;
  tagIds?: Record<string, string>;
  ledgerRecordIds?: Record<string, string>;
  refundAllocations?: Record<string, Array<{ originalRecordId: string; amount: string; currency: string }>>;
};

export type CloudMappingIssue = {
  code: "invalid-money" | "missing-reference" | "missing-refund-allocation" | "invalid-date";
  field: string;
  message: string;
};

export type CloudMappingResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: CloudMappingIssue[] };

export type CloudRecordBundle = {
  ledgerRecord: CloudRow;
  transferDetails?: CloudRow;
  refundLinks: CloudRow[];
  auditEvents: CloudRow[];
};

export type CloudPersistenceInput = {
  userId: string;
  timezone?: string;
  accounts?: LocalAccount[];
  record?: LocalLedgerRecord;
  draft?: TransactionDraft;
  auditEvents?: LocalAuditEvent[];
};

export type CloudMutationError = {
  message: string;
  code?: string;
  details?: string;
};

export type CloudMutationResult = {
  data?: unknown;
  error: CloudMutationError | null;
};

export type CloudReadResult = {
  data?: CloudRow | null;
  error: CloudMutationError | null;
};

export type CloudFilter = {
  eq(column: string, value: unknown): CloudFilter;
  maybeSingle(): PromiseLike<CloudReadResult> | CloudReadResult;
};

export type CloudTable = {
  upsert(values: CloudRow | CloudRow[], options?: { onConflict?: string; ignoreDuplicates?: boolean }):
    PromiseLike<CloudMutationResult> | CloudMutationResult;
  select(columns?: string): CloudFilter;
};

export type CloudPersistenceClient = {
  from(table: string): CloudTable;
};
