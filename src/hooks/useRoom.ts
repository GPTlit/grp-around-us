import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, Room } from "@/lib/game";
import { playChime } from "@/lib/sounds";

export type People = Record<string, string>;

export function useRoom(code: string, userId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [people, setPeople] = useState<People>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const roomIdRef = useRef<string | null>(null);

  const loadPeople = useCallback(async (r: Room) => {
    const ids = [r.moderator_id, r.player1_id, r.player2_id].filter(Boolean) as string[];
    const { data } = await supabase.from("profiles").select("id, username").in("id", ids);
    if (data) setPeople(Object.fromEntries(data.map((p) => [p.id, p.username as string])));
  }, []);

  // initial load
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data, error: err } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .maybeSingle();
      if (!alive) return;
      if (err || !data) {
        setError("Room not found.");
        setLoading(false);
        return;
      }
      const r = data as Room;
      setRoom(r);
      roomIdRef.current = r.id;
      void loadPeople(r);
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", r.id)
        .order("created_at", { ascending: true });
      if (alive && msgs) setMessages(msgs as ChatMessage[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [code, userId, loadPeople]);

  // realtime
  useEffect(() => {
    const roomId = room?.id;
    if (!roomId) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const next = payload.new as Room;
          setRoom(next);
          void loadPeople(next);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== userId) playChime("pop");
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room?.id, userId, loadPeople]);

  const send = useCallback(
    async (payload: Partial<ChatMessage>) => {
      if (!room || !userId) return;
      const { data, error: err } = await supabase
        .from("messages")
        .insert({ room_id: room.id, sender_id: userId, kind: "text", ...payload })
        .select()
        .single();
      if (err) {
        setError(err.message);
        return;
      }
      const m = data as ChatMessage;
      setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
    },
    [room, userId],
  );

  const patchRoom = useCallback(
    async (patch: Partial<Room>) => {
      if (!room) return;
      const { data, error: err } = await supabase
        .from("rooms")
        .update(patch)
        .eq("id", room.id)
        .select()
        .single();
      if (err) return setError(err.message);
      if (data) setRoom(data as Room);
    },
    [room],
  );

  return { room, messages, people, error, loading, send, patchRoom, setError };
}
