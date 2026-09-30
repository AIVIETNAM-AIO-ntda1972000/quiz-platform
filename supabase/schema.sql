create table if not exists public.quiz_platform_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.quiz_platform_data enable row level security;

revoke all on table public.quiz_platform_data from anon, authenticated;
grant select, insert, update on table public.quiz_platform_data to authenticated;

drop policy if exists "Users can read their own quiz data" on public.quiz_platform_data;
create policy "Users can read their own quiz data"
on public.quiz_platform_data
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own quiz data" on public.quiz_platform_data;
create policy "Users can insert their own quiz data"
on public.quiz_platform_data
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own quiz data" on public.quiz_platform_data;
create policy "Users can update their own quiz data"
on public.quiz_platform_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.quiz_sync_capability()
returns integer
language sql
stable
set search_path = public
as $$ select 2; $$;

revoke all on function public.quiz_sync_capability() from public;
grant execute on function public.quiz_sync_capability() to authenticated;

create or replace function public.protect_quiz_snapshot_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.data->>'schemaVersion' = '2' and new.data->>'schemaVersion' is distinct from '2' then
    raise exception 'Quiz snapshot version 2 cannot be overwritten by an older client' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_quiz_snapshot_version on public.quiz_platform_data;
create trigger protect_quiz_snapshot_version
before update on public.quiz_platform_data
for each row execute function public.protect_quiz_snapshot_version();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_platform_data'
  ) then
    alter publication supabase_realtime add table public.quiz_platform_data;
  end if;
end $$;

create table if not exists public.quiz_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id text not null,
  title text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  source_client_id text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists quiz_inbox_user_status_created_idx
on public.quiz_inbox (user_id, status, created_at desc);

alter table public.quiz_inbox enable row level security;

revoke all on table public.quiz_inbox from anon, authenticated;
grant select, update, delete on table public.quiz_inbox to authenticated;

drop policy if exists "Users can read their own quiz inbox" on public.quiz_inbox;
create policy "Users can read their own quiz inbox"
on public.quiz_inbox
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can review their own quiz inbox" on public.quiz_inbox;
create policy "Users can review their own quiz inbox"
on public.quiz_inbox
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own quiz inbox" on public.quiz_inbox;
create policy "Users can delete their own quiz inbox"
on public.quiz_inbox
for delete
to authenticated
using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_inbox'
  ) then
    alter publication supabase_realtime add table public.quiz_inbox;
  end if;
end $$;
