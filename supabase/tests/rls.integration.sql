\set ON_ERROR_STOP on

begin;

-- These identities exist only in the local Supabase database for this run.
insert into auth.users (id, aud, role, email, created_at, updated_at,
                        email_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'rls-a@example.test', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'rls-b@example.test', now(), now(), now())
on conflict (id) do nothing;

set role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

insert into public.accounts (id, user_id, name, currency, account_type)
values ('20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'RLS A wallet', 'TWD', 'cash');

insert into public.categories (id, user_id, name, kind_scope)
values ('30000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'RLS A expense', 'expense');

insert into public.ledger_records (
  id, user_id, kind, local_date, account_id, amount_minor, currency,
  category_id, item_name
)
values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'expense', current_date, '20000000-0000-0000-0000-000000000001', 100,
  'TWD', '30000000-0000-0000-0000-000000000001', 'RLS A item'
);

insert into public.meal_entries (id, user_id, meal_at, description)
values ('50000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001', now(), 'RLS A meal');

insert into public.media_assets (
  id, user_id, bucket, object_key, content_type, media_kind, retention_kind,
  upload_status
)
values (
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'meal', 'rls-a/photo.jpg', 'image/jpeg', 'meal-photo', 'permanent',
  'queued'
);

insert into public.media_links (
  user_id, media_asset_id, target_type, target_id, link_intent
)
values (
  '10000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001', 'meal',
  '50000000-0000-0000-0000-000000000001', 'meal-photo'
);

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

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';

insert into public.accounts (id, user_id, name, currency, account_type)
values ('20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002',
        'RLS B wallet', 'TWD', 'cash');

insert into public.categories (id, user_id, name, kind_scope)
values ('30000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002',
        'RLS B expense', 'expense');

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
begin
  begin
    insert into public.ledger_records (
      id, user_id, kind, local_date, account_id, amount_minor, currency,
      category_id, item_name
    )
    values (
      '40000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      'expense', current_date, '20000000-0000-0000-0000-000000000001', 100,
      'TWD', '30000000-0000-0000-0000-000000000002', 'cross-owner item'
    );
    insert_succeeded := true;
  exception when others then
    null;
  end;

  if insert_succeeded then
    raise exception 'user B inserted a ledger record using user A account';
  end if;
end;
$$;

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into public.media_links (
      user_id, media_asset_id, target_type, target_id, link_intent
    )
    values (
      '10000000-0000-0000-0000-000000000002',
      '60000000-0000-0000-0000-000000000001', 'meal',
      '50000000-0000-0000-0000-000000000001', 'meal-photo'
    );
    insert_succeeded := true;
  exception when others then
    null;
  end;

  if insert_succeeded then
    raise exception 'user B inserted a media link to user A parents';
  end if;
end;
$$;

reset role;
delete from auth.users
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002'
);

commit;
