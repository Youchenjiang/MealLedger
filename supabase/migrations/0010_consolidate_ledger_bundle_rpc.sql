-- Consolidate the layered ledger bundle RPC into one self-contained definition.
--
-- Historical migrations accumulated the active bundle boundary across five
-- files, each redefining the same protocol:
--   - 0005 secure_ledger_bundle_rpc               introduced the atomic bundle RPC
--   - 0006 precise_ledger_bundle_ownership_errors made ownership errors precise
--   - 0007 resolve_ledger_account_names           added a wrapper resolving stale ids by name
--   - 0008 create_missing_ledger_accounts         added account auto-creation to the wrapper
--   - 0009 name_ledger_bundle_literals            reworked the core function's literals
--
-- This migration replaces the wrapper with the single active definition used
-- by clients. It folds the 0009 core body (idempotency, version lock,
-- ownership checks, child writes) into the 0007/0008 account resolution, so
-- the boundary no longer depends on persist_ledger_record_bundle. That older
-- function is kept for compatibility but is no longer called by clients.
--
-- The signature, error codes (42501 / ME001 / ME002), grants, and replay
-- semantics are unchanged; only the internal layering is removed.

create or replace function public.persist_ledger_record_bundle_resolved(
  p_request jsonb,
  p_ledger_record jsonb,
  p_transfer_details jsonb,
  p_refund_links jsonb default '[]'::jsonb,
  p_ledger_record_tags jsonb default '[]'::jsonb,
  p_audit_events jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  user_id_key constant text := 'user_id';
  ledger_record_id_key constant text := 'ledger_record_id';
  forbidden_code constant text := '42501';
  replayed_key constant text := 'replayed';
  request_user uuid := (p_request->>user_id_key)::uuid;
  request_key text := p_request->>'idempotency_key';
  incoming_request_hash text := p_request->>'request_hash';
  request_action text := p_request->>'action_type';
  request_expires timestamptz := (p_request->>'expires_at')::timestamptz;
  existing_hash text;
  existing_expires timestamptz;
  existing_response jsonb;
  existing_version integer;
  desired_version integer := (p_ledger_record->>'version')::integer;
  record_id uuid := (p_ledger_record->>'id')::uuid;
  source_account_id uuid := (p_ledger_record->>'account_id')::uuid;
  source_account_name text := trim(p_ledger_record->>'account_name');
  source_currency text := upper(coalesce(nullif(trim(p_ledger_record->>'currency'), ''), 'TWD'));
  destination_account_id uuid;
  destination_account_name text := trim(p_transfer_details->>'destination_account_name');
  destination_currency text := upper(coalesce(nullif(trim(p_transfer_details->>'destination_currency'), ''), source_currency));
  ledger_row public.ledger_records;
  transfer_row public.transfer_details;
  was_replayed boolean := false;
begin
  if auth.uid() is null or request_user <> auth.uid() then
    raise exception 'bundle user does not match authenticated user' using errcode = forbidden_code;
  end if;

  if (p_ledger_record->>user_id_key)::uuid <> request_user then
    raise exception 'ledger user does not match authenticated user' using errcode = forbidden_code;
  end if;

  -- Resolve or create the source account within the authenticated user's scope.
  -- Ownership of the final account is guaranteed by construction, so the later
  -- checks below only verify the remaining referenced rows.
  if not exists (
    select 1 from public.accounts
    where id = source_account_id and user_id = request_user
  ) then
    if source_account_name is null or source_account_name = '' then
      raise exception 'ledger source account is not owned by current user' using errcode = forbidden_code;
    end if;
    select id into source_account_id
    from public.accounts
    where user_id = request_user
      and lower(trim(name)) = lower(source_account_name)
    order by created_at, id
    limit 1;
    if source_account_id is null then
      insert into public.accounts (user_id, name, currency, account_type, allow_negative_balance)
      values (request_user, source_account_name, source_currency, 'cash', true)
      on conflict (user_id, name) do nothing;
      select id into source_account_id
      from public.accounts
      where user_id = request_user
        and lower(trim(name)) = lower(source_account_name)
      order by created_at, id
      limit 1;
      if source_account_id is null then
        raise exception 'ledger source account is not owned by current user' using errcode = forbidden_code;
      end if;
    end if;
    p_ledger_record := jsonb_set(p_ledger_record, '{account_id}', to_jsonb(source_account_id::text));
  end if;

  if p_transfer_details is not null and p_transfer_details <> '{}'::jsonb then
    destination_account_id := (p_transfer_details->>'destination_account_id')::uuid;
    if not exists (
      select 1 from public.accounts
      where id = destination_account_id and user_id = request_user
    ) then
      if destination_account_name is null or destination_account_name = '' then
        raise exception 'transfer destination account is not owned by current user' using errcode = forbidden_code;
      end if;
      select id into destination_account_id
      from public.accounts
      where user_id = request_user
        and lower(trim(name)) = lower(destination_account_name)
      order by created_at, id
      limit 1;
      if destination_account_id is null then
        insert into public.accounts (user_id, name, currency, account_type, allow_negative_balance)
        values (request_user, destination_account_name, destination_currency, 'cash', true)
        on conflict (user_id, name) do nothing;
        select id into destination_account_id
        from public.accounts
        where user_id = request_user
          and lower(trim(name)) = lower(destination_account_name)
        order by created_at, id
        limit 1;
        if destination_account_id is null then
          raise exception 'transfer destination account is not owned by current user' using errcode = forbidden_code;
        end if;
      end if;
      p_transfer_details := jsonb_set(p_transfer_details, '{destination_account_id}', to_jsonb(destination_account_id::text));
    end if;
  end if;

  if (p_ledger_record->>'category_id') is not null and not exists (
    select 1 from public.categories
    where id = (p_ledger_record->>'category_id')::uuid and user_id = request_user
  ) then
    raise exception 'ledger category is not owned by current user' using errcode = forbidden_code;
  end if;
  if (p_ledger_record->>'merchant_id') is not null and not exists (
    select 1 from public.merchants
    where id = (p_ledger_record->>'merchant_id')::uuid and user_id = request_user
  ) then
    raise exception 'ledger merchant is not owned by current user' using errcode = forbidden_code;
  end if;
  if (p_ledger_record->>'event_id') is not null and not exists (
    select 1 from public.events
    where id = (p_ledger_record->>'event_id')::uuid and user_id = request_user
  ) then
    raise exception 'ledger event is not owned by current user' using errcode = forbidden_code;
  end if;

  if p_transfer_details is not null and p_transfer_details <> '{}'::jsonb then
    if (p_transfer_details->>ledger_record_id_key)::uuid <> record_id then
      raise exception 'transfer ledger record does not match bundle record' using errcode = forbidden_code;
    end if;
    if (p_transfer_details->>'fee_ledger_record_id') is not null and not exists (
      select 1 from public.ledger_records
      where id = (p_transfer_details->>'fee_ledger_record_id')::uuid and user_id = request_user
    ) then
      raise exception 'transfer fee record is not owned by current user' using errcode = forbidden_code;
    end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_refund_links, '[]'::jsonb)) as link
    where (link->>'refund_record_id')::uuid <> record_id
  ) then
    raise exception 'refund link does not match bundle record' using errcode = forbidden_code;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_refund_links, '[]'::jsonb)) as link
    where not exists (
      select 1 from public.ledger_records
      where id = (link->>'original_record_id')::uuid and user_id = request_user
    )
  ) then
    raise exception 'refund original record is not owned by current user' using errcode = forbidden_code;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_ledger_record_tags, '[]'::jsonb)) as tag
    where (tag->>user_id_key)::uuid <> request_user
  ) then
    raise exception 'ledger tag user does not match authenticated user' using errcode = forbidden_code;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_ledger_record_tags, '[]'::jsonb)) as tag
    where (tag->>ledger_record_id_key)::uuid <> record_id
  ) then
    raise exception 'ledger tag does not match bundle record' using errcode = forbidden_code;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_ledger_record_tags, '[]'::jsonb)) as tag
    where not exists (
      select 1 from public.tags
      where id = (tag->>'tag_id')::uuid and user_id = request_user
    )
  ) then
    raise exception 'ledger tag is not owned by current user' using errcode = forbidden_code;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_audit_events, '[]'::jsonb)) as audit
    where (audit->>user_id_key)::uuid <> request_user
  ) then
    raise exception 'audit event user does not match authenticated user' using errcode = forbidden_code;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_audit_events, '[]'::jsonb)) as audit
    where (audit->>'target_type') = 'ledger-record'
      and (audit->>'target_id')::uuid <> record_id
  ) then
    raise exception 'audit event does not match bundle record' using errcode = forbidden_code;
  end if;

  select ik.request_hash, ik.expires_at, ik.response_json
    into existing_hash, existing_expires, existing_response
  from public.idempotency_keys as ik
  where ik.user_id = request_user and ik.idempotency_key = request_key;

  if existing_hash is not null and existing_expires <= now() and existing_response is null then
    delete from public.idempotency_keys
    where user_id = request_user and idempotency_key = request_key;
    existing_hash := null;
    existing_response := null;
  end if;

  if existing_hash is not null then
    if existing_hash <> incoming_request_hash then
      raise exception 'idempotency key was reused with a different request hash' using errcode = 'ME001';
    end if;
    if existing_response is not null then
      return existing_response || jsonb_build_object(replayed_key, true);
    end if;
    was_replayed := true;
  else
    insert into public.idempotency_keys (user_id, idempotency_key, action_type, request_hash, expires_at)
    values (request_user, request_key, request_action, incoming_request_hash, request_expires);
  end if;

  select version into existing_version
  from public.ledger_records
  where id = record_id and user_id = request_user
  for update;

  if existing_version is not null and existing_version not in (desired_version, desired_version - 1) then
    raise exception 'ledger record version conflict' using errcode = 'ME002';
  end if;

  ledger_row := jsonb_populate_record(null::public.ledger_records, p_ledger_record - 'account_name');
  if existing_version is null then
    insert into public.ledger_records (
      id, user_id, kind, record_state, local_date, local_time, timezone,
      time_precision, period_start, period_end, account_id, amount_minor,
      currency, category_id, merchant_id, merchant_text, item_name, source,
      reason, event_id, source_label, note, version, idempotency_key,
      deleted_at, voided_at, void_reason, replaces_record_id, created_at, updated_at
    ) values (
      ledger_row.id, ledger_row.user_id, ledger_row.kind, ledger_row.record_state,
      ledger_row.local_date, ledger_row.local_time, ledger_row.timezone,
      ledger_row.time_precision, ledger_row.period_start, ledger_row.period_end,
      ledger_row.account_id, ledger_row.amount_minor, ledger_row.currency,
      ledger_row.category_id, ledger_row.merchant_id, ledger_row.merchant_text,
      ledger_row.item_name, ledger_row.source, ledger_row.reason, ledger_row.event_id,
      ledger_row.source_label, ledger_row.note, ledger_row.version,
      ledger_row.idempotency_key, ledger_row.deleted_at, ledger_row.voided_at,
      ledger_row.void_reason, ledger_row.replaces_record_id, ledger_row.created_at,
      ledger_row.updated_at
    );
  elsif existing_version = desired_version - 1 then
    update public.ledger_records set
      kind = ledger_row.kind, record_state = ledger_row.record_state,
      local_date = ledger_row.local_date, local_time = ledger_row.local_time,
      timezone = ledger_row.timezone, time_precision = ledger_row.time_precision,
      period_start = ledger_row.period_start, period_end = ledger_row.period_end,
      account_id = ledger_row.account_id, amount_minor = ledger_row.amount_minor,
      currency = ledger_row.currency, category_id = ledger_row.category_id,
      merchant_id = ledger_row.merchant_id, merchant_text = ledger_row.merchant_text,
      item_name = ledger_row.item_name, source = ledger_row.source,
      reason = ledger_row.reason, event_id = ledger_row.event_id,
      source_label = ledger_row.source_label, note = ledger_row.note,
      version = ledger_row.version, idempotency_key = ledger_row.idempotency_key,
      deleted_at = ledger_row.deleted_at, voided_at = ledger_row.voided_at,
      void_reason = ledger_row.void_reason,
      replaces_record_id = ledger_row.replaces_record_id, updated_at = ledger_row.updated_at
    where id = record_id and user_id = request_user;
  end if;

  if p_transfer_details is not null and p_transfer_details <> '{}'::jsonb then
    transfer_row := jsonb_populate_record(null::public.transfer_details, p_transfer_details - 'destination_account_name');
    insert into public.transfer_details (ledger_record_id, destination_account_id, destination_amount_minor, destination_currency, fee_ledger_record_id)
    values (transfer_row.ledger_record_id, transfer_row.destination_account_id, transfer_row.destination_amount_minor, transfer_row.destination_currency, transfer_row.fee_ledger_record_id)
    on conflict (ledger_record_id) do update set
      destination_account_id = excluded.destination_account_id,
      destination_amount_minor = excluded.destination_amount_minor,
      destination_currency = excluded.destination_currency,
      fee_ledger_record_id = excluded.fee_ledger_record_id;
  end if;

  insert into public.refund_links (refund_record_id, original_record_id, amount_minor, currency, refund_subtype, difference_kind)
  select refund_record_id, original_record_id, amount_minor, currency, refund_subtype, difference_kind
  from jsonb_populate_recordset(null::public.refund_links, coalesce(p_refund_links, '[]'::jsonb))
  on conflict (refund_record_id, original_record_id) do update set
    amount_minor = excluded.amount_minor, currency = excluded.currency,
    refund_subtype = excluded.refund_subtype, difference_kind = excluded.difference_kind;

  insert into public.ledger_record_tags (user_id, ledger_record_id, tag_id)
  select user_id, ledger_record_id, tag_id
  from jsonb_populate_recordset(null::public.ledger_record_tags, coalesce(p_ledger_record_tags, '[]'::jsonb))
  on conflict (ledger_record_id, tag_id) do update set user_id = excluded.user_id;

  insert into public.audit_events (user_id, event_type, target_type, target_id, summary, changes_json, created_at)
  select user_id, event_type, target_type, target_id, summary, changes_json, created_at
  from jsonb_populate_recordset(null::public.audit_events, coalesce(p_audit_events, '[]'::jsonb))
  on conflict (id) do nothing;

  update public.idempotency_keys
  set response_json = jsonb_build_object(replayed_key, was_replayed, ledger_record_id_key, record_id),
      result_type = 'ledger-record', result_id = record_id
  where user_id = request_user and idempotency_key = request_key;

  return jsonb_build_object(replayed_key, was_replayed);
end;
$$;

revoke all on function public.persist_ledger_record_bundle_resolved(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.persist_ledger_record_bundle_resolved(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
