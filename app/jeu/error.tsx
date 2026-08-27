"use client";

import { useEffect, useState } from "react";

import { GameRouteLoading } from "@/components/game/game-route-loading";

const AUTOMATIC_RETRY_LIMIT = 2;
const RETRY_WINDOW_MS = 30_000;

export default function GameError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const [showRecoveryActions, setShowRecoveryActions] = useState(false);

  useEffect(() => {
    console.error("game_route_error", {
      digest: error.digest ?? null,
      message: error.message,
    });

    const retryKey = `game-route-recovery:${error.digest ?? window.location.pathname}`;
    const now = Date.now();
    let retryCount = 0;

    try {
      const stored = window.sessionStorage.getItem(retryKey);
      const recovery = stored
        ? (JSON.parse(stored) as { count?: number; startedAt?: number })
        : null;
      if (
        recovery &&
        typeof recovery.startedAt === "number" &&
        now - recovery.startedAt < RETRY_WINDOW_MS
      ) {
        retryCount = Math.max(0, Number(recovery.count) || 0);
      }
    } catch {
      retryCount = 0;
    }

    if (retryCount < AUTOMATIC_RETRY_LIMIT) {
      try {
        window.sessionStorage.setItem(
          retryKey,
          JSON.stringify({ count: retryCount + 1, startedAt: now }),
        );
      } catch {
        // La reprise fonctionne aussi quand le stockage privé est indisponible.
      }
      const retryTimer = window.setTimeout(
        unstable_retry,
        700 + retryCount * 900,
      );
      return () => window.clearTimeout(retryTimer);
    }

    const actionsTimer = window.setTimeout(
      () => setShowRecoveryActions(true),
      1_200,
    );
    return () => window.clearTimeout(actionsTimer);
  }, [error, unstable_retry]);

  const retryManually = () => {
    try {
      window.sessionStorage.removeItem(
        `game-route-recovery:${error.digest ?? window.location.pathname}`,
      );
    } catch {
      // Le bouton reste utilisable sans stockage de session.
    }
    setShowRecoveryActions(false);
    unstable_retry();
  };

  return (
    <>
      <GameRouteLoading />
      <div
        aria-live="polite"
        className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-xl rounded-2xl border border-[#176951]/15 bg-white/95 px-4 py-3 text-[#0B302B] shadow-[0_16px_45px_rgba(11,48,43,0.16)] backdrop-blur sm:bottom-5 sm:flex sm:items-center sm:justify-between sm:gap-4"
      >
        <div>
          <p className="text-sm font-black">
            {showRecoveryActions
              ? "Le chargement prend plus de temps que prévu"
              : "Reconnexion en cours…"}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-[#5E746D]">
            Votre partie reste disponible.
          </p>
        </div>
        {showRecoveryActions ? (
          <div className="mt-3 flex gap-2 sm:mt-0">
            <button
              type="button"
              onClick={retryManually}
              className="min-h-10 rounded-xl bg-[#0B302B] px-4 text-xs font-black text-white transition hover:bg-[#174B40]"
            >
              Actualiser
            </button>
            <a
              href="/jeu"
              className="flex min-h-10 items-center justify-center rounded-xl border border-[#C8D7D0] px-4 text-xs font-black text-[#174B40] transition hover:bg-[#F1F6F3]"
            >
              Bureau
            </a>
          </div>
        ) : null}
      </div>
    </>
  );
}
