import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL?.trim();
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function requireValue(name, value) {
  if (!value) throw new Error(`${name} is required for remote persistence smoke.`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Remote persistence assertion failed: ${message}`);
}

async function requireData(operation, result) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  assert(result.data !== null && result.data !== undefined, `${operation} returned no data`);
  return result.data;
}

async function insert(client, table, row) {
  return requireData(`insert ${table}`, await client.from(table).insert(row).select().single());
}

async function upsert(client, table, row, onConflict) {
  return requireData(`upsert ${table}`, await client.from(table).upsert(row, { onConflict }).select().single());
}

async function removeWhere(client, table, column, value) {
  const result = await client.from(table).delete().eq(column, value);
  if (result.error) throw new Error(`delete ${table}: ${result.error.message}`);
}

async function authRequest(baseUrl, path, key, method, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path}: ${responseBody.msg ?? responseBody.message ?? responseBody.error_description ?? `HTTP ${response.status}`}`);
  }
  return responseBody;
}

async function run() {
  requireValue("VITE_SUPABASE_URL", url);
  requireValue("VITE_SUPABASE_ANON_KEY", anonKey);
  requireValue("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);

  const email = `meal-ledger-remote-smoke-${Date.now()}@example.com`;
  const password = `${randomUUID()}-ML`;
  let userId = "";
  let serviceClient;

  try {
    const created = await authRequest(url, "/auth/v1/admin/users", serviceRoleKey, "POST", { email, password, email_confirm: true });
    if (!created.id) throw new Error("create temporary user: response did not include an id");
    userId = created.id;

    const signedIn = await authRequest(url, "/auth/v1/token?grant_type=password", anonKey, "POST", { email, password });
    if (!signedIn.access_token) throw new Error("sign in temporary user: response did not include an access token");
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${signedIn.access_token}` } },
    });
    serviceClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const accountId = randomUUID();
    const destinationAccountId = randomUUID();
    const categoryId = randomUUID();
    const merchantId = randomUUID();
    const eventId = randomUUID();
    const tagId = randomUUID();
    const expenseId = randomUUID();
    const transferId = randomUUID();
    const mealId = randomUUID();
    const mediaId = randomUUID();
    const sourceId = randomUUID();
    const draftId = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await upsert(client, "profiles", { user_id: userId, display_name: "Remote smoke" }, "user_id");
    await insert(client, "accounts", { id: accountId, user_id: userId, name: "Smoke wallet", currency: "TWD" });
    await insert(client, "accounts", { id: destinationAccountId, user_id: userId, name: "Smoke reserve", currency: "TWD" });
    await insert(client, "categories", { id: categoryId, user_id: userId, name: "Smoke category", kind_scope: "expense" });
    await insert(client, "category_aliases", { user_id: userId, category_id: categoryId, alias: "Smoke alias" });
    await insert(client, "merchants", { id: merchantId, user_id: userId, name: "Smoke merchant", normalized_name: "smoke merchant" });
    await insert(client, "events", { id: eventId, user_id: userId, name: "Smoke event" });
    await insert(client, "tags", { id: tagId, user_id: userId, name: "Smoke tag", kind_scope: "both" });

    await insert(client, "ledger_records", {
      id: expenseId,
      user_id: userId,
      kind: "expense",
      record_state: "active",
      local_date: "2026-07-17",
      timezone: "Asia/Taipei",
      time_precision: "day",
      account_id: accountId,
      amount_minor: 1234,
      currency: "TWD",
      category_id: categoryId,
      merchant_id: merchantId,
      event_id: eventId,
      source_label: "remote-smoke",
      version: 1,
      idempotency_key: `remote-smoke-expense:${Date.now()}`,
    });
    await insert(client, "ledger_record_tags", { user_id: userId, ledger_record_id: expenseId, tag_id: tagId });

    const transferRequest = {
      user_id: userId,
      action_type: "remote-smoke-transfer",
      idempotency_key: `remote-smoke-transfer:${Date.now()}`,
      request_hash: randomUUID(),
      expires_at: expiresAt,
    };
    const transferRecord = {
      id: transferId,
      user_id: userId,
      kind: "transfer",
      record_state: "active",
      local_date: "2026-07-17",
      timezone: "Asia/Taipei",
      time_precision: "day",
      account_id: accountId,
      amount_minor: 5000,
      currency: "TWD",
      version: 1,
      idempotency_key: transferRequest.idempotency_key,
      created_at: now,
      updated_at: now,
    };
    const transferDetails = {
      ledger_record_id: transferId,
      destination_account_id: destinationAccountId,
      destination_amount_minor: 5000,
      destination_currency: "TWD",
    };
    const bundle = {
      p_request: transferRequest,
      p_ledger_record: transferRecord,
      p_transfer_details: transferDetails,
      p_refund_links: [],
      p_ledger_record_tags: [{ user_id: userId, ledger_record_id: transferId, tag_id: tagId }],
      p_audit_events: [{ user_id: userId, event_type: "remote-smoke", target_type: "ledger-record", target_id: transferId, summary: "Remote smoke transfer", changes_json: {}, created_at: now }],
    };
    const firstTransfer = await requireData("transfer bundle", await client.rpc("persist_ledger_record_bundle", bundle));
    assert(firstTransfer.replayed === false, "first transfer bundle was not marked new");
    const replayedTransfer = await requireData("transfer replay", await client.rpc("persist_ledger_record_bundle", bundle));
    assert(replayedTransfer.replayed === true, "replayed transfer bundle was not marked replayed");

    await insert(client, "source_payloads", {
      id: sourceId,
      user_id: userId,
      source_type: "receipt-scan",
      source_state: "temporary",
      payload_json: { source: "remote-smoke" },
      expires_at: expiresAt,
    });
    await insert(client, "drafts", {
      id: draftId,
      user_id: userId,
      draft_type: "scan",
      state: "pending",
      source_payload_id: sourceId,
      candidate_json: { source: "remote-smoke" },
    });
    await insert(client, "media_assets", {
      id: mediaId,
      user_id: userId,
      bucket: "remote-smoke",
      object_key: `remote-smoke/${mediaId}.jpg`,
      content_type: "image/jpeg",
      media_kind: "receipt-scan",
      retention_kind: "temporary-scan",
      expires_at: expiresAt,
      upload_status: "queued",
    });
    await insert(client, "media_links", {
      user_id: userId,
      media_asset_id: mediaId,
      target_type: "source-payload",
      target_id: sourceId,
      link_intent: "receipt-evidence",
    });
    await insert(client, "meal_entries", {
      id: mealId,
      user_id: userId,
      meal_at: now,
      timezone: "Asia/Taipei",
      description: "Remote smoke meal",
    });
    await insert(client, "meal_transaction_links", {
      user_id: userId,
      meal_id: mealId,
      ledger_record_id: expenseId,
      link_reason: "manual",
      confidence: 1,
      confirmed_at: now,
    });
    await insert(client, "media_links", {
      user_id: userId,
      media_asset_id: mediaId,
      target_type: "meal",
      target_id: mealId,
      link_intent: "meal-photo",
    });

    const [ledgerRows, transferRows, draftRows, mealRows, mediaRows] = await Promise.all([
      client.from("ledger_records").select("id").eq("user_id", userId),
      client.from("transfer_details").select("ledger_record_id").eq("ledger_record_id", transferId),
      client.from("drafts").select("id").eq("id", draftId),
      client.from("meal_entries").select("id").eq("id", mealId),
      client.from("media_links").select("media_asset_id").eq("media_asset_id", mediaId),
    ]);
    for (const [name, result] of [["ledger rows", ledgerRows], ["transfer rows", transferRows], ["draft rows", draftRows], ["meal rows", mealRows], ["media links", mediaRows]]) {
      await requireData(`read ${name}`, result);
    }
    assert(ledgerRows.data.length === 2, "expected expense and transfer rows");
    assert(transferRows.data.length === 1, "expected one transfer detail row");
    assert(draftRows.data.length === 1, "expected one draft row");
    assert(mealRows.data.length === 1, "expected one meal row");
    assert(mediaRows.data.length === 2, "expected two media links without copying bytes");

    console.log("REMOTE_PERSISTENCE_SMOKE=PASS");
    console.log("REMOTE_SMOKE_ENTITIES=profile,accounts,references,ledger,transfer,idempotency,draft,source,media,meal");
  } finally {
    if (userId) {
      let cleanupError;
      try {
        if (serviceClient) {
          await removeWhere(serviceClient, "media_links", "user_id", userId);
          await removeWhere(serviceClient, "media_assets", "user_id", userId);
          await removeWhere(serviceClient, "meal_transaction_links", "user_id", userId);
          await removeWhere(serviceClient, "meal_entries", "user_id", userId);
          await removeWhere(serviceClient, "drafts", "user_id", userId);
          await removeWhere(serviceClient, "source_payloads", "user_id", userId);
          await removeWhere(serviceClient, "ledger_record_tags", "user_id", userId);
          await removeWhere(serviceClient, "audit_events", "user_id", userId);
          await removeWhere(serviceClient, "idempotency_keys", "user_id", userId);
          await removeWhere(serviceClient, "ledger_records", "user_id", userId);
          await removeWhere(serviceClient, "category_aliases", "user_id", userId);
          await removeWhere(serviceClient, "categories", "user_id", userId);
          await removeWhere(serviceClient, "merchants", "user_id", userId);
          await removeWhere(serviceClient, "events", "user_id", userId);
          await removeWhere(serviceClient, "tags", "user_id", userId);
          await removeWhere(serviceClient, "accounts", "user_id", userId);
          await removeWhere(serviceClient, "profiles", "user_id", userId);
        }
      } catch (error) {
        cleanupError = error;
      }
      try {
        await authRequest(url, `/auth/v1/admin/users/${userId}`, serviceRoleKey, "DELETE");
      } catch (error) {
        cleanupError ??= error;
      }
      if (cleanupError) throw cleanupError;
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
