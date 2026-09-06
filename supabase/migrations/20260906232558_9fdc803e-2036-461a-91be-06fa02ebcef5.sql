create or replace function public.is_app_owner()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'salemmoustapha15@gmail.com'
$$;

grant execute on function public.is_app_owner() to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['agent_files','agent_branches','agent_commits','agent_approvals','agent_migrations','agent_deploys','agent_audit']
  loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('drop policy if exists "Owner can read %1$s" on public.%1$I', t);
    execute format('create policy "Owner can read %1$s" on public.%1$I for select to authenticated using (public.is_app_owner())', t);
  end loop;
end $$;

drop policy if exists "Owner can decide approvals" on public.agent_approvals;
create policy "Owner can decide approvals" on public.agent_approvals
  for update to authenticated using (public.is_app_owner()) with check (public.is_app_owner());
grant update on public.agent_approvals to authenticated;