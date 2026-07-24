-- Evaluate the result ownership check with the function's definer privileges.
-- The helper still requires the result row to belong to the authenticated user,
-- but no longer gets blocked by the result table's own RLS policy while the
-- atomic transfer RPC finalizes its idempotency row.
create or replace function public.idempotency_result_owned(p_result_type text, p_result_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_result_type
    when 'ledger-record' then exists (select 1 from public.ledger_records where id = p_result_id and user_id = p_user_id)
    when 'draft' then exists (select 1 from public.drafts where id = p_result_id and user_id = p_user_id)
    when 'meal' then exists (select 1 from public.meal_entries where id = p_result_id and user_id = p_user_id)
    when 'media-asset' then exists (select 1 from public.media_assets where id = p_result_id and user_id = p_user_id)
    when 'source-payload' then exists (select 1 from public.source_payloads where id = p_result_id and user_id = p_user_id)
    else false
  end;
$$;
