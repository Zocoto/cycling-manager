"use client";

import { useEffect, useState } from "react";

/**
 * Fait avancer l'heure reçue du serveur avec une durée locale monotone. Une
 * horloge système mal réglée chez un spectateur ne peut ainsi plus le placer
 * sur un autre tronçon du direct.
 */
export function useSynchronizedRaceClock(
  serverNowIso: string,
  refreshIntervalMs: number
) {
  const [clock, setClock] = useState(() => new Date(serverNowIso));

  useEffect(() => {
    const serverStartedAt = Date.parse(serverNowIso);
    const monotonicStartedAt = window.performance.now();
    const tick = () => {
      setClock(
        new Date(
          serverStartedAt +
            (window.performance.now() - monotonicStartedAt)
        )
      );
    };

    tick();
    const timer = window.setInterval(tick, refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [refreshIntervalMs, serverNowIso]);

  return clock;
}
