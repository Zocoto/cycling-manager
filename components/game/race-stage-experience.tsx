"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { settleOfficialRaceResultsAction } from "@/app/jeu/resultats/actions";
import { RaceLiveChat } from "@/components/game/race-live-chat";
import { RaceLiveLab } from "@/components/game/race-live-lab";
import { RaceOfficialResults } from "@/components/game/race-official-results";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import {
  RACE_DAY_SLOT_CONFIG,
  type RaceCalendarEdition,
  type RaceCalendarStage,
} from "@/lib/game/race-calendar";
import {
  canSimulateRaceEdition,
  getStageLiveState,
} from "@/lib/game/race-live";
import type { OfficialRaceEditionResults } from "@/lib/game/race-results";
import type { LockedOfficialStageSimulation } from "@/lib/game/official-race-simulation";
import { useSynchronizedRaceClock } from "@/lib/game/use-synchronized-race-clock";
import type { RaceLiveMessage } from "@/services/race-live-chat";

export type RaceStageEntry = {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
};

export function RaceStageExperience({
  entry,
  nowIso,
  officialResults,
  currentDirectorId,
  initialMessages,
  lockedSimulations,
}: {
  entry: RaceStageEntry;
  nowIso: string;
  officialResults: OfficialRaceEditionResults | null;
  currentDirectorId: string;
  initialMessages: RaceLiveMessage[];
  lockedSimulations: LockedOfficialStageSimulation[];
}) {
  const now = useSynchronizedRaceClock(nowIso, 15_000);
  const state = getStageLiveState(entry.stage, now);
  const simulationAvailable = canSimulateRaceEdition(
    entry.edition
  );
  const router = useRouter();
  const settlementStartedRef = useRef(false);
  const [isSettlementPending, startSettlementTransition] =
    useTransition();
  const resultAvailable = Boolean(
    officialResults?.stages.some(
      (stage) => stage.stageId === entry.stage.id
    )
  );
  const [view, setView] = useState<"live" | "results">(
    state.status === "finished" && resultAvailable
      ? "results"
      : "live"
  );

  useEffect(() => {
    if (
      state.status !== "finished" ||
      resultAvailable ||
      !simulationAvailable ||
      settlementStartedRef.current
    ) {
      return;
    }

    settlementStartedRef.current = true;
    startSettlementTransition(async () => {
      try {
        await settleOfficialRaceResultsAction();
        router.refresh();
      } catch (error) {
        console.error(
          "Impossible d’actualiser les résultats officiels :",
          error
        );
        settlementStartedRef.current = false;
      }
    });
  }, [
    resultAvailable,
    router,
    simulationAvailable,
    state.status,
  ]);

  if (!simulationAvailable) {
    return (
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-[#071A17] text-white shadow-[0_30px_80px_rgba(7,26,23,0.2)]">
        <div className="grid gap-7 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)] lg:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#72D4B7]">
              Course sans peloton
            </p>
            <h2 className="mt-3 text-3xl font-black">
              {entry.edition.name}
            </h2>
            <div className="mt-6">
              <RaceStageProfile
                segments={entry.stage.segments}
                tone="dark"
                showLegend
              />
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/[0.055] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F2C94C]">
              Aucune simulation produite
            </p>
            <p className="mt-3 text-xl font-black">
              Aucun coureur n’est engagé sur cette course.
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#C8D7D0]">
              Le moteur ne génère ni live, ni replay, ni classement tant que la liste des engagés est vide.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (state.status === "scheduled") {
    return (
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-[#071A17] text-white shadow-[0_30px_80px_rgba(7,26,23,0.2)]">
        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)] lg:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#72D4B7]">
              Live programmé
            </p>
            <h2 className="mt-3 text-3xl font-black">
              {entry.edition.name}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#AFC6BB]">
              {entry.edition.raceFormat === "stage_race"
                ? `Étape ${entry.stage.stageNumber} · `
                : ""}
              {entry.stage.distanceKm.toLocaleString("fr-FR", {
                maximumFractionDigits: 1,
              })}{" "}
              km
            </p>
            <div className="mt-6">
              <RaceStageProfile
                segments={entry.stage.segments}
                tone="dark"
                showLegend
              />
            </div>
          </div>
          <div className="rounded-2xl border border-[#F2C94C]/30 bg-[#F2C94C]/10 p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F2C94C]">
              Le direct n’a pas encore commencé
            </p>
            <p className="mt-3 text-2xl font-black">
              Départ à{" "}
              {state.startsAt
                ? formatParisTime(state.startsAt)
                : RACE_DAY_SLOT_CONFIG[entry.stage.daySlot]
                    .shortLabel}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#C8D7D0]">
              La diffusion durera environ {state.durationMinutes} minutes. Le replay et le classement seront disponibles après l’arrivée.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (state.status === "cancelled") {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 px-6 py-10 text-center font-bold text-red-900">
        Cette course a été annulée. Aucun live ni classement ne sera produit.
      </div>
    );
  }

  return (
    <div>
      <nav
        className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-[#315B3E]/15 bg-white p-2 shadow-sm"
        aria-label="Live et résultats officiels"
      >
        <button
          type="button"
          onClick={() => setView("live")}
          aria-pressed={view === "live"}
          className={`min-h-11 rounded-xl px-5 text-sm font-black transition ${
            view === "live"
              ? "bg-[#0B302B] text-white"
              : "text-[#315B3E] hover:bg-[#EAF5F0]"
          }`}
        >
          {state.status === "live"
            ? "● Course en direct"
            : "▶ Replay du live"}
        </button>
        <button
          type="button"
          onClick={() =>
            resultAvailable && setView("results")
          }
          disabled={!resultAvailable}
          aria-pressed={view === "results"}
          className={`min-h-11 rounded-xl px-5 text-sm font-black transition ${
            view === "results"
              ? "bg-[#176951] text-white"
              : resultAvailable
                ? "text-[#176951] hover:bg-[#EAF5F0]"
                : "cursor-wait text-[#7E938A] opacity-70"
          }`}
        >
          {resultAvailable
            ? "▤ Résultats officiels"
            : isSettlementPending
              ? "Consolidation du classement…"
              : "Résultats après l’arrivée"}
        </button>
      </nav>

      {view === "results" && officialResults ? (
        <RaceOfficialResults
          edition={entry.edition}
          selectedStageId={entry.stage.id}
          officialResults={officialResults}
        />
      ) : (
        <RaceLiveLab
          key={`${entry.stage.id}-${state.status}`}
          edition={entry.edition}
          stage={entry.stage}
          mode={
            state.status === "live" ? "live" : "replay"
          }
          nowIso={
            state.status === "live"
              ? now.toISOString()
              : nowIso
          }
          lockedSimulations={lockedSimulations}
        />
      )}

      <RaceLiveChat
        stageId={entry.stage.id}
        currentDirectorId={currentDirectorId}
        initialMessages={initialMessages}
      />
    </div>
  );
}

function formatParisTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
