CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = _room_id
      AND (r.moderator_id = _user_id OR r.player1_id = _user_id OR r.player2_id = _user_id)
  )
$$;