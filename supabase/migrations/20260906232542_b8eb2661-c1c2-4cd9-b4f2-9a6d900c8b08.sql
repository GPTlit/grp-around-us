create or replace function public.agent_apply_migration_admin(_migration_id uuid, _token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  _sql text;
  _approval public.agent_approvals;
begin
  select * into _approval from public.agent_approvals
   where token = _token and action = 'apply_migration' and status = 'approved';
  if _approval.id is null then
    raise exception 'No approved confirmation for this migration';
  end if;
  if coalesce(_approval.details->>'migration_id','') <> _migration_id::text then
    raise exception 'Confirmation token is for a different migration';
  end if;

  select sql into _sql from public.agent_migrations where id = _migration_id;
  if _sql is null then raise exception 'Migration not found'; end if;

  execute _sql;

  update public.agent_migrations
     set status = 'applied', applied_at = now()
   where id = _migration_id;
  update public.agent_approvals
     set status = 'used', decided_at = now()
   where id = _approval.id;

  return jsonb_build_object('applied', true, 'migration_id', _migration_id);
end;
$fn$;

revoke all on function public.agent_apply_migration_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.agent_apply_migration_admin(uuid, text) to service_role;

create or replace function public.agent_inspect_schema_admin()
returns jsonb
language sql
security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'tables', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select c.relname as table_name,
               c.relrowsecurity as rls_enabled,
               (select coalesce(jsonb_agg(jsonb_build_object(
                  'column', a.attname,
                  'type', format_type(a.atttypid, a.atttypmod),
                  'not_null', a.attnotnull) order by a.attnum), '[]'::jsonb)
                from pg_attribute a
                where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns,
               (select coalesce(jsonb_agg(jsonb_build_object(
                  'name', p.polname, 'command', p.polcmd)), '[]'::jsonb)
                from pg_policy p where p.polrelid = c.oid) as policies
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by c.relname
      ) t
    ),
    'functions', (
      select coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    )
  );
$fn$;

revoke all on function public.agent_inspect_schema_admin() from public, anon, authenticated;
grant execute on function public.agent_inspect_schema_admin() to service_role;