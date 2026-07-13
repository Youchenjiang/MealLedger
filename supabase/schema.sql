-- MealLedger V1 canonical Supabase schema.
-- This file is the SQL Editor entrypoint; the same migration is kept under
-- migrations/0001_schema_core.sql for versioned application later.

create extension if not exists pgcrypto;

create type public.ledger_record_kind as enum (
  'expense', 'income', 'fund-addition', 'refund',
  'unresolved-expense', 'transfer', 'adjustment'
);
create type public.ledger_record_state as enum ('active', 'voided');
create type public.draft_state as enum ('pending', 'confirmed', 'discarded', 'conflict', 'archived');
create type public.source_payload_state as enum ('temporary', 'retained', 'confirmed', 'discarded', 'expired');
create type public.media_upload_state as enum ('queued', 'uploading', 'uploaded', 'failed', 'pending-delete', 'deleted');
create type public.media_retention_kind as enum ('temporary-scan', 'permanent');
create type public.media_link_intent as enum ('meal-photo', 'receipt-evidence', 'invoice-scan', 'attachment');
create type public.kind_scope as enum ('expense', 'income', 'funding', 'both');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_currency text not null default 'TWD',
  default_timezone text not null default 'Asia/Taipei',
  storage_persistence_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  currency text not null check (currency = upper(currency) and length(currency) between 3 and 8),
  account_type text not null default 'cash',
  allow_negative_balance boolean not null default true,
  disabled_at timestamptz,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  kind_scope public.kind_scope not null default 'expense',
  is_system_default boolean not null default false,
  disabled_at timestamptz,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, parent_id, name)
);

create table public.category_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  alias text not null check (length(trim(alias)) > 0),
  source text not null default 'legacy-import',
  review_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, alias)
);

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  normalized_name text not null,
  disabled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  starts_on date,
  ends_on date,
  disabled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  unique (user_id, name)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind_scope public.kind_scope not null default 'both',
  disabled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.ledger_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.ledger_record_kind not null,
  record_state public.ledger_record_state not null default 'active',
  local_date date,
  local_time time,
  timezone text not null default 'Asia/Taipei',
  time_precision text not null default 'day' check (time_precision in ('day', 'month', 'period')),
  period_start date,
  period_end date,
  account_id uuid not null references public.accounts(id),
  amount_minor bigint not null check (amount_minor <> 0),
  currency text not null check (currency = upper(currency) and length(currency) between 3 and 8),
  category_id uuid references public.categories(id),
  merchant_id uuid references public.merchants(id),
  merchant_text text,
  item_name text,
  source text,
  reason text,
  event_id uuid references public.events(id) on delete set null,
  source_label text,
  note text,
  version integer not null default 1 check (version > 0),
  idempotency_key text,
  deleted_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'adjustment' and amount_minor <> 0)
    or (kind <> 'adjustment' and amount_minor > 0)
  ),
  check (
    (time_precision = 'day' and local_date is not null)
    or (time_precision in ('month', 'period') and period_start is not null and period_end is not null and period_end >= period_start)
  ),
  check (record_state = 'active' or voided_at is not null),
  unique (user_id, idempotency_key)
);

create table public.transfer_details (
  ledger_record_id uuid primary key references public.ledger_records(id) on delete cascade,
  destination_account_id uuid not null references public.accounts(id),
  destination_amount_minor bigint not null check (destination_amount_minor > 0),
  destination_currency text not null,
  fee_ledger_record_id uuid references public.ledger_records(id) on delete set null,
  created_at timestamptz not null default now(),
  check (destination_currency = upper(destination_currency))
);

create table public.refund_links (
  refund_record_id uuid not null references public.ledger_records(id) on delete cascade,
  original_record_id uuid not null references public.ledger_records(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  refund_subtype text not null default 'refund' check (refund_subtype in ('refund', 'payback')),
  difference_kind text,
  created_at timestamptz not null default now(),
  primary key (refund_record_id, original_record_id),
  check (refund_record_id <> original_record_id)
);

create table public.ledger_record_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  ledger_record_id uuid not null references public.ledger_records(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ledger_record_id, tag_id)
);

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_at timestamptz not null,
  timezone text not null default 'Asia/Taipei',
  meal_period text,
  merchant_id uuid references public.merchants(id) on delete set null,
  place_text text,
  description text,
  disabled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_transaction_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.meal_entries(id) on delete cascade,
  ledger_record_id uuid not null references public.ledger_records(id) on delete cascade,
  link_reason text not null default 'manual',
  confidence numeric(4, 3) check (confidence between 0 and 1),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (meal_id, ledger_record_id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_provider text not null default 'r2',
  bucket text not null,
  object_key text not null,
  checksum_sha256 text,
  content_type text not null,
  byte_size bigint check (byte_size >= 0),
  captured_at timestamptz,
  media_kind text not null check (media_kind in ('meal-photo', 'receipt-scan', 'invoice-scan', 'attachment')),
  retention_kind public.media_retention_kind not null default 'temporary-scan',
  expires_at timestamptz,
  upload_status public.media_upload_state not null default 'queued',
  thumbnail_object_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_provider, bucket, object_key)
);

create table public.media_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  target_type text not null check (target_type in ('meal', 'ledger-record', 'draft', 'source-payload')),
  target_id uuid not null,
  link_intent public.media_link_intent not null,
  created_at timestamptz not null default now(),
  primary key (media_asset_id, target_type, target_id, link_intent)
);

create table public.source_payloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('receipt-scan', 'invoice-scan', 'meal-photo', 'spreadsheet-row', 'manual-import')),
  source_state public.source_payload_state not null default 'temporary',
  payload_json jsonb not null default '{}'::jsonb,
  payload_object_key text,
  expires_at timestamptz,
  confirmed_at timestamptz,
  discarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(payload_json::text) <= 65536 or payload_object_key is not null)
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_type text not null check (draft_type in ('manual', 'import', 'scan', 'recurrence', 'conflict')),
  state public.draft_state not null default 'pending',
  source_payload_id uuid references public.source_payloads(id) on delete set null,
  target_record_id uuid references public.ledger_records(id) on delete set null,
  candidate_json jsonb not null default '{}'::jsonb,
  conflict_local_json jsonb,
  conflict_remote_json jsonb,
  pinned_at timestamptz,
  archived_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  target_type text not null,
  target_id uuid not null,
  summary text not null,
  changes_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  action_type text not null,
  request_hash text not null,
  response_json jsonb,
  result_type text,
  result_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_category_parent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.categories parent
    where parent.id = new.parent_id and parent.user_id = new.user_id
  ) then
    raise exception 'category parent must belong to the same user';
  end if;
  return new;
end;
$$;

create trigger categories_parent_owned
before insert or update of parent_id, user_id on public.categories
for each row execute function public.validate_category_parent();

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'accounts', 'categories', 'merchants', 'events', 'tags', 'ledger_records', 'meal_entries', 'media_assets', 'source_payloads', 'drafts'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.prevent_account_currency_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.currency is distinct from new.currency and exists (
    select 1 from public.ledger_records record
    where record.account_id = old.id and record.deleted_at is null
  ) then
    raise exception 'account currency cannot change after ledger records exist';
  end if;
  return new;
end;
$$;

create trigger accounts_currency_immutable
before update of currency on public.accounts
for each row execute function public.prevent_account_currency_change();

create or replace function public.validate_ledger_currency()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  account_currency text;
begin
  select currency into account_currency from public.accounts where id = new.account_id and user_id = new.user_id;
  if account_currency is null or account_currency <> new.currency then
    raise exception 'ledger currency must match account currency';
  end if;
  return new;
end;
$$;

create trigger ledger_currency_matches_account
before insert or update on public.ledger_records
for each row execute function public.validate_ledger_currency();

create or replace function public.validate_transfer_details()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_record public.ledger_records;
  destination_owner uuid;
  destination_currency text;
begin
  select * into source_record from public.ledger_records where id = new.ledger_record_id;
  if source_record.id is null or source_record.kind <> 'transfer' then
    raise exception 'transfer_details must belong to a transfer record';
  end if;

  select user_id, currency into destination_owner, destination_currency
  from public.accounts where id = new.destination_account_id;
  if destination_owner is null or destination_owner <> source_record.user_id then
    raise exception 'transfer destination account must belong to the same user';
  end if;
  if destination_currency <> new.destination_currency then
    raise exception 'transfer destination currency must match destination account';
  end if;
  return new;
end;
$$;

create trigger transfer_details_valid
before insert or update on public.transfer_details
for each row execute function public.validate_transfer_details();

create or replace function public.require_transfer_details()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.kind = 'transfer' and not exists (
    select 1 from public.transfer_details details where details.ledger_record_id = new.id
  ) then
    raise exception 'transfer records require transfer_details';
  end if;
  return new;
end;
$$;

create constraint trigger ledger_transfer_details_required
after insert or update of kind on public.ledger_records
deferrable initially deferred
for each row execute function public.require_transfer_details();

create or replace function public.validate_refund_link()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  refund_owner uuid;
  refund_kind public.ledger_record_kind;
  original_owner uuid;
  original_kind public.ledger_record_kind;
begin
  select user_id, kind into refund_owner, refund_kind from public.ledger_records where id = new.refund_record_id;
  select user_id, kind into original_owner, original_kind from public.ledger_records where id = new.original_record_id;
  if refund_owner is null or refund_kind <> 'refund' then
    raise exception 'refund_links must belong to a refund record';
  end if;
  if original_owner is null or original_owner <> refund_owner or original_kind not in ('expense', 'unresolved-expense') then
    raise exception 'refund_links must point to an expense owned by the same user';
  end if;
  return new;
end;
$$;

create trigger refund_links_valid
before insert or update on public.refund_links
for each row execute function public.validate_refund_link();

create or replace function public.media_link_target_owned(p_target_type text, p_target_id uuid, p_user_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  select case p_target_type
    when 'meal' then exists (select 1 from public.meal_entries where id = p_target_id and user_id = p_user_id)
    when 'ledger-record' then exists (select 1 from public.ledger_records where id = p_target_id and user_id = p_user_id)
    when 'draft' then exists (select 1 from public.drafts where id = p_target_id and user_id = p_user_id)
    when 'source-payload' then exists (select 1 from public.source_payloads where id = p_target_id and user_id = p_user_id)
    else false
  end;
$$;

create or replace function public.audit_event_target_owned(p_target_type text, p_target_id uuid, p_user_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  select case p_target_type
    when 'account' then exists (select 1 from public.accounts where id = p_target_id and user_id = p_user_id)
    when 'category' then exists (select 1 from public.categories where id = p_target_id and user_id = p_user_id)
    when 'merchant' then exists (select 1 from public.merchants where id = p_target_id and user_id = p_user_id)
    when 'event' then exists (select 1 from public.events where id = p_target_id and user_id = p_user_id)
    when 'tag' then exists (select 1 from public.tags where id = p_target_id and user_id = p_user_id)
    when 'ledger-record' then exists (select 1 from public.ledger_records where id = p_target_id and user_id = p_user_id)
    when 'meal' then exists (select 1 from public.meal_entries where id = p_target_id and user_id = p_user_id)
    when 'media-asset' then exists (select 1 from public.media_assets where id = p_target_id and user_id = p_user_id)
    when 'source-payload' then exists (select 1 from public.source_payloads where id = p_target_id and user_id = p_user_id)
    when 'draft' then exists (select 1 from public.drafts where id = p_target_id and user_id = p_user_id)
    else false
  end;
$$;

create or replace function public.persist_ledger_record_bundle(
  p_request jsonb,
  p_ledger_record jsonb,
  p_transfer_details jsonb,
  p_refund_links jsonb default '[]'::jsonb,
  p_ledger_record_tags jsonb default '[]'::jsonb,
  p_audit_events jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  request_user uuid := (p_request->>'user_id')::uuid;
  request_key text := p_request->>'idempotency_key';
  request_hash text := p_request->>'request_hash';
  request_action text := p_request->>'action_type';
  request_expires timestamptz := (p_request->>'expires_at')::timestamptz;
  existing_hash text;
  existing_version integer;
  desired_version integer := (p_ledger_record->>'version')::integer;
  record_id uuid := (p_ledger_record->>'id')::uuid;
  ledger_row public.ledger_records;
  transfer_row public.transfer_details;
  was_replayed boolean := false;
begin
  if auth.uid() is null or request_user <> auth.uid() then
    raise exception 'bundle user does not match authenticated user' using errcode = '42501';
  end if;

  select request_hash into existing_hash
  from public.idempotency_keys
  where user_id = request_user and idempotency_key = request_key;

  if existing_hash is not null then
    if existing_hash <> request_hash then
      raise exception 'idempotency key was reused with a different request hash' using errcode = 'MELEDGER';
    end if;
    was_replayed := true;
  else
    insert into public.idempotency_keys (user_id, idempotency_key, action_type, request_hash, expires_at)
    values (request_user, request_key, request_action, request_hash, request_expires);
  end if;

  select version into existing_version
  from public.ledger_records
  where id = record_id and user_id = request_user
  for update;

  if existing_version is not null and existing_version not in (desired_version, desired_version - 1) then
    raise exception 'ledger record version conflict' using errcode = 'MELEDGER_CONFLICT';
  end if;

  ledger_row := jsonb_populate_record(null::public.ledger_records, p_ledger_record);
  if existing_version is null then
    insert into public.ledger_records (
      id, user_id, kind, record_state, local_date, local_time, timezone,
      time_precision, period_start, period_end, account_id, amount_minor,
      currency, category_id, merchant_id, merchant_text, item_name, source,
      reason, event_id, source_label, note, version, idempotency_key,
      deleted_at, voided_at, void_reason, created_at, updated_at
    ) values (
      ledger_row.id, ledger_row.user_id, ledger_row.kind, ledger_row.record_state,
      ledger_row.local_date, ledger_row.local_time, ledger_row.timezone,
      ledger_row.time_precision, ledger_row.period_start, ledger_row.period_end,
      ledger_row.account_id, ledger_row.amount_minor, ledger_row.currency,
      ledger_row.category_id, ledger_row.merchant_id, ledger_row.merchant_text,
      ledger_row.item_name, ledger_row.source, ledger_row.reason, ledger_row.event_id,
      ledger_row.source_label, ledger_row.note, ledger_row.version,
      ledger_row.idempotency_key, ledger_row.deleted_at, ledger_row.voided_at,
      ledger_row.void_reason, ledger_row.created_at, ledger_row.updated_at
    );
  elsif existing_version = desired_version - 1 then
    update public.ledger_records set
      kind = ledger_row.kind,
      record_state = ledger_row.record_state,
      local_date = ledger_row.local_date,
      local_time = ledger_row.local_time,
      timezone = ledger_row.timezone,
      time_precision = ledger_row.time_precision,
      period_start = ledger_row.period_start,
      period_end = ledger_row.period_end,
      account_id = ledger_row.account_id,
      amount_minor = ledger_row.amount_minor,
      currency = ledger_row.currency,
      category_id = ledger_row.category_id,
      merchant_id = ledger_row.merchant_id,
      merchant_text = ledger_row.merchant_text,
      item_name = ledger_row.item_name,
      source = ledger_row.source,
      reason = ledger_row.reason,
      event_id = ledger_row.event_id,
      source_label = ledger_row.source_label,
      note = ledger_row.note,
      version = ledger_row.version,
      idempotency_key = ledger_row.idempotency_key,
      deleted_at = ledger_row.deleted_at,
      voided_at = ledger_row.voided_at,
      void_reason = ledger_row.void_reason,
      updated_at = ledger_row.updated_at
    where id = record_id and user_id = request_user;
  end if;

  transfer_row := jsonb_populate_record(null::public.transfer_details, p_transfer_details);
  insert into public.transfer_details (ledger_record_id, destination_account_id, destination_amount_minor, destination_currency, fee_ledger_record_id)
  values (transfer_row.ledger_record_id, transfer_row.destination_account_id, transfer_row.destination_amount_minor, transfer_row.destination_currency, transfer_row.fee_ledger_record_id)
  on conflict (ledger_record_id) do update set
    destination_account_id = excluded.destination_account_id,
    destination_amount_minor = excluded.destination_amount_minor,
    destination_currency = excluded.destination_currency,
    fee_ledger_record_id = excluded.fee_ledger_record_id;

  insert into public.refund_links (refund_record_id, original_record_id, amount_minor, currency, refund_subtype, difference_kind)
  select refund_record_id, original_record_id, amount_minor, currency, refund_subtype, difference_kind
  from jsonb_populate_recordset(null::public.refund_links, coalesce(p_refund_links, '[]'::jsonb))
  on conflict (refund_record_id, original_record_id) do update set
    amount_minor = excluded.amount_minor,
    currency = excluded.currency,
    refund_subtype = excluded.refund_subtype,
    difference_kind = excluded.difference_kind;

  insert into public.ledger_record_tags (user_id, ledger_record_id, tag_id)
  select user_id, ledger_record_id, tag_id
  from jsonb_populate_recordset(null::public.ledger_record_tags, coalesce(p_ledger_record_tags, '[]'::jsonb))
  on conflict (ledger_record_id, tag_id) do update set user_id = excluded.user_id;

  insert into public.audit_events (user_id, event_type, target_type, target_id, summary, changes_json, created_at)
  select user_id, event_type, target_type, target_id, summary, changes_json, created_at
  from jsonb_populate_recordset(null::public.audit_events, coalesce(p_audit_events, '[]'::jsonb));

  return jsonb_build_object('replayed', was_replayed);
end;
$$;

create index accounts_user_active_idx on public.accounts (user_id, disabled_at, deleted_at, sort_order);
create index categories_user_parent_idx on public.categories (user_id, parent_id, disabled_at, deleted_at);
create index category_aliases_user_alias_idx on public.category_aliases (user_id, alias);
create index merchants_user_search_idx on public.merchants (user_id, normalized_name);
create index ledger_records_user_date_idx on public.ledger_records (user_id, deleted_at, local_date desc);
create index ledger_records_user_account_date_idx on public.ledger_records (user_id, deleted_at, account_id, local_date desc);
create index ledger_records_user_category_date_idx on public.ledger_records (user_id, deleted_at, category_id, local_date desc);
create index ledger_records_user_kind_date_idx on public.ledger_records (user_id, deleted_at, kind, local_date desc);
create index ledger_records_user_idempotency_idx on public.ledger_records (user_id, idempotency_key) where idempotency_key is not null;
create index drafts_user_state_idx on public.drafts (user_id, state, updated_at desc);
create index media_assets_cleanup_idx on public.media_assets (user_id, retention_kind, expires_at);
create index media_links_target_idx on public.media_links (user_id, target_type, target_id);
create index source_payloads_cleanup_idx on public.source_payloads (user_id, source_state, expires_at);
create index audit_events_target_idx on public.audit_events (user_id, target_type, target_id, created_at desc);
create index meal_entries_user_time_idx on public.meal_entries (user_id, meal_at desc);
create index meal_transaction_links_record_idx on public.meal_transaction_links (user_id, ledger_record_id);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.category_aliases enable row level security;
alter table public.merchants enable row level security;
alter table public.events enable row level security;
alter table public.tags enable row level security;
alter table public.ledger_records enable row level security;
alter table public.transfer_details enable row level security;
alter table public.refund_links enable row level security;
alter table public.ledger_record_tags enable row level security;
alter table public.meal_entries enable row level security;
alter table public.meal_transaction_links enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_links enable row level security;
alter table public.source_payloads enable row level security;
alter table public.drafts enable row level security;
alter table public.audit_events enable row level security;
alter table public.idempotency_keys enable row level security;

create policy profiles_owner on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy accounts_owner on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy categories_owner on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy aliases_owner on public.category_aliases for all
using (
  auth.uid() = user_id
  and (category_id is null or exists (select 1 from public.categories category where category.id = category_id and category.user_id = auth.uid()))
)
with check (
  auth.uid() = user_id
  and (category_id is null or exists (select 1 from public.categories category where category.id = category_id and category.user_id = auth.uid()))
);
create policy merchants_owner on public.merchants for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy events_owner on public.events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tags_owner on public.tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ledger_records_owner on public.ledger_records for all
using (
  auth.uid() = user_id
  and exists (select 1 from public.accounts account where account.id = account_id and account.user_id = auth.uid())
  and (category_id is null or exists (select 1 from public.categories category where category.id = category_id and category.user_id = auth.uid()))
  and (merchant_id is null or exists (select 1 from public.merchants merchant where merchant.id = merchant_id and merchant.user_id = auth.uid()))
  and (event_id is null or exists (select 1 from public.events event_row where event_row.id = event_id and event_row.user_id = auth.uid()))
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.accounts account where account.id = account_id and account.user_id = auth.uid())
  and (category_id is null or exists (select 1 from public.categories category where category.id = category_id and category.user_id = auth.uid()))
  and (merchant_id is null or exists (select 1 from public.merchants merchant where merchant.id = merchant_id and merchant.user_id = auth.uid()))
  and (event_id is null or exists (select 1 from public.events event_row where event_row.id = event_id and event_row.user_id = auth.uid()))
);
create policy transfer_details_owner on public.transfer_details for all
using (
  exists (select 1 from public.ledger_records record where record.id = ledger_record_id and record.user_id = auth.uid())
  and exists (select 1 from public.accounts account where account.id = destination_account_id and account.user_id = auth.uid())
  and (fee_ledger_record_id is null or exists (select 1 from public.ledger_records fee_record where fee_record.id = fee_ledger_record_id and fee_record.user_id = auth.uid()))
)
with check (
  exists (select 1 from public.ledger_records record where record.id = ledger_record_id and record.user_id = auth.uid())
  and exists (select 1 from public.accounts account where account.id = destination_account_id and account.user_id = auth.uid())
  and (fee_ledger_record_id is null or exists (select 1 from public.ledger_records fee_record where fee_record.id = fee_ledger_record_id and fee_record.user_id = auth.uid()))
);
create policy refund_links_owner on public.refund_links for all
using (
  exists (select 1 from public.ledger_records refund_record where refund_record.id = refund_record_id and refund_record.user_id = auth.uid())
  and exists (select 1 from public.ledger_records original_record where original_record.id = original_record_id and original_record.user_id = auth.uid())
)
with check (
  exists (select 1 from public.ledger_records refund_record where refund_record.id = refund_record_id and refund_record.user_id = auth.uid())
  and exists (select 1 from public.ledger_records original_record where original_record.id = original_record_id and original_record.user_id = auth.uid())
);
create policy ledger_record_tags_owner on public.ledger_record_tags for all
using (
  auth.uid() = user_id
  and exists (select 1 from public.ledger_records record where record.id = ledger_record_id and record.user_id = auth.uid())
  and exists (select 1 from public.tags tag where tag.id = tag_id and tag.user_id = auth.uid())
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.ledger_records record where record.id = ledger_record_id and record.user_id = auth.uid())
  and exists (select 1 from public.tags tag where tag.id = tag_id and tag.user_id = auth.uid())
);
create policy meals_owner on public.meal_entries for all
using (
  auth.uid() = user_id
  and (merchant_id is null or exists (select 1 from public.merchants merchant where merchant.id = merchant_id and merchant.user_id = auth.uid()))
)
with check (
  auth.uid() = user_id
  and (merchant_id is null or exists (select 1 from public.merchants merchant where merchant.id = merchant_id and merchant.user_id = auth.uid()))
);
create policy meal_transaction_links_owner on public.meal_transaction_links for all
using (
  auth.uid() = user_id
  and exists (select 1 from public.meal_entries meal where meal.id = meal_id and meal.user_id = auth.uid())
  and exists (select 1 from public.ledger_records record where record.id = ledger_record_id and record.user_id = auth.uid())
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.meal_entries meal where meal.id = meal_id and meal.user_id = auth.uid())
  and exists (select 1 from public.ledger_records record where record.id = ledger_record_id and record.user_id = auth.uid())
);
create policy media_assets_owner on public.media_assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy media_links_owner on public.media_links for all
using (
  auth.uid() = user_id
  and exists (select 1 from public.media_assets asset where asset.id = media_asset_id and asset.user_id = auth.uid())
  and public.media_link_target_owned(target_type, target_id, auth.uid())
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.media_assets asset where asset.id = media_asset_id and asset.user_id = auth.uid())
  and public.media_link_target_owned(target_type, target_id, auth.uid())
);
create policy source_payloads_owner on public.source_payloads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy drafts_owner on public.drafts for all
using (
  auth.uid() = user_id
  and (source_payload_id is null or exists (select 1 from public.source_payloads source where source.id = source_payload_id and source.user_id = auth.uid()))
  and (target_record_id is null or exists (select 1 from public.ledger_records record where record.id = target_record_id and record.user_id = auth.uid()))
)
with check (
  auth.uid() = user_id
  and (source_payload_id is null or exists (select 1 from public.source_payloads source where source.id = source_payload_id and source.user_id = auth.uid()))
  and (target_record_id is null or exists (select 1 from public.ledger_records record where record.id = target_record_id and record.user_id = auth.uid()))
);
create policy audit_events_owner on public.audit_events for all
using (auth.uid() = user_id and public.audit_event_target_owned(target_type, target_id, auth.uid()))
with check (auth.uid() = user_id and public.audit_event_target_owned(target_type, target_id, auth.uid()));
create policy idempotency_keys_owner on public.idempotency_keys for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
