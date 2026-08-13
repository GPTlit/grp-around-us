CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  moderator_id uuid NOT NULL,
  player1_id uuid,
  player2_id uuid,
  score1 int NOT NULL DEFAULT 0,
  score2 int NOT NULL DEFAULT 0,
  lies1 int NOT NULL DEFAULT 0,
  lies2 int NOT NULL DEFAULT 0,
  turn int NOT NULL DEFAULT 1,
  round int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = _room_id
      AND (r.moderator_id = _user_id OR r.player1_id = _user_id OR r.player2_id = _user_id)
  )
$$;

CREATE POLICY "rooms_select_open" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms_insert_moderator" ON public.rooms FOR INSERT TO authenticated WITH CHECK (moderator_id = auth.uid());
CREATE POLICY "rooms_update_member_or_join" ON public.rooms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid,
  kind text NOT NULL DEFAULT 'text',
  body text,
  card_rank text,
  card_suit text,
  audio_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_room_idx ON public.messages (room_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_visible" ON public.messages FOR SELECT TO authenticated USING (
  public.is_room_member(room_id, auth.uid())
  AND (recipient_id IS NULL OR recipient_id = auth.uid() OR sender_id = auth.uid())
);
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND public.is_room_member(room_id, auth.uid())
);

CREATE TABLE public.call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms ON DELETE CASCADE,
  from_id uuid NOT NULL,
  to_id uuid,
  type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.call_signals TO authenticated;
GRANT ALL ON public.call_signals TO service_role;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals_select_member" ON public.call_signals FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "signals_insert_own" ON public.call_signals FOR INSERT TO authenticated WITH CHECK (from_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "signals_delete_own" ON public.call_signals FOR DELETE TO authenticated USING (from_id = auth.uid() OR to_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;