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
    expect(schemaSql).toContain("auth.uid() = user_id");
  });
});
