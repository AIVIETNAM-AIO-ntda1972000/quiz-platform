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
