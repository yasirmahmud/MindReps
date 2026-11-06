-- Run once in the Supabase SQL editor. Safe to run again.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table if not exists app_private.owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
revoke all on app_private.owner from public, anon, authenticated;

create or replace function public.is_mindreps_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from app_private.owner where user_id = (select auth.uid())); $$;
revoke all on function public.is_mindreps_owner() from public, anon;
grant execute on function public.is_mindreps_owner() to authenticated;

create table if not exists public.learning_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object'),
  check (payload->>'schema' = '1')
);
alter table public.learning_progress enable row level security;
revoke all on public.learning_progress from public, anon, authenticated;
grant select on public.learning_progress to authenticated;
drop policy if exists owner_read on public.learning_progress;
create policy owner_read on public.learning_progress for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_mindreps_owner()));

create or replace function public.load_progress(initial_payload jsonb)
returns setof public.learning_progress
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_mindreps_owner() then
    raise exception 'This account is not authorized for MindReps.' using errcode = '42501';
  end if;
  if jsonb_typeof(initial_payload) is distinct from 'object' or initial_payload->>'schema' is distinct from '1' then
    raise exception 'Unsupported progress format.';
  end if;
  insert into public.learning_progress(user_id, payload) values (auth.uid(), initial_payload)
    on conflict (user_id) do nothing;
  return query select * from public.learning_progress where user_id = auth.uid();
end; $$;

create or replace function public.save_progress(expected_revision bigint, next_payload jsonb)
returns setof public.learning_progress
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_mindreps_owner() then
    raise exception 'This account is not authorized for MindReps.' using errcode = '42501';
  end if;
  if jsonb_typeof(next_payload) is distinct from 'object' or next_payload->>'schema' is distinct from '1'
    or jsonb_typeof(next_payload->'attempts') is distinct from 'array'
    or coalesce(next_payload->>'lastMutation', '') = '' then
    raise exception 'Unsupported progress format.';
  end if;
  return query update public.learning_progress set payload = next_payload,
    revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = expected_revision returning *;
  if not found then
    raise exception 'Progress changed on another device.' using errcode = '40001';
  end if;
end; $$;
revoke all on function public.load_progress(jsonb) from public, anon;
revoke all on function public.save_progress(bigint,jsonb) from public, anon;
grant execute on function public.load_progress(jsonb) to authenticated;
grant execute on function public.save_progress(bigint,jsonb) to authenticated;
commit;

-- NEXT: Create your user in Authentication > Users > Add user (confirm email).
-- Replace YOUR-USER-UUID with its UUID, then run the following separately:
-- insert into app_private.owner (user_id) values ('YOUR-USER-UUID');
-- Only ONE owner can exist. No public client can edit this allowlist.
