import type {
  CloudPersistenceClient,
  CloudRecordBundle,
  CloudRow,
  CloudMutationError,
} from "./contracts";
import { classifyCloudError, type CloudFailure } from "./retry";

export type IdempotencyRequest = {
  userId: string;
  actionType: string;
  idempotencyKey: string;
  requestHash: string;
  expiresAt: string;
};

export type CloudPersistenceSuccess = {
  ok: true;
  replayed: boolean;
  tables: string[];
};

export type CloudPersistenceFailure = {
  ok: false;
  failure: CloudFailure;
};

export type CloudPersistenceResult = CloudPersistenceSuccess | CloudPersistenceFailure;

function failure(error: CloudMutationError, table: string): CloudPersistenceFailure {
  return { ok: false, failure: classifyCloudError(error, table) };
}

async function readExistingIdempotency(
  client: CloudPersistenceClient,
  request: IdempotencyRequest,
): Promise<CloudPersistenceResult | null> {
  const result = await client
    .from("idempotency_keys")
    .select("request_hash")
    .eq("user_id", request.userId)
    .eq("idempotency_key", request.idempotencyKey)
    .maybeSingle();

  if (result.error) return failure(result.error, "idempotency_keys");
  if (!result.data) return null;
  if (result.data.request_hash !== request.requestHash) {
    return {
      ok: false,
      failure: {
        code: "idempotency",
        message: "The idempotency key was reused with a different request hash.",
        retryable: false,
        table: "idempotency_keys",
      },
    };
  }

  return { ok: true, replayed: true, tables: ["idempotency_keys"] };
}

async function upsert(
  client: CloudPersistenceClient,
  table: string,
  rows: CloudRow | CloudRow[],
  onConflict?: string,
): Promise<CloudPersistenceFailure | null> {
  const result = await client.from(table).upsert(rows, onConflict ? { onConflict } : undefined);
  return result.error ? failure(result.error, table) : null;
}

export async function persistAccounts(
  client: CloudPersistenceClient,
  rows: CloudRow[],
): Promise<CloudPersistenceResult> {
  const userId = rows[0]?.user_id;
  if (!userId || rows.some((row) => row.user_id !== userId)) {
    return {
      ok: false,
      failure: { code: "validation", message: "Account rows must share one user_id.", retryable: false, table: "accounts" },
    };
  }

  const error = await upsert(client, "accounts", rows, "user_id,name");
  return error ?? { ok: true, replayed: false, tables: ["accounts"] };
}

export async function persistDraft(
  client: CloudPersistenceClient,
  row: CloudRow,
): Promise<CloudPersistenceResult> {
  const error = await upsert(client, "drafts", row, "id");
  return error ?? { ok: true, replayed: false, tables: ["drafts"] };
}

export async function persistRecordBundle(
  client: CloudPersistenceClient,
  request: IdempotencyRequest,
  bundle: CloudRecordBundle,
): Promise<CloudPersistenceResult> {
  const existing = await readExistingIdempotency(client, request);
  if (existing) return existing;

  const idempotencyError = await upsert(client, "idempotency_keys", {
    user_id: request.userId,
    idempotency_key: request.idempotencyKey,
    action_type: request.actionType,
    request_hash: request.requestHash,
    expires_at: request.expiresAt,
  }, "user_id,idempotency_key");
  if (idempotencyError) return idempotencyError;

  const tables = ["idempotency_keys"];
  const parentError = await upsert(client, "ledger_records", bundle.ledgerRecord, "id");
  if (parentError) return parentError;
  tables.push("ledger_records");

  if (bundle.transferDetails) {
    const transferError = await upsert(client, "transfer_details", bundle.transferDetails, "ledger_record_id");
    if (transferError) return transferError;
    tables.push("transfer_details");
  }

  if (bundle.refundLinks.length > 0) {
    const refundError = await upsert(client, "refund_links", bundle.refundLinks, "refund_record_id,original_record_id");
    if (refundError) return refundError;
    tables.push("refund_links");
  }

  if (bundle.auditEvents.length > 0) {
    const auditError = await upsert(client, "audit_events", bundle.auditEvents, "id");
    if (auditError) return auditError;
    tables.push("audit_events");
  }

  return { ok: true, replayed: false, tables };
}
