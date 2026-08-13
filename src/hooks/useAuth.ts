import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = { id: string; username: string; phone: string | null };

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) setProfile(null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("id, username, phone")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setProfile(data as Profile);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  return { session, user: session?.user ?? null, profile, loading };
}

/** Phone numbers are stored as a synthetic email so password auth works without SMS. */
export const phoneToEmail = (phone: string) =>
  `p${phone.replace(/[^0-9]/g, "")}@players.liarsdeck.app`;
