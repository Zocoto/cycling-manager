"use client";

import { useEffect, useMemo } from "react";

import {
  GAME_PRESENCE_HEARTBEAT_INTERVAL_MS,
  shouldRecordGamePresence,
} from "@/lib/game/global-chat-presence";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const GAME_PRESENCE_STORAGE_KEY =
  "cyclostratege:game-presence:last-recorded-at";

export function GamePresenceHeartbeat() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    async function recordCurrentPresence() {
      if (
        !active ||
        requestInFlight ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const attemptedAt = Date.now();
      if (
        !shouldRecordGamePresence({
          lastRecordedAt: readLastRecordedAt(),
          now: attemptedAt,
        })
      ) {
        return;
      }

      writeLastRecordedAt(attemptedAt);
      requestInFlight = true;
      const result = await supabase.rpc("record_current_game_presence");
      requestInFlight = false;

      if (active && result.error) {
        clearFailedPresenceAttempt(attemptedAt);
      }
    }

    function recordWhenVisible() {
      if (document.visibilityState === "visible") {
        void recordCurrentPresence();
      }
    }

    void recordCurrentPresence();
    const interval = window.setInterval(
      () => void recordCurrentPresence(),
      GAME_PRESENCE_HEARTBEAT_INTERVAL_MS,
    );
    window.addEventListener("focus", recordWhenVisible);
    document.addEventListener("visibilitychange", recordWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", recordWhenVisible);
      document.removeEventListener("visibilitychange", recordWhenVisible);
    };
  }, [supabase]);

  return null;
}

function readLastRecordedAt() {
  try {
    const value = window.localStorage.getItem(GAME_PRESENCE_STORAGE_KEY);
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLastRecordedAt(recordedAt: number) {
  try {
    window.localStorage.setItem(
      GAME_PRESENCE_STORAGE_KEY,
      String(recordedAt),
    );
  } catch {
    // La présence reste fonctionnelle sans déduplication inter-onglets.
  }
}

function clearFailedPresenceAttempt(attemptedAt: number) {
  try {
    if (
      window.localStorage.getItem(GAME_PRESENCE_STORAGE_KEY) ===
      String(attemptedAt)
    ) {
      window.localStorage.removeItem(GAME_PRESENCE_STORAGE_KEY);
    }
  } catch {
    // Aucun nettoyage n’est nécessaire lorsque le stockage est indisponible.
  }
}
