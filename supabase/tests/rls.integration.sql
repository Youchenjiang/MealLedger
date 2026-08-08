\set ON_ERROR_STOP on

begin;

create temporary table rls_fixture (
  user_a_id uuid not null,
  user_b_id uuid not null,
  account_a_id uuid not null,
  account_b_id uuid not null,
  category_a_id uuid not null,
  category_b_id uuid not null,
  ledger_a_id uuid not null,
  ledger_b_id uuid not null,
  meal_a_id uuid not null,
  media_a_id uuid not null,
  auth_role text not null,
  currency text not null,
  account_type text not null,
  expense_kind text not null,
  media_kind text not null,
  retention_kind text not null,
  upload_status text not null
) on commit drop;

insert into rls_fixture values (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  'authenticated', 'TWD', 'cash', 'expense', 'meal-photo', 'permanent',
  'queued'
);

grant select on rls_fixture to authenticated;

-- These identities exist only in the local Supabase database for this run.
insert into auth.users (id, aud, role, email, created_at, updated_at,
                        email_confirmed_at)
select user_a_id, auth_role, auth_role, 'rls-a@example.test', now(), now(), now()
from rls_fixture
union all
select user_b_id, auth_role, auth_role, 'rls-b@example.test', now(), now(), now()
from rls_fixture
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', user_a_id::text, true)
from rls_fixture;

insert into public.accounts (id, user_id, name, currency, account_type)
select account_a_id, user_a_id, 'RLS A wallet', currency, account_type
from rls_fixture;

insert into public.categories (id, user_id, name, kind_scope)
select category_a_id, user_a_id, 'RLS A expense',
       expense_kind::public.kind_scope
from rls_fixture;

insert into public.ledger_records (
  id, user_id, kind, local_date, account_id, amount_minor, currency,
  category_id, item_name
)
select ledger_a_id, user_a_id, expense_kind::public.ledger_record_kind,
       current_date, account_a_id, 100, currency, category_a_id, 'RLS A item'
from rls_fixture;

insert into public.meal_entries (id, user_id, meal_at, description)
select meal_a_id, user_a_id, now(), 'RLS A meal'
from rls_fixture;

insert into public.media_assets (
  id, user_id, bucket, object_key, content_type, media_kind, retention_kind,
  upload_status
)
select media_a_id, user_a_id, 'meal', 'rls-a/photo.jpg', 'image/jpeg',
       media_kind, retention_kind::public.media_retention_kind,
       upload_status::public.media_upload_state
from rls_fixture;

insert into public.media_links (
  user_id, media_asset_id, target_type, target_id, link_intent
)
select user_a_id, media_a_id, 'meal', meal_a_id,
       media_kind::public.media_link_intent
from rls_fixture;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.accounts;
  if visible_count <> 1 then
    raise exception 'user A should see exactly one account, got %', visible_count;
  end if;

  select count(*) into visible_count from public.ledger_records;
  if visible_count <> 1 then
    raise exception 'user A should see exactly one ledger record, got %', visible_count;
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', user_b_id::text, true)
from rls_fixture;

insert into public.accounts (id, user_id, name, currency, account_type)
select account_b_id, user_b_id, 'RLS B wallet', currency, account_type
from rls_fixture;

insert into public.categories (id, user_id, name, kind_scope)
select category_b_id, user_b_id, 'RLS B expense',
       expense_kind::public.kind_scope
from rls_fixture;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.accounts;
  if visible_count <> 1 then
    raise exception 'user B should see exactly one account, got %', visible_count;
  end if;

  select count(*) into visible_count from public.media_links;
  if visible_count <> 0 then
    raise exception 'user B should not see user A media links, got %', visible_count;
  end if;
end;
$$;

do $$
declare
  insert_succeeded boolean := false;
  ownership_error_raised boolean := false;
begin
  begin
    insert into public.ledger_records (
      id, user_id, kind, local_date, account_id, amount_minor, currency,
      category_id, item_name
    )
    select ledger_b_id, user_b_id,
           expense_kind::public.ledger_record_kind, current_date, account_a_id,
           100, currency, category_b_id, 'cross-owner item'
    from rls_fixture;
    insert_succeeded := true;
  exception when raise_exception then
    ownership_error_raised := true;
  end;

  if insert_succeeded or not ownership_error_raised then
    raise exception 'user B inserted a ledger record using user A account';
  end if;
end;
$$;

do $$
declare
  insert_succeeded boolean := false;
  privilege_error_raised boolean := false;
begin
  begin
    insert into public.media_links (
      user_id, media_asset_id, target_type, target_id, link_intent
    )
    select user_b_id, media_a_id, 'meal', meal_a_id,
           media_kind::public.media_link_intent
    from rls_fixture;
    insert_succeeded := true;
  exception when insufficient_privilege then
    privilege_error_raised := true;
  end;

  if insert_succeeded or not privilege_error_raised then
    raise exception 'user B inserted a media link to user A parents';
  end if;
end;
$$;

-- The consolidated ledger bundle RPC runs as its definer and must enforce the
-- same ownership, idempotency, and version rules as the RLS policies above.
select set_config('request.jwt.claim.sub', user_a_id::text, true)
from rls_fixture;

do $$
declare
  fresh_result jsonb;
  replay_result jsonb;
  record_count integer;
begin
  fresh_result := public.persist_ledger_record_bundle_resolved(
    jsonb_build_object(
      'user_id', '10000000-0000-0000-0000-000000000001',
      'idempotency_key', 'rls-rpc-fresh-1',
      'action_type', 'record-create',
      'request_hash', 'hash-fresh-1',
      'expires_at', now() + interval '1 day'
    ),
    jsonb_build_object(
      'id', '40000000-0000-0000-0000-000000000003',
      'user_id', '10000000-0000-0000-0000-000000000001',
      'kind', 'expense',
      'record_state', 'active',
      'local_date', current_date::text,
      'timezone', 'Asia/Taipei',
      'time_precision', 'day',
      'account_id', '20000000-0000-0000-0000-000000000001',
      'amount_minor', '250',
      'currency', 'TWD',
      'category_id', '30000000-0000-0000-0000-000000000001',
      'version', 1,
      'created_at', now(),
      'updated_at', now()
    ),
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', '70000000-0000-0000-0000-000000000001',
      'user_id', '10000000-0000-0000-0000-000000000001',
      'event_type', 'record-created',
      'target_type', 'ledger-record',
      'target_id', '40000000-0000-0000-0000-000000000003',
      'summary', 'rpc bundle write',
      'changes_json', '{}'::jsonb,
      'created_at', now()
    ))
  );
  if (fresh_result ->> 'replayed') <> 'false' then
    raise exception 'fresh bundle write should not be replayed: %', fresh_result;
  end if;

  replay_result := public.persist_ledger_record_bundle_resolved(
    jsonb_build_object(
      'user_id', '10000000-0000-0000-0000-000000000001',
      'idempotency_key', 'rls-rpc-fresh-1',
      'action_type', 'record-create',
      'request_hash', 'hash-fresh-1',
      'expires_at', now() + interval '1 day'
    ),
    jsonb_build_object(
      'id', '40000000-0000-0000-0000-000000000003',
      'user_id', '10000000-0000-0000-0000-000000000001',
      'kind', 'expense',
      'record_state', 'active',
      'local_date', current_date::text,
      'timezone', 'Asia/Taipei',
      'time_precision', 'day',
      'account_id', '20000000-0000-0000-0000-000000000001',
      'amount_minor', '250',
      'currency', 'TWD',
      'category_id', '30000000-0000-0000-0000-000000000001',
      'version', 1,
      'created_at', now(),
      'updated_at', now()
    ),
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );
  if (replay_result ->> 'replayed') <> 'true' then
    raise exception 'replayed bundle write should report replayed: %', replay_result;
  end if;

  select count(*) into record_count
  from public.ledger_records
  where id = '40000000-0000-0000-0000-000000000003';
  if record_count <> 1 then
    raise exception 'expected exactly one ledger row, got %', record_count;
  end if;
end;
$$;

do $$
declare
  mismatch_rejected boolean := false;
begin
  begin
    perform public.persist_ledger_record_bundle_resolved(
      jsonb_build_object(
        'user_id', '10000000-0000-0000-0000-000000000001',
        'idempotency_key', 'rls-rpc-fresh-1',
        'action_type', 'record-create',
        'request_hash', 'hash-tampered',
        'expires_at', now() + interval '1 day'
      ),
      jsonb_build_object(
        'id', '40000000-0000-0000-0000-000000000003',
        'user_id', '10000000-0000-0000-0000-000000000001',
        'kind', 'expense',
        'record_state', 'active',
        'local_date', current_date::text,
        'timezone', 'Asia/Taipei',
        'time_precision', 'day',
        'account_id', '20000000-0000-0000-0000-000000000001',
        'amount_minor', '250',
        'currency', 'TWD',
        'category_id', '30000000-0000-0000-0000-000000000001',
        'version', 1,
        'created_at', now(),
        'updated_at', now()
      ),
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    );
  exception when sqlstate 'ME001' then
    mismatch_rejected := true;
  end;
  if not mismatch_rejected then
    raise exception 'idempotency key reused with a different hash was not rejected';
  end if;
end;
$$;

do $$
declare
  resumed_result jsonb;
  resumed_count integer;
begin
  -- Simulate a request that claimed its idempotency key and then crashed
  -- before the response was recorded: the RPC must resume the write and
  -- report a replay instead of failing or duplicating the record.
  insert into public.idempotency_keys (user_id, idempotency_key, action_type, request_hash, expires_at)
  values (
    '10000000-0000-0000-0000-000000000001',
    'rls-rpc-incomplete-1',
    'record-create',
    'hash-incomplete-1',
    now() + interval '1 day'
  );

  resumed_result := public.persist_ledger_record_bundle_resolved(
    jsonb_build_object(
      'user_id', '10000000-0000-0000-0000-000000000001',
      'idempotency_key', 'rls-rpc-incomplete-1',
      'action_type', 'record-create',
      'request_hash', 'hash-incomplete-1',
      'expires_at', now() + interval '1 day'
    ),
    jsonb_build_object(
      'id', '40000000-0000-0000-0000-000000000008',
      'user_id', '10000000-0000-0000-0000-000000000001',
      'kind', 'expense',
      'record_state', 'active',
      'local_date', current_date::text,
      'timezone', 'Asia/Taipei',
      'time_precision', 'day',
      'account_id', '20000000-0000-0000-0000-000000000001',
      'amount_minor', '75',
      'currency', 'TWD',
      'category_id', '30000000-0000-0000-0000-000000000001',
      'version', 1,
      'created_at', now(),
      'updated_at', now()
    ),
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );
  if (resumed_result ->> 'replayed') <> 'true' then
    raise exception 'resumed bundle write should report replayed: %', resumed_result;
  end if;

  select count(*) into resumed_count
  from public.ledger_records
  where id = '40000000-0000-0000-0000-000000000008';
  if resumed_count <> 1 then
    raise exception 'resumed bundle write did not persist the ledger row';
  end if;
end;
$$;

do $$
declare
  ownership_rejected boolean := false;
begin
  begin
    perform public.persist_ledger_record_bundle_resolved(
      jsonb_build_object(
        'user_id', '10000000-0000-0000-0000-000000000001',
        'idempotency_key', 'rls-rpc-cross-owner',
        'action_type', 'record-create',
        'request_hash', 'hash-cross-owner',
        'expires_at', now() + interval '1 day'
      ),
      jsonb_build_object(
        'id', '40000000-0000-0000-0000-000000000007',
        'user_id', '10000000-0000-0000-0000-000000000001',
        'kind', 'expense',
        'record_state', 'active',
        'local_date', current_date::text,
        'timezone', 'Asia/Taipei',
        'time_precision', 'day',
        'account_id', '20000000-0000-0000-0000-000000000002',
        'amount_minor', '100',
        'currency', 'TWD',
        'version', 1,
        'created_at', now(),
        'updated_at', now()
      ),
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    );
  exception when insufficient_privilege then
    ownership_rejected := true;
  end;
  if not ownership_rejected then
    raise exception 'user A bundle referencing user B account was not rejected';
  end if;
end;
$$;

do $$
declare
  persisted_id uuid;
  version_conflict_rejected boolean := false;
begin
  perform public.persist_ledger_record_bundle_resolved(
    jsonb_build_object(
      'user_id', '10000000-0000-0000-0000-000000000001',
      'idempotency_key', 'rls-rpc-version-1',
      'action_type', 'record-create',
      'request_hash', 'hash-version-1',
      'expires_at', now() + interval '1 day'
    ),
    jsonb_build_object(
      'id', '40000000-0000-0000-0000-000000000004',
      'user_id', '10000000-0000-0000-0000-000000000001',
      'kind', 'expense',
      'record_state', 'active',
      'local_date', current_date::text,
      'timezone', 'Asia/Taipei',
      'time_precision', 'day',
      'account_id', '20000000-0000-0000-0000-000000000001',
      'amount_minor', '100',
      'currency', 'TWD',
      'version', 1,
      'created_at', now(),
      'updated_at', now()
    ),
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );

  begin
    perform public.persist_ledger_record_bundle_resolved(
      jsonb_build_object(
        'user_id', '10000000-0000-0000-0000-000000000001',
        'idempotency_key', 'rls-rpc-version-2',
        'action_type', 'record-update',
        'request_hash', 'hash-version-2',
        'expires_at', now() + interval '1 day'
      ),
      jsonb_build_object(
        'id', '40000000-0000-0000-0000-000000000004',
        'user_id', '10000000-0000-0000-0000-000000000001',
        'kind', 'expense',
        'record_state', 'active',
        'local_date', current_date::text,
        'timezone', 'Asia/Taipei',
        'time_precision', 'day',
        'account_id', '20000000-0000-0000-0000-000000000001',
        'amount_minor', '125',
        'currency', 'TWD',
        'version', 3,
        'created_at', now(),
        'updated_at', now()
      ),
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    );
  exception when sqlstate 'ME002' then
    version_conflict_rejected := true;
  end;
  if not version_conflict_rejected then
    raise exception 'stale ledger version was not rejected';
  end if;
end;
$$;

do $$
declare
  persisted_account_id uuid;
begin
  perform public.persist_ledger_record_bundle_resolved(
    jsonb_build_object(
      'user_id', '10000000-0000-0000-0000-000000000001',
      'idempotency_key', 'rls-rpc-resolve-name',
      'action_type', 'record-create',
      'request_hash', 'hash-resolve-name',
      'expires_at', now() + interval '1 day'
    ),
    jsonb_build_object(
      'id', '40000000-0000-0000-0000-000000000005',
      'user_id', '10000000-0000-0000-0000-000000000001',
      'kind', 'expense',
      'record_state', 'active',
      'local_date', current_date::text,
      'timezone', 'Asia/Taipei',
      'time_precision', 'day',
      'account_id', '20000000-0000-0000-0000-00000000ffff',
      'account_name', 'RLS A wallet',
      'amount_minor', '100',
      'currency', 'TWD',
      'version', 1,
      'created_at', now(),
      'updated_at', now()
    ),
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );

  select account_id into persisted_account_id
  from public.ledger_records
  where id = '40000000-0000-0000-0000-000000000005';
  if persisted_account_id <> '20000000-0000-0000-0000-000000000001' then
    raise exception 'stale account id was not resolved by name, got %', persisted_account_id;
  end if;
end;
$$;

do $$
declare
  created_account_id uuid;
  created_count integer;
  transfer_count integer;
begin
  perform public.persist_ledger_record_bundle_resolved(
    jsonb_build_object(
      'user_id', '10000000-0000-0000-0000-000000000001',
      'idempotency_key', 'rls-rpc-auto-account',
      'action_type', 'record-create',
      'request_hash', 'hash-auto-account',
      'expires_at', now() + interval '1 day'
    ),
    jsonb_build_object(
      'id', '40000000-0000-0000-0000-000000000006',
      'user_id', '10000000-0000-0000-0000-000000000001',
      'kind', 'expense',
      'record_state', 'active',
      'local_date', current_date::text,
      'timezone', 'Asia/Taipei',
      'time_precision', 'day',
      'account_id', '20000000-0000-0000-0000-00000000fffe',
      'account_name', 'RPC auto wallet',
      'amount_minor', '100',
      'currency', 'TWD',
      'version', 1,
      'created_at', now(),
      'updated_at', now()
    ),
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );

  select count(*) into created_count
  from public.accounts
  where user_id = '10000000-0000-0000-0000-000000000001'
    and name = 'RPC auto wallet';
  if created_count <> 1 then
    raise exception 'bundle did not auto-create the missing source account';
  end if;

  -- Transfer bundles resolve and auto-create the destination account too.
  perform public.persist_ledger_record_bundle_resolved(
    jsonb_build_object(
      'user_id', '10000000-0000-0000-0000-000000000001',
      'idempotency_key', 'rls-rpc-transfer',
      'action_type', 'record-create',
      'request_hash', 'hash-transfer',
      'expires_at', now() + interval '1 day'
    ),
    jsonb_build_object(
      'id', '40000000-0000-0000-0000-000000000007',
      'user_id', '10000000-0000-0000-0000-000000000001',
      'kind', 'transfer',
      'record_state', 'active',
      'local_date', current_date::text,
      'timezone', 'Asia/Taipei',
      'time_precision', 'day',
      'account_id', '20000000-0000-0000-0000-000000000001',
      'amount_minor', '200',
      'currency', 'TWD',
      'version', 1,
      'created_at', now(),
      'updated_at', now()
    ),
    jsonb_build_object(
      'ledger_record_id', '40000000-0000-0000-0000-000000000007',
      'destination_account_id', '20000000-0000-0000-0000-00000000fffd',
      'destination_account_name', 'RPC auto destination',
      'destination_amount_minor', '200',
      'destination_currency', 'TWD',
      'fee_ledger_record_id', null
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );

  select count(*) into created_count
  from public.accounts
  where user_id = '10000000-0000-0000-0000-000000000001'
    and name = 'RPC auto destination';
  if created_count <> 1 then
    raise exception 'transfer bundle did not auto-create the destination account';
  end if;

  select count(*) into transfer_count
  from public.transfer_details
  where ledger_record_id = '40000000-0000-0000-0000-000000000007';
  if transfer_count <> 1 then
    raise exception 'transfer bundle did not persist transfer details';
  end if;
end;
$$;

commit;

-- Teardown runs in a fresh transaction: the deferred require_transfer_details
-- trigger fires at commit, so the transfer inserted above must be committed
-- with its detail row intact before it can be removed together with it.
begin;

-- Back to postgres so the cleanup bypasses row-level security (the fixture
-- role only has owner read/write policies).
reset role;

-- Remove RPC test residue in FK-safe order: deleting the ledger rows cascades
-- their transfer details, which frees the auto-created accounts from the
-- foreign keys that would otherwise block the auth.users cascade below.
-- The ids are literal because the temporary rls_fixture dropped on the
-- first commit.
delete from public.ledger_records
where id in (
  '40000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000004',
  '40000000-0000-0000-0000-000000000005',
  '40000000-0000-0000-0000-000000000006',
  '40000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000008'
);

delete from public.accounts
where user_id = '10000000-0000-0000-0000-000000000001'
  and name in ('RPC auto wallet', 'RPC auto destination');

delete from auth.users
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002'
);

commit;
