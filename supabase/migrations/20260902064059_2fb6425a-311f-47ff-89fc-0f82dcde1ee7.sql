CREATE TABLE public.app_config (
  id text PRIMARY KEY DEFAULT 'default',
  name text NOT NULL DEFAULT 'Liar''s Deck',
  tagline text NOT NULL DEFAULT 'A 3-player bluffing card game with voice chat.',
  accent text NOT NULL DEFAULT '#e11d48',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_config TO anon;
GRANT SELECT, INSERT, UPDATE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_config readable by everyone" ON public.app_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "app_config writable by players" ON public.app_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "app_config updatable by players" ON public.app_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.app_config (id) VALUES ('default');

CREATE TABLE public.extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  icon text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.extensions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extensions TO authenticated;
GRANT ALL ON public.extensions TO service_role;
ALTER TABLE public.extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published extensions readable by everyone" ON public.extensions FOR SELECT TO anon USING (published);
CREATE POLICY "extensions readable by players" ON public.extensions FOR SELECT TO authenticated USING (true);
CREATE POLICY "extensions writable by players" ON public.extensions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "extensions updatable by players" ON public.extensions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "extensions deletable by players" ON public.extensions FOR DELETE TO authenticated USING (true);

CREATE TABLE public.code_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_path text NOT NULL,
  language text NOT NULL DEFAULT 'tsx',
  code text NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_drafts TO authenticated;
GRANT ALL ON public.code_drafts TO service_role;
ALTER TABLE public.code_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "code_drafts readable by players" ON public.code_drafts FOR SELECT TO authenticated USING (true);
CREATE POLICY "code_drafts writable by players" ON public.code_drafts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "code_drafts deletable by players" ON public.code_drafts FOR DELETE TO authenticated USING (true);

CREATE TABLE public.studio_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  summary text,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.studio_runs TO authenticated;
GRANT ALL ON public.studio_runs TO service_role;
ALTER TABLE public.studio_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "studio_runs readable by players" ON public.studio_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "studio_runs writable by players" ON public.studio_runs FOR INSERT TO authenticated WITH CHECK (true);