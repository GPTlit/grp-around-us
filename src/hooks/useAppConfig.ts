import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { AppConfig } from "@/lib/blocks";

const FALLBACK: AppConfig = {
  id: "default",
  name: "Liar's Deck",
  tagline: "A 3-player bluffing card game with voice chat.",
  accent: "#e11d48",
  settings: {},
};

/** Live app identity, editable by the in-app AI Studio. */
export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(FALLBACK);

  useEffect(() => {
    let alive = true;
    const load = () =>
      supabase
        .from("app_config")
        .select("*")
        .eq("id", "default")
        .maybeSingle()
        .then(({ data }) => {
          if (alive && data) {
            setConfig({
              id: data.id,
              name: data.name,
              tagline: data.tagline,
              accent: data.accent,
              settings: (data.settings ?? {}) as Record<string, unknown>,
            });
          }
        });

    void load();
    const channel = supabase
      .channel("app-config")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_config" },
        () => void load(),
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return config;
}
