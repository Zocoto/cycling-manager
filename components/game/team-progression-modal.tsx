"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ProgressionSeasonFilters,
  ProgressionStatFilters,
  RiderProgressionChart,
  useProgressionSelection,
} from "@/components/game/rider-progression-chart";
import type { RiderProgressionHistory } from "@/lib/game/rider-progression";

export type ProgressionRosterRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  age: number;
};

export function TeamProgressionModal({
  riders,
  histories,
  initiallyOpen = false,
  initialRiderId,
}: {
  riders: readonly ProgressionRosterRider[];
  histories: readonly RiderProgressionHistory[];
  initiallyOpen?: boolean;
  initialRiderId?: string;
}) {
  const fallbackRiderId = riders[0]?.id ?? "";
  const resolvedInitialRiderId = riders.some(
    (rider) => rider.id === initialRiderId,
  )
    ? initialRiderId!
    : fallbackRiderId;
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [selectedRiderId, setSelectedRiderId] = useState(
    resolvedInitialRiderId,
  );
  const [selectedSeasonIds, setSelectedSeasonIds] = useState<string[]>([]);
  const { selectedStats, setSelectedStats } = useProgressionSelection();
  const historyByRiderId = useMemo(
    () => new Map(histories.map((history) => [history.riderId, history])),
    [histories],
  );
  const selectedRider =
    riders.find((rider) => rider.id === selectedRiderId) ?? riders[0];
  const selectedHistory = selectedRider
    ? historyByRiderId.get(selectedRider.id)
    : undefined;
  const visibleSeasons = (selectedHistory?.seasons ?? []).filter(
    (season) =>
      season.isCurrent || selectedSeasonIds.includes(season.seasonId),
  );

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const chooseRider = (riderId: string) => {
    setSelectedRiderId(riderId);
    setSelectedSeasonIds([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-white/18 bg-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
      >
        <TrendIcon />
        Progression
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#071A17]/78 p-2 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-progression-title"
            className="flex max-h-[calc(100vh-1rem)] w-full max-w-[1560px] flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[#F5FAF7] shadow-[0_35px_100px_rgba(0,0,0,0.38)] sm:max-h-[calc(100vh-2.5rem)]"
          >
            <header className="flex shrink-0 items-start justify-between gap-5 bg-[linear-gradient(120deg,#071A17,#176951)] px-5 py-5 text-white sm:px-7 sm:py-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
                  Monitoring de l’effectif
                </p>
                <h2
                  id="team-progression-title"
                  className="mt-1 text-2xl font-black sm:text-3xl"
                >
                  Progression des coureurs
                </h2>
                <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-[#D6DFD2] sm:text-sm">
                  Comparez les notes au fil des journées. Les anciennes saisons
                  ne s’affichent que lorsque vous les activez.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer la progression"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xl font-light transition hover:bg-white/20"
              >
                ×
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-4 xl:grid-cols-[230px_190px_minmax(0,1fr)]">
                <aside className="rounded-2xl border border-[#315B3E]/12 bg-white p-3">
                  <p className="px-2 pb-3 text-[10px] font-black uppercase tracking-[0.17em] text-[#278B70]">
                    Coureurs
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 xl:max-h-[620px] xl:flex-col xl:overflow-y-auto xl:overflow-x-hidden">
                    {riders.map((rider) => {
                      const isSelected = rider.id === selectedRider?.id;
                      return (
                        <button
                          key={rider.id}
                          type="button"
                          onClick={() => chooseRider(rider.id)}
                          aria-pressed={isSelected}
                          className={`flex min-w-[205px] items-center gap-3 rounded-xl border px-3 py-3 text-left transition xl:min-w-0 ${
                            isSelected
                              ? "border-[#176951]/25 bg-[#D7EEE8] shadow-sm"
                              : "border-transparent bg-[#F7FAF8] hover:border-[#176951]/18"
                          }`}
                        >
                          <span
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black ${
                              isSelected
                                ? "bg-[#176951] text-white"
                                : "bg-[#E2ECE8] text-[#48665F]"
                            }`}
                            aria-hidden="true"
                          >
                            {getInitials(rider.firstName, rider.lastName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-black text-[#183F37]">
                              {rider.firstName} {rider.lastName}
                            </span>
                            <span className="mt-1 flex items-center gap-2 text-[10px] font-bold text-[#60756E]">
                              <span
                                className={`fi fi-${rider.countryCode.toLowerCase()} rounded-sm`}
                                role="img"
                                aria-label={`Drapeau ${rider.countryCode}`}
                              />
                              {rider.age} ans
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <aside className="rounded-2xl border border-[#315B3E]/12 bg-[#ECF5F1] p-3">
                  <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.17em] text-[#278B70]">
                    Statistiques
                  </p>
                  <ProgressionStatFilters
                    selectedStats={selectedStats}
                    onChange={setSelectedStats}
                  />
                </aside>

                <section className="min-w-0 rounded-2xl border border-[#315B3E]/12 bg-white p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#278B70]">
                        Courbes d’évolution
                      </p>
                      <h3 className="mt-1 text-xl font-black text-[#183F37] sm:text-2xl">
                        {selectedRider
                          ? `${selectedRider.firstName} ${selectedRider.lastName}`
                          : "Aucun coureur"}
                      </h3>
                    </div>
                    {selectedHistory ? (
                      <ProgressionSeasonFilters
                        seasons={selectedHistory.seasons}
                        selectedSeasonIds={selectedSeasonIds}
                        onChange={setSelectedSeasonIds}
                      />
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <RiderProgressionChart
                      seasons={visibleSeasons}
                      selectedStats={selectedStats}
                    />
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function TrendIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 15V5M3 15h14" />
      <path d="m6 12 3-3 2.5 2.5L16 6" />
    </svg>
  );
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
