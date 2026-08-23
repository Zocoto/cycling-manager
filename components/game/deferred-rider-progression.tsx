"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";

import { loadRiderProgressionAction } from "@/app/jeu/coureurs/actions";
import type { RiderProgressionHistory } from "@/lib/game/rider-progression";

const CompactRiderProgression = dynamic(
  () =>
    import("@/components/game/rider-progression-chart").then(
      (module) => module.CompactRiderProgression,
    ),
  { loading: () => <ProgressionLoading /> },
);

export function DeferredRiderProgression({
  riderId,
  detailHref,
}: {
  riderId: string;
  detailHref: string;
}) {
  const panelId = useId();
  const [history, setHistory] = useState<RiderProgressionHistory | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openProgression() {
    setError(null);
    setIsOpen(true);

    if (history) return;

    setIsLoading(true);
    try {
      const loadedHistory = await loadRiderProgressionAction(riderId);
      if (!loadedHistory) {
        setIsOpen(false);
        setError("Ce graphe n’est pas disponible pour ce coureur.");
        return;
      }
      setHistory(loadedHistory);
    } catch {
      setIsOpen(false);
      setError(
        "Impossible de charger le graphe pour le moment. Réessayez dans quelques instants.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (isOpen) {
    return (
      <div
        id={panelId}
        className="mt-4 min-w-0 max-w-full overflow-x-clip sm:mt-5"
        aria-live="polite"
      >
        {history ? (
          <CompactRiderProgression
            history={history}
            detailHref={detailHref}
            onCollapse={() => setIsOpen(false)}
          />
        ) : (
          <ProgressionLoading />
        )}
      </div>
    );
  }

  return (
    <section className="mt-4 min-w-0 max-w-full overflow-x-clip rounded-2xl border border-[#315B3E]/15 bg-white px-4 py-3 shadow-[0_12px_34px_rgba(19,60,46,0.07)] sm:mt-5 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-black text-[#183F37] sm:text-lg">
            Progression
          </h3>
          <p className="mt-0.5 max-w-xl text-xs font-semibold leading-5 text-[#60756E]">
            Évolution des caractéristiques pendant la saison
          </p>
        </div>
        <button
          type="button"
          aria-controls={panelId}
          aria-expanded={false}
          disabled={isLoading}
          onClick={openProgression}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#E8F7F1] px-3 py-2 text-[10px] font-black text-[#176951] transition hover:bg-[#D7EEE8] disabled:cursor-wait disabled:opacity-65 sm:px-4 sm:text-xs"
        >
          {history ? "Réafficher" : "Afficher le graphe"}
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-[#B94A48]/20 bg-[#FFF1F0] px-4 py-3 text-xs font-bold text-[#8B2E2C]"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

function ProgressionLoading() {
  return (
    <section className="mt-4 min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white p-4 shadow-[0_12px_34px_rgba(19,60,46,0.07)] sm:mt-5 sm:p-6">
      <p className="text-base font-black text-[#183F37] sm:text-lg">
        Chargement de la progression…
      </p>
      <div className="mt-4 h-32 animate-pulse rounded-2xl bg-[#E7F0EB] sm:h-48" />
    </section>
  );
}
