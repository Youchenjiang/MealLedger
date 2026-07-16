import { describe, expect, test } from "vitest";
import schemaSql from "../../supabase/schema.sql?raw";
import migrationSql from "../../supabase/migrations/0001_schema_core.sql?raw";
import { ledgerRecordKinds } from "./contracts";

const requiredTables = [
  "profiles",
  "accounts",
  "categories",
  "category_aliases",
  "merchants",
  "events",
  "tags",
  "ledger_records",
  "transfer_details",
  "refund_links",
  "ledger_record_tags",
  "meal_entries",
  "meal_transaction_links",
  "media_assets",
  "media_links",
  "source_payloads",
  "drafts",
  "audit_events",
  "idempotency_keys",
];

describe("schema core contract", () => {
  test("keeps the SQL editor entrypoint and migration identical", () => {
    expect(migrationSql).toBe(schemaSql);
  });

  test("defines all V1 tables and accounting kinds", () => {
    for (const table of requiredTables) {
      expect(schemaSql).toContain(`create table public.${table}`);
    }

    for (const kind of ledgerRecordKinds) {
      expect(schemaSql).toContain(`'${kind}'`);
    }

    expect(schemaSql).toContain("amount_minor bigint not null");
    expect(schemaSql).toContain("time_precision in ('day', 'month', 'period')");
    expect(schemaSql).toContain("parent_key uuid generated always as");
    expect(schemaSql).toContain("unique (user_id, parent_key, name)");
    expect(schemaSql).toContain("create table public.transfer_details");
    expect(schemaSql).toContain("create table public.refund_links");
  });

  test("defines ownership, immutability, idempotency, and cleanup protections", () => {
    expect(schemaSql).toContain("create trigger accounts_currency_immutable");
    expect(schemaSql).toContain("where transfer.destination_account_id = old.id");
    expect(schemaSql).toContain("create trigger ledger_currency_matches_account");
    expect(schemaSql).toContain("check (kind <> 'adjustment' or coalesce(length(trim(reason)), 0) > 0)");
    expect(schemaSql).toContain("replaces_record_id uuid references public.ledger_records(id)");
    expect(schemaSql).toContain("create trigger ledger_replacement_valid");
    expect(schemaSql).toContain("a ledger record cannot replace itself");
    expect(schemaSql).toContain("unique (user_id, idempotency_key)");
    expect(schemaSql).toContain("create index idempotency_keys_expiry_idx");
    expect(schemaSql).toContain("existing_response jsonb");
    expect(schemaSql).toContain("existing_expires <= now() and existing_response is null");
    expect(schemaSql).toContain("response_json = jsonb_build_object");
    expect(schemaSql).toContain("source_state <> 'temporary' or expires_at is not null");
    expect(schemaSql).toContain("retention_kind <> 'temporary-scan' or expires_at is not null");
    expect(schemaSql).toContain("checksum_sha256 is null or checksum_sha256 ~");
    expect(schemaSql).toContain("create unique index media_assets_user_checksum_idx");
    expect(schemaSql).toContain("create index media_assets_cleanup_idx");
    expect(schemaSql).toContain("alter table public.ledger_records enable row level security");
    expect(schemaSql).toContain("create policy ledger_records_owner");
    expect(schemaSql).toContain("create trigger transfer_details_valid");
    expect(schemaSql).toContain("create trigger transfer_details_delete_guard");
    expect(schemaSql).toContain("transfer fee must be an expense owned by the same user");
    expect(schemaSql).toContain("create trigger refund_links_valid");
    expect(schemaSql).toContain("refund link currency must match the refund record currency");
    expect(schemaSql).toContain("create constraint trigger ledger_transfer_details_required");
    expect(schemaSql).toContain("create or replace function public.media_link_target_owned");
    expect(schemaSql).toContain("create or replace function public.persist_ledger_record_bundle");
    expect(schemaSql).toContain("on conflict (id) do nothing");
    expect(schemaSql).toContain("asset.user_id = auth.uid()");
    expect(schemaSql).toContain("public.media_link_target_owned(target_type, target_id, auth.uid())");
    expect(schemaSql).toContain("create trigger categories_parent_owned");
    expect(schemaSql).toContain("create or replace function public.audit_event_target_owned");
    expect(schemaSql).toContain("public.audit_event_target_owned(target_type, target_id, auth.uid())");
    expect(schemaSql).toContain("create or replace function public.idempotency_result_owned");
    expect(schemaSql).toContain("public.idempotency_result_owned(result_type, result_id, auth.uid())");
    expect(schemaSql).toContain("errcode = 'ME001'");
    expect(schemaSql).toContain("errcode = 'ME002'");
  });

  test("checks ownership on both sides of relational links", () => {
    expect(schemaSql).toContain("account.user_id = auth.uid()");
    expect(schemaSql).toContain("original_record.user_id = auth.uid()");
    expect(schemaSql).toContain("tag.user_id = auth.uid()");
    expect(schemaSql).toContain("meal.user_id = auth.uid()");
    expect(schemaSql).toContain("merchant.user_id = auth.uid()");
    expect(schemaSql).toContain("source.user_id = auth.uid()");
    expect(schemaSql).toContain("target_record_id is null or exists (select 1 from public.ledger_records record");
    expect(schemaSql).toContain("fee_ledger_record_id is null or exists (select 1 from public.ledger_records fee_record");
  });
});
