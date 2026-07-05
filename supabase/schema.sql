-- Meal Ledger: Supabase PostgreSQL schema for ledger + meals + R2 media.
-- Run in Supabase SQL editor after creating the project.

create extension if not exists pgcrypto;

create type transaction_kind as enum ('expense', 'income', 'transfer');
create type media_kind as enum ('meal_photo', 'receipt', 'other');
create type link_source as enum ('manual', 'time_match', 'merchant_match', 'ai_suggested', 'ai_confirmed');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  currency_code text not null default 'TWD',
  account_type text not null default 'cash',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references public.categories(id) on delete set null,
  kind transaction_kind not null default 'expense',
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind transaction_kind not null,
  occurred_at timestamptz not null,
  account_id uuid not null references public.accounts(id),
  transfer_account_id uuid references public.accounts(id),
  category_id uuid references public.categories(id),
  merchant_id uuid references public.merchants(id),
  amount numeric(14, 2) not null check (amount >= 0),
  currency_code text not null default 'TWD',
  exchange_rate_to_twd numeric(14, 6),
  note text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'transfer' and transfer_account_id is not null)
    or (kind <> 'transfer' and transfer_account_id is null)
  )
);

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null,
  merchant_id uuid references public.merchants(id),
  title text,
  foods text[] not null default '{}',
  rating smallint check (rating between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind media_kind not null default 'meal_photo',
  storage_provider text not null default 'r2',
  bucket text not null,
  object_key text not null,
  thumbnail_key text,
  content_type text not null,
  byte_size bigint,
  captured_at timestamptz,
  uploaded_at timestamptz not null default now(),
  ai_description text,
  ai_labels text[] not null default '{}',
  checksum_sha256 text,
  unique (storage_provider, bucket, object_key)
);

create table public.meal_media_links (
  meal_id uuid not null references public.meal_entries(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meal_id, media_id)
);

create table public.meal_transaction_links (
  meal_id uuid not null references public.meal_entries(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  source link_source not null default 'manual',
  confidence numeric(4, 3) check (confidence is null or confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (meal_id, transaction_id)
);

create table public.ai_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid references public.media_assets(id) on delete set null,
  raw_input text,
  parsed_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index transactions_user_time_idx on public.transactions (user_id, occurred_at desc);
create index meal_entries_user_time_idx on public.meal_entries (user_id, eaten_at desc);
create index media_assets_user_captured_idx on public.media_assets (user_id, captured_at desc);
create index media_assets_labels_idx on public.media_assets using gin (ai_labels);

create view public.ledger_export
with (security_invoker = true) as
select
  t.id as transaction_id,
  t.occurred_at,
  t.kind,
  a.name as account_name,
  ta.name as transfer_account_name,
  c.name as category_name,
  m.name as merchant_name,
  t.amount,
  t.currency_code,
  t.exchange_rate_to_twd,
  t.note,
  array_remove(array_agg(distinct ml.meal_id), null) as linked_meal_ids,
  array_remove(array_agg(distinct mm.media_id), null) as linked_media_ids
from public.transactions t
join public.accounts a on a.id = t.account_id
left join public.accounts ta on ta.id = t.transfer_account_id
left join public.categories c on c.id = t.category_id
left join public.merchants m on m.id = t.merchant_id
left join public.meal_transaction_links ml on ml.transaction_id = t.id
left join public.meal_media_links mm on mm.meal_id = ml.meal_id
group by t.id, a.name, ta.name, c.name, m.name;

create or replace function public.find_transaction_candidates_for_meal(
  p_meal_id uuid,
  p_window interval default interval '2 hours'
)
returns table (
  transaction_id uuid,
  occurred_at timestamptz,
  account_name text,
  category_name text,
  merchant_name text,
  amount numeric,
  currency_code text,
  confidence numeric
)
language sql
stable
set search_path = public
as $$
  with meal as (
    select me.id, me.user_id, me.eaten_at, me.merchant_id
    from public.meal_entries me
    where me.id = p_meal_id and me.user_id = auth.uid()
  )
  select
    t.id,
    t.occurred_at,
    a.name,
    c.name,
    m.name,
    t.amount,
    t.currency_code,
    least(
      1,
      0.45
      + case when t.merchant_id is not null and t.merchant_id = meal.merchant_id then 0.35 else 0 end
      + case when c.name in ('餐飲', '早餐', '午餐', '晚餐', '飲料', '外食') then 0.15 else 0 end
      + greatest(0, 0.05 - abs(extract(epoch from (t.occurred_at - meal.eaten_at))) / extract(epoch from p_window) * 0.05)
    )::numeric(4, 3) as confidence
  from meal
  join public.transactions t
    on t.user_id = meal.user_id
   and t.kind = 'expense'
   and t.occurred_at between meal.eaten_at - p_window and meal.eaten_at + p_window
  join public.accounts a on a.id = t.account_id
  left join public.categories c on c.id = t.category_id
  left join public.merchants m on m.id = t.merchant_id
  order by confidence desc, abs(extract(epoch from (t.occurred_at - meal.eaten_at))) asc
  limit 10;
$$;

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.merchants enable row level security;
alter table public.transactions enable row level security;
alter table public.meal_entries enable row level security;
alter table public.media_assets enable row level security;
alter table public.meal_media_links enable row level security;
alter table public.meal_transaction_links enable row level security;
alter table public.ai_imports enable row level security;

create policy "own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own merchants" on public.merchants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meals" on public.meal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own media" on public.media_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own ai imports" on public.ai_imports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own meal media links" on public.meal_media_links
  for all using (
    exists (
      select 1 from public.meal_entries meal
      where meal.id = meal_id and meal.user_id = auth.uid()
    )
    and exists (
      select 1 from public.media_assets media
      where media.id = media_id and media.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.meal_entries meal
      where meal.id = meal_id and meal.user_id = auth.uid()
    )
    and exists (
      select 1 from public.media_assets media
      where media.id = media_id and media.user_id = auth.uid()
    )
  );

create policy "own meal transaction links" on public.meal_transaction_links
  for all using (
    exists (
      select 1 from public.meal_entries meal
      where meal.id = meal_id and meal.user_id = auth.uid()
    )
    and exists (
      select 1 from public.transactions tx
      where tx.id = transaction_id and tx.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.meal_entries meal
      where meal.id = meal_id and meal.user_id = auth.uid()
    )
    and exists (
      select 1 from public.transactions tx
      where tx.id = transaction_id and tx.user_id = auth.uid()
    )
  );
