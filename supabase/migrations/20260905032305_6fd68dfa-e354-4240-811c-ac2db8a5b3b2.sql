-- Owner check helper -------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_app_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), '')) = 'salemmoustapha15@gmail.com'
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Branches -----------------------------------------------------------
CREATE TABLE public.agent_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  base_branch text NOT NULL DEFAULT 'main',
  description text,
  active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_branches TO authenticated;
GRANT ALL ON public.agent_branches TO service_role;
ALTER TABLE public.agent_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_branches owner only" ON public.agent_branches FOR ALL TO authenticated
  USING (public.is_app_owner()) WITH CHECK (public.is_app_owner());
CREATE TRIGGER agent_branches_touch BEFORE UPDATE ON public.agent_branches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Files --------------------------------------------------------------
CREATE TABLE public.agent_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch text NOT NULL DEFAULT 'main',
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch, path)
);
CREATE INDEX agent_files_branch_idx ON public.agent_files (branch);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_files TO authenticated;
GRANT ALL ON public.agent_files TO service_role;
ALTER TABLE public.agent_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_files owner only" ON public.agent_files FOR ALL TO authenticated
  USING (public.is_app_owner()) WITH CHECK (public.is_app_owner());
CREATE TRIGGER agent_files_touch BEFORE UPDATE ON public.agent_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Commits ------------------------------------------------------------
CREATE TABLE public.agent_commits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch text NOT NULL,
  message text NOT NULL,
  changed_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  reverted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_commits_branch_idx ON public.agent_commits (branch, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_commits TO authenticated;
GRANT ALL ON public.agent_commits TO service_role;
ALTER TABLE public.agent_commits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_commits owner only" ON public.agent_commits FOR ALL TO authenticated
  USING (public.is_app_owner()) WITH CHECK (public.is_app_owner());

-- Migration drafts ---------------------------------------------------
CREATE TABLE public.agent_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sql text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  destructive boolean NOT NULL DEFAULT false,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_migrations TO authenticated;
GRANT ALL ON public.agent_migrations TO service_role;
ALTER TABLE public.agent_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_migrations owner only" ON public.agent_migrations FOR ALL TO authenticated
  USING (public.is_app_owner()) WITH CHECK (public.is_app_owner());
CREATE TRIGGER agent_migrations_touch BEFORE UPDATE ON public.agent_migrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Approvals ----------------------------------------------------------
CREATE TABLE public.agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_approvals TO authenticated;
GRANT ALL ON public.agent_approvals TO service_role;
ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_approvals owner only" ON public.agent_approvals FOR ALL TO authenticated
  USING (public.is_app_owner()) WITH CHECK (public.is_app_owner());

-- Audit log ----------------------------------------------------------
CREATE TABLE public.agent_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text,
  ok boolean NOT NULL DEFAULT true,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_audit_created_idx ON public.agent_audit (created_at DESC);
GRANT SELECT, INSERT ON public.agent_audit TO authenticated;
GRANT ALL ON public.agent_audit TO service_role;
ALTER TABLE public.agent_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_audit owner only" ON public.agent_audit FOR ALL TO authenticated
  USING (public.is_app_owner()) WITH CHECK (public.is_app_owner());

-- Preview deploy artifacts -------------------------------------------
CREATE TABLE public.agent_deploys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  branch text NOT NULL DEFAULT 'main',
  status text NOT NULL DEFAULT 'built',
  file_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_deploys TO authenticated;
GRANT ALL ON public.agent_deploys TO service_role;
ALTER TABLE public.agent_deploys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_deploys owner only" ON public.agent_deploys FOR ALL TO authenticated
  USING (public.is_app_owner()) WITH CHECK (public.is_app_owner());

-- Schema inspection (owner only) -------------------------------------
CREATE OR REPLACE FUNCTION public.agent_inspect_schema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_app_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
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

REVOKE ALL ON FUNCTION public.agent_inspect_schema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_inspect_schema() TO authenticated, service_role;

-- Approved migration runner (owner only, one-time token) --------------
CREATE OR REPLACE FUNCTION public.agent_apply_migration(_migration_id uuid, _token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m public.agent_migrations; a public.agent_approvals;
BEGIN
  IF NOT public.is_app_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
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

REVOKE ALL ON FUNCTION public.agent_apply_migration(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_apply_migration(uuid, text) TO authenticated, service_role;