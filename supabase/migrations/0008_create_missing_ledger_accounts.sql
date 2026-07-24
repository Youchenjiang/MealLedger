-- Create missing account rows for local ledger references during cloud sync.
-- The operation remains scoped to the authenticated user and preserves the
-- existing atomic ledger bundle RPC.

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
  request_user uuid := (p_request->>'user_id')::uuid;
  source_account_id uuid := (p_ledger_record->>'account_id')::uuid;
  destination_account_id uuid;
  source_account_name text := trim(p_ledger_record->>'account_name');
  destination_account_name text := trim(p_transfer_details->>'destination_account_name');
  source_currency text := upper(coalesce(nullif(trim(p_ledger_record->>'currency'), ''), 'TWD'));
  destination_currency text := upper(coalesce(nullif(trim(p_transfer_details->>'destination_currency'), ''), source_currency));
begin
  if auth.uid() is null or request_user <> auth.uid() then
    raise exception 'bundle user does not match authenticated user' using errcode = '42501';
  end if;

  if (p_ledger_record->>'user_id')::uuid <> request_user then
    raise exception 'ledger user does not match authenticated user' using errcode = '42501';
  end if;

  if not exists (select 1 from public.accounts where id = source_account_id and user_id = request_user) then
    select id into source_account_id
    from public.accounts
    where user_id = request_user
      and lower(trim(name)) = lower(source_account_name)
    order by created_at, id
    limit 1;
    if source_account_id is null then
      if source_account_name = '' then
        raise exception 'ledger source account is not owned by current user' using errcode = '42501';
      end if;
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
        raise exception 'ledger source account is not owned by current user' using errcode = '42501';
      end if;
    end if;
    p_ledger_record := jsonb_set(p_ledger_record, '{account_id}', to_jsonb(source_account_id::text));
  end if;

  if p_transfer_details is not null and p_transfer_details <> '{}'::jsonb then
    destination_account_id := (p_transfer_details->>'destination_account_id')::uuid;
    if not exists (select 1 from public.accounts where id = destination_account_id and user_id = request_user) then
      select id into destination_account_id
      from public.accounts
      where user_id = request_user
        and lower(trim(name)) = lower(destination_account_name)
      order by created_at, id
      limit 1;
      if destination_account_id is null then
        if destination_account_name = '' then
          raise exception 'transfer destination account is not owned by current user' using errcode = '42501';
        end if;
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
          raise exception 'transfer destination account is not owned by current user' using errcode = '42501';
        end if;
      end if;
      p_transfer_details := jsonb_set(p_transfer_details, '{destination_account_id}', to_jsonb(destination_account_id::text));
    end if;
  end if;

  return public.persist_ledger_record_bundle(
    p_request,
    p_ledger_record - 'account_name',
    p_transfer_details - 'destination_account_name',
    p_refund_links,
    p_ledger_record_tags,
    p_audit_events
  );
end;
$$;

revoke all on function public.persist_ledger_record_bundle_resolved(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.persist_ledger_record_bundle_resolved(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
