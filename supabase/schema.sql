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
