"use client";

import { useEffect, useMemo } from "react";

import { GAME_PRESENCE_HEARTBEAT_INTERVAL_MS } from "@/lib/game/game-presence";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function GamePresenceHeartbeat() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    let disposed = false;
    let recording = false;

    async function recordPresence() {
      if (
        disposed ||
        recording ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      recording = true;
      try {
        const { error } = await supabase.rpc("record_current_game_presence");
        if (error) {
          console.error(
            "Impossible d’actualiser la présence du Directeur Sportif.",
            error,
          );
        }
      } catch (error) {
        console.error(
          "Impossible d’actualiser la présence du Directeur Sportif.",
          error,
        );
      } finally {
        recording = false;
      }
    }

    function recordWhenVisible() {
      if (document.visibilityState === "visible") {
        void recordPresence();
      }
    }

    void recordPresence();
    const intervalId = window.setInterval(
      () => void recordPresence(),
      GAME_PRESENCE_HEARTBEAT_INTERVAL_MS,
    );
    window.addEventListener("focus", recordWhenVisible);
    window.addEventListener("online", recordWhenVisible);
    document.addEventListener("visibilitychange", recordWhenVisible);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", recordWhenVisible);
      window.removeEventListener("online", recordWhenVisible);
      document.removeEventListener("visibilitychange", recordWhenVisible);
    };
  }, [supabase]);

  return null;
}
