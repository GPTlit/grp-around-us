REVOKE EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) FROM anon;

CREATE POLICY "voice_notes_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'voice-notes');
CREATE POLICY "voice_notes_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'voice-notes' AND owner = auth.uid());