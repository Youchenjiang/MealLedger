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

reset role;
delete from auth.users
where id in (select user_a_id from rls_fixture
             union all
             select user_b_id from rls_fixture);

commit;
