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
        className="min-w-0 max-w-full overflow-x-clip"
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
    <section className="mt-7 min-w-0 max-w-full overflow-x-clip border-t border-[#315B3E]/12 pt-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Évolution
          </p>
          <h3 className="mt-1 text-lg font-black text-[#183F37] sm:text-xl">
            Progression cette saison
          </h3>
          <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-[#60756E]">
            Le graphe est chargé uniquement lorsque vous souhaitez le consulter.
          </p>
        </div>
        <button
          type="button"
          aria-controls={panelId}
          aria-expanded={false}
          disabled={isLoading}
          onClick={openProgression}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#176951] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#0F5743] disabled:cursor-wait disabled:opacity-65 sm:w-auto"
        >
          {history ? "Réafficher le graphe" : "Afficher le graphe"}
          <span aria-hidden="true">↘</span>
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
    <section className="mt-7 min-w-0 max-w-full overflow-hidden border-t border-[#315B3E]/12 pt-6">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
        Évolution
      </p>
      <p className="mt-1 text-lg font-black text-[#183F37] sm:text-xl">
        Chargement de la progression…
      </p>
      <div className="mt-5 h-32 animate-pulse rounded-2xl bg-[#E7F0EB] sm:h-48" />
    </section>
  );
}
