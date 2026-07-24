import type {
  CloudPersistenceClient,
  CloudMealBundle,
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
  completed?: boolean;
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
    .select("request_hash, expires_at, response_json")
    .eq("user_id", request.userId)
    .eq("idempotency_key", request.idempotencyKey)
    .maybeSingle();

  if (result.error) return failure(result.error, "idempotency_keys");
  if (!result.data) return null;
  const expiresAt = typeof result.data.expires_at === "string" ? Date.parse(result.data.expires_at) : Number.POSITIVE_INFINITY;
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now() && !result.data.response_json) return null;
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

  return {
    ok: true,
    replayed: true,
    completed: Boolean(result.data.response_json),
    tables: ["idempotency_keys"],
  };
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

async function checkLedgerVersion(
  client: CloudPersistenceClient,
  row: CloudRow,
): Promise<CloudPersistenceFailure | null> {
  const result = await client.from("ledger_records").select("version").eq("id", row.id).maybeSingle();
  if (result.error) return failure(result.error, "ledger_records");
  if (!result.data) return null;

  const remoteVersion = Number(result.data.version);
  const requestedVersion = Number(row.version);
  const expectedPreviousVersion = requestedVersion - 1;
  if (remoteVersion !== requestedVersion && remoteVersion !== expectedPreviousVersion) {
    return {
      ok: false,
      failure: {
        code: "conflict",
        message: `Ledger record version conflict: cloud=${remoteVersion}, local=${requestedVersion}.`,
        retryable: false,
        table: "ledger_records",
      },
    };
  }
  return null;
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

export async function persistProfile(
  client: CloudPersistenceClient,
  row: CloudRow,
): Promise<CloudPersistenceResult> {
  const userId = typeof row.user_id === "string" ? row.user_id : "";
  if (!userId) {
    return {
      ok: false,
      failure: { code: "validation", message: "Profile rows require a user_id.", retryable: false, table: "profiles" },
    };
  }

  const error = await upsert(client, "profiles", row, "user_id");
  return error ?? { ok: true, replayed: false, tables: ["profiles"] };
}

export async function persistDraft(
  client: CloudPersistenceClient,
  row: CloudRow,
): Promise<CloudPersistenceResult> {
  const error = await upsert(client, "drafts", row, "id");
  return error ?? { ok: true, replayed: false, tables: ["drafts"] };
}

export async function persistMediaAsset(
  client: CloudPersistenceClient,
  row: CloudRow,
): Promise<CloudPersistenceResult> {
  const error = await upsert(client, "media_assets", row, "id");
  return error ?? { ok: true, replayed: false, tables: ["media_assets"] };
}

export async function persistSourcePayload(
  client: CloudPersistenceClient,
  row: CloudRow,
  mediaLinks: CloudRow[] = [],
): Promise<CloudPersistenceResult> {
  const error = await upsert(client, "source_payloads", row, "id");
  if (error) return error;
  if (mediaLinks.length > 0) {
    const mediaError = await upsert(client, "media_links", mediaLinks, "media_asset_id,target_type,target_id,link_intent");
    if (mediaError) return mediaError;
    return { ok: true, replayed: false, tables: ["source_payloads", "media_links"] };
  }
  return { ok: true, replayed: false, tables: ["source_payloads"] };
}

export async function persistMealBundle(
  client: CloudPersistenceClient,
  bundle: CloudMealBundle,
): Promise<CloudPersistenceResult> {
  const mealError = await upsert(client, "meal_entries", bundle.mealEntry, "id");
  if (mealError) return mealError;
  const tables = ["meal_entries"];

  if (bundle.transactionLinks.length > 0) {
    const transactionError = await upsert(client, "meal_transaction_links", bundle.transactionLinks, "meal_id,ledger_record_id");
    if (transactionError) return transactionError;
    tables.push("meal_transaction_links");
  }

  if (bundle.mediaLinks.length > 0) {
    const mediaError = await upsert(client, "media_links", bundle.mediaLinks, "media_asset_id,target_type,target_id,link_intent");
    if (mediaError) return mediaError;
    tables.push("media_links");
  }

  return { ok: true, replayed: false, tables };
}

async function persistTransferBundle(
  client: CloudPersistenceClient,
  request: IdempotencyRequest,
  bundle: CloudRecordBundle,
  replayed: boolean,
): Promise<CloudPersistenceResult> {
  if (!client.rpc) {
    return {
      ok: false,
      failure: {
        code: "validation",
        message: "Transfer bundles require the atomic cloud RPC boundary and were kept local-only.",
        retryable: false,
        table: "transfer_details",
      },
    };
  }

  const rpcResult = await client.rpc("persist_ledger_record_bundle_resolved", {
    p_request: {
      user_id: request.userId,
      action_type: request.actionType,
      idempotency_key: request.idempotencyKey,
      request_hash: request.requestHash,
      expires_at: request.expiresAt,
    },
    p_ledger_record: bundle.ledgerRecord,
    p_transfer_details: bundle.transferDetails,
    p_refund_links: bundle.refundLinks,
    p_ledger_record_tags: bundle.ledgerRecordTags,
    p_audit_events: bundle.auditEvents,
  });
  if (rpcResult.error) return failure(rpcResult.error, "persist_ledger_record_bundle_resolved");

  const rpcData = rpcResult.data;
  const rpcReplayed = rpcData && typeof rpcData === "object" && "replayed" in rpcData ? Boolean(rpcData.replayed) : replayed;
  const tables = ["idempotency_keys", "ledger_records", "transfer_details"];
  if (bundle.refundLinks.length > 0) tables.push("refund_links");
  if (bundle.ledgerRecordTags.length > 0) tables.push("ledger_record_tags");
  if (bundle.auditEvents.length > 0) tables.push("audit_events");
  return { ok: true, replayed: rpcReplayed, tables };
}

async function persistRecordChildren(
  client: CloudPersistenceClient,
  bundle: CloudRecordBundle,
  tables: string[],
): Promise<CloudPersistenceFailure | null> {
  if (bundle.transferDetails) {
    const error = await upsert(client, "transfer_details", bundle.transferDetails, "ledger_record_id");
    if (error) return error;
    tables.push("transfer_details");
  }
  if (bundle.refundLinks.length > 0) {
    const error = await upsert(client, "refund_links", bundle.refundLinks, "refund_record_id,original_record_id");
    if (error) return error;
    tables.push("refund_links");
  }
  if (bundle.ledgerRecordTags.length > 0) {
    const error = await upsert(client, "ledger_record_tags", bundle.ledgerRecordTags, "ledger_record_id,tag_id");
    if (error) return error;
    tables.push("ledger_record_tags");
  }
  if (bundle.auditEvents.length > 0) {
    const error = await upsert(client, "audit_events", bundle.auditEvents, "id");
    if (error) return error;
    tables.push("audit_events");
  }
  return null;
}

function persistIdempotencyResponse(
  client: CloudPersistenceClient,
  request: IdempotencyRequest,
  bundle: CloudRecordBundle,
  tables: string[],
): Promise<CloudPersistenceFailure | null> {
  return upsert(client, "idempotency_keys", {
    user_id: request.userId,
    idempotency_key: request.idempotencyKey,
    action_type: request.actionType,
    request_hash: request.requestHash,
    response_json: { ledger_record_id: bundle.ledgerRecord.id, tables },
    result_type: "ledger-record",
    result_id: bundle.ledgerRecord.id,
    expires_at: request.expiresAt,
  }, "user_id,idempotency_key");
}

export async function persistRecordBundle(
  client: CloudPersistenceClient,
  request: IdempotencyRequest,
  bundle: CloudRecordBundle,
): Promise<CloudPersistenceResult> {
  const existing = await readExistingIdempotency(client, request);
  if (existing && !existing.ok) return existing;
  if (existing?.ok && existing.completed) return existing;
  const replayed = existing?.ok === true && existing.replayed;

  if (bundle.transferDetails) return persistTransferBundle(client, request, bundle, replayed);

  const versionFailure = await checkLedgerVersion(client, bundle.ledgerRecord);
  if (versionFailure) return versionFailure;

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

  const childError = await persistRecordChildren(client, bundle, tables);
  if (childError) return childError;

  const responseError = await persistIdempotencyResponse(client, request, bundle, tables);
  if (responseError) return responseError;

  return { ok: true, replayed, tables };
}
