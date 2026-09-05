REVOKE ALL ON FUNCTION public.is_app_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_owner() TO service_role;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_inspect_schema() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_apply_migration(uuid, text) FROM PUBLIC, anon, authenticated;

-- Server-trusted variants: the actor is verified in the app server (owner e-mail)
-- before these run with the service role.
CREATE OR REPLACE FUNCTION public.agent_inspect_schema_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'tables', (
      SELECT jsonb_agg(jsonb_build_object('table', c.relname, 'rls', c.relrowsecurity, 'columns', cols.cols) ORDER BY c.relname)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'notnull', a.attnotnull) ORDER BY a.attnum) AS cols
        FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      ) cols ON true
      WHERE c.relkind = 'r'
    ),
    'policies', (
      SELECT jsonb_agg(jsonb_build_object('table', tablename, 'name', policyname, 'command', cmd, 'roles', roles, 'using', qual, 'check', with_check) ORDER BY tablename, policyname)
      FROM pg_policies WHERE schemaname = 'public'
    ),
    'functions', (
      SELECT jsonb_agg(jsonb_build_object('name', p.proname, 'args', pg_get_function_identity_arguments(p.oid), 'security_definer', p.prosecdef) ORDER BY p.proname)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    ),
    'indexes', (
      SELECT jsonb_agg(jsonb_build_object('table', tablename, 'name', indexname) ORDER BY tablename, indexname)
      FROM pg_indexes WHERE schemaname = 'public'
    )
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.agent_apply_migration_admin(_migration_id uuid, _token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.agent_migrations; a public.agent_approvals;
BEGIN
  SELECT * INTO m FROM public.agent_migrations WHERE id = _migration_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Migration not found'; END IF;
  SELECT * INTO a FROM public.agent_approvals
    WHERE token = _token AND status = 'approved' AND action = 'apply_migration'
      AND details->>'migration_id' = _migration_id::text;
  IF a.id IS NULL THEN RAISE EXCEPTION 'No approved confirmation for this migration'; END IF;

  EXECUTE m.sql;

  UPDATE public.agent_migrations SET status = 'applied', applied_at = now() WHERE id = m.id;
  UPDATE public.agent_approvals SET status = 'used', decided_at = now() WHERE id = a.id;
  RETURN jsonb_build_object('ok', true, 'migration', m.name);
END $$;

DROP FUNCTION IF EXISTS public.agent_inspect_schema();
DROP FUNCTION IF EXISTS public.agent_apply_migration(uuid, text);

REVOKE ALL ON FUNCTION public.agent_inspect_schema_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_inspect_schema_admin() TO service_role;
REVOKE ALL ON FUNCTION public.agent_apply_migration_admin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_apply_migration_admin(uuid, text) TO service_role;