create role authenticated;
create role anon;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create publication supabase_realtime;

\ir schema.sql
\ir migrations/20260930_rich_sync.sql

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001');
insert into public.quiz_platform_data (user_id, data)
values ('00000000-0000-0000-0000-000000000001', '{"schemaVersion":1,"quizzes":[]}');

update public.quiz_platform_data set data = '{"schemaVersion":2,"quizzes":[]}'
where user_id = '00000000-0000-0000-0000-000000000001';

do $$
begin
  begin
    update public.quiz_platform_data set data = '{"schemaVersion":1,"quizzes":[]}'
    where user_id = '00000000-0000-0000-0000-000000000001';
    raise exception 'Expected old-client downgrade to fail';
  exception when sqlstate '23514' then
    null;
  end;
  if (select data->>'schemaVersion' from public.quiz_platform_data
      where user_id = '00000000-0000-0000-0000-000000000001') <> '2' then
    raise exception 'Version 2 snapshot was not preserved';
  end if;
end;
$$;

set role authenticated;
do $$
begin
  if public.quiz_sync_capability() <> 2 then
    raise exception 'Sync capability must be version 2';
  end if;
end;
$$;
reset role;
