-- Run in the SQL Editor of your own Supabase project.
-- One atomic snapshot keeps completions, their successor reviews, and results together.
begin;
create table if not exists public.study_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 constraint workspace_shape check (
  (jsonb_typeof(data) = 'object'
   and data ?& array['subjects','sessions','exams','schedule']
   and jsonb_typeof(data->'subjects') = 'array'
   and jsonb_typeof(data->'sessions') = 'array'
   and jsonb_typeof(data->'exams') = 'array'
   and jsonb_typeof(data->'schedule') = 'array'
   and octet_length(data::text) <= 2097152) is true
 )
);
alter table public.study_workspaces enable row level security;
drop policy if exists own_workspace_read on public.study_workspaces;
create policy own_workspace_read on public.study_workspaces for select to authenticated using ((select auth.uid()) = user_id);
-- Writes only through the checked RPC below; browser clients never need a service key.
revoke all on public.study_workspaces from anon, authenticated;
grant select on public.study_workspaces to authenticated;

create or replace function public.save_study_workspace(p_user_id uuid, p_data jsonb, p_expected_revision bigint)
returns table(revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or p_user_id is distinct from auth.uid() then
  raise exception using errcode='42501', message='Workspace access denied';
 end if;
 if p_expected_revision is null or p_expected_revision < 0 then
  raise exception using errcode='22023', message='Invalid workspace revision';
 end if;
 if p_expected_revision = 0 then
  return query
   insert into public.study_workspaces as w(user_id,data,revision)
   values (p_user_id,p_data,1)
   on conflict (user_id) do nothing
   returning w.revision,w.updated_at;
 else
  return query
   update public.study_workspaces as w
   set data=p_data, revision=w.revision+1, updated_at=clock_timestamp()
   where w.user_id=p_user_id and w.revision=p_expected_revision
   returning w.revision,w.updated_at;
 end if;
 if not found then
  raise exception using errcode='40001', message='Workspace changed on another device. Reload before saving.';
 end if;
end;
$$;
revoke all on function public.save_study_workspace(uuid,jsonb,bigint) from public, anon;
grant execute on function public.save_study_workspace(uuid,jsonb,bigint) to authenticated;
commit;
