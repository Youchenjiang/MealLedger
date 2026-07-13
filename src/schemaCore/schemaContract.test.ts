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
    expect(schemaSql).toContain("create table public.transfer_details");
    expect(schemaSql).toContain("create table public.refund_links");
  });

  test("defines ownership, immutability, idempotency, and cleanup protections", () => {
    expect(schemaSql).toContain("create trigger accounts_currency_immutable");
    expect(schemaSql).toContain("create trigger ledger_currency_matches_account");
    expect(schemaSql).toContain("unique (user_id, idempotency_key)");
    expect(schemaSql).toContain("create index media_assets_cleanup_idx");
    expect(schemaSql).toContain("alter table public.ledger_records enable row level security");
    expect(schemaSql).toContain("create policy ledger_records_owner");
    expect(schemaSql).toContain("create trigger transfer_details_valid");
    expect(schemaSql).toContain("create trigger refund_links_valid");
    expect(schemaSql).toContain("create constraint trigger ledger_transfer_details_required");
    expect(schemaSql).toContain("create or replace function public.media_link_target_owned");
    expect(schemaSql).toContain("create or replace function public.persist_ledger_record_bundle");
    expect(schemaSql).toContain("asset.user_id = auth.uid()");
    expect(schemaSql).toContain("public.media_link_target_owned(target_type, target_id, auth.uid())");
    expect(schemaSql).toContain("create trigger categories_parent_owned");
    expect(schemaSql).toContain("create or replace function public.audit_event_target_owned");
    expect(schemaSql).toContain("public.audit_event_target_owned(target_type, target_id, auth.uid())");
  });

  test("checks ownership on both sides of relational links", () => {
    expect(schemaSql).toContain("account.user_id = auth.uid()");
    expect(schemaSql).toContain("original_record.user_id = auth.uid()");
    expect(schemaSql).toContain("tag.user_id = auth.uid()");
    expect(schemaSql).toContain("meal.user_id = auth.uid()");
    expect(schemaSql).toContain("source.user_id = auth.uid()");
    expect(schemaSql).toContain("target_record_id is null or exists (select 1 from public.ledger_records record");
    expect(schemaSql).toContain("fee_ledger_record_id is null or exists (select 1 from public.ledger_records fee_record");
  });
});
