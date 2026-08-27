"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RaceStageProfile } from "@/components/game/race-stage-profile";
import {
  RACE_DAY_SLOT_CONFIG,
  RACE_STAGE_TYPE_LABELS,
  type RaceCalendarEdition,
  type RaceCalendarStage,
} from "@/lib/game/race-calendar";
import {
  canSimulateRaceEdition,
  getStageLiveState,
} from "@/lib/game/race-live";
import { getFrozenRaceFavoriteRiders } from "@/lib/game/race-favorites";
import {
  buildPersistedGeneralClassification,
  buildPersistedStageRaceStandings,
  type OfficialRaceEditionResults,
  type OfficialRiderResult,
} from "@/lib/game/race-results";
import type { PostRaceInterviewSnapshot } from "@/lib/game/post-race-interview";
import type { LockedOfficialStageSimulation } from "@/lib/game/official-race-simulation";
import type { StageRaceStandings } from "@/lib/game/race-simulation";
import { useSynchronizedRaceClock } from "@/lib/game/use-synchronized-race-clock";
import type { RaceLiveMessage } from "@/services/race-live-chat";

const RaceFavoritesPanel = dynamic(() =>
  import("@/components/game/race-favorites-panel").then(
    (module) => module.RaceFavoritesPanel,
  ),
);
const RaceLiveChat = dynamic(
  () =>
    import("@/components/game/race-live-chat").then(
      (module) => module.RaceLiveChat,
    ),
  { loading: RaceModuleLoading },
);
const RaceLiveLab = dynamic(
  () =>
    import("@/components/game/race-live-lab").then(
      (module) => module.RaceLiveLab,
    ),
  { loading: RaceModuleLoading },
);
const RaceOfficialResults = dynamic(
  () =>
    import("@/components/game/race-official-results").then(
      (module) => module.RaceOfficialResults,
    ),
  { loading: RaceModuleLoading },
);

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
  postRaceInterview,
  replayRequested = false,
  initialClassification,
}: {
  entry: RaceStageEntry;
  nowIso: string;
  officialResults: OfficialRaceEditionResults | null;
  currentDirectorId: string;
  initialMessages: RaceLiveMessage[];
  lockedSimulations: LockedOfficialStageSimulation[];
  postRaceInterview: PostRaceInterviewSnapshot | null;
  replayRequested?: boolean;
  initialClassification?: "general";
}) {
  const now = useSynchronizedRaceClock(nowIso, 15_000);
  const state = getStageLiveState(entry.stage, now);
  const favoriteRiders = getFrozenRaceFavoriteRiders(
    entry.edition,
    lockedSimulations,
    entry.stage.id,
  );
  const simulationAvailable = canSimulateRaceEdition(
    entry.edition
  );
  const router = useRouter();
  const [isRefreshPending, startRefreshTransition] =
    useTransition();
  const [isReplayNavigationPending, setIsReplayNavigationPending] =
    useState(false);
  const resultAvailable = Boolean(
    officialResults?.stages.some(
      (stage) => stage.stageId === entry.stage.id
    )
  );
  const selectedSimulationAvailable = lockedSimulations.some(
    (simulation) => simulation.stageId === entry.stage.id,
  );
  const waitingForResults =
    state.status === "finished" && !resultAvailable;
  const waitingForSimulation =
    (state.status === "live" ||
      (state.status === "finished" && replayRequested)) &&
    !selectedSimulationAvailable;
  const [view, setView] = useState<"live" | "results">(
    state.status === "finished" && resultAvailable && !replayRequested
      ? "results"
      : "live"
  );
  const replayHref = `/jeu/resultats/${encodeURIComponent(entry.edition.slug)}/${entry.stage.stageNumber}?replay=1`;
  const officialStandings = buildOfficialStandings(
    entry,
    officialResults,
    entry.stage.stageNumber,
  );
  const officialStandingsBeforeStage = buildOfficialStandings(
    entry,
    officialResults,
    entry.stage.stageNumber - 1,
  );

  useEffect(() => {
    if (!simulationAvailable || (!waitingForResults && !waitingForSimulation)) {
      return;
    }

    const refreshTimer = window.setInterval(() => {
      startRefreshTransition(() => router.refresh());
    }, waitingForSimulation ? 15_000 : 5_000);

    return () => window.clearInterval(refreshTimer);
  }, [
    router,
    simulationAvailable,
    waitingForResults,
    waitingForSimulation,
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
              {RACE_STAGE_TYPE_LABELS[entry.stage.stageType]} ·{" "}
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
        <div className="px-6 pb-6 sm:px-9 sm:pb-9">
          <RaceFavoritesPanel
            edition={entry.edition}
            stage={entry.stage}
            riders={favoriteRiders}
            frozen
            tone="dark"
          />
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

  if (waitingForResults || waitingForSimulation) {
    const isResultsPreparation = waitingForResults;
    return (
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-sm">
        <div className="grid gap-7 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
              {isResultsPreparation
                ? "Arrivée franchie"
                : state.status === "live"
                  ? "Départ donné"
                  : "Replay demandé"}
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#0B302B] sm:text-3xl">
              {isResultsPreparation
                ? "Le classement se met en place"
                : state.status === "live"
                  ? "Le direct se prépare"
                  : "Le replay se prépare"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#5E746D]">
              {isResultsPreparation
                ? "La page reste disponible pendant l’homologation. Le classement apparaîtra automatiquement dès qu’il sera prêt."
                : "Le scénario officiel est préparé en arrière-plan, sans mobiliser cette page. Il apparaîtra automatiquement dès qu’il sera prêt."}
            </p>
            <div className="mt-6">
              <RaceStageProfile
                segments={entry.stage.segments}
                tone="light"
                showLegend
              />
            </div>
          </div>
          <div
            role="status"
            className="rounded-2xl border border-[#176951]/15 bg-[#EAF5F0] p-6 text-[#0B302B]"
          >
            <div className="h-2 overflow-hidden rounded-full bg-[#176951]/10">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#278B70]" />
            </div>
            <p className="mt-4 text-sm font-black">
              {isRefreshPending
                ? "Vérification en cours…"
                : "Actualisation automatique…"}
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#5E746D]">
              Vous pouvez continuer à naviguer : aucun rechargement manuel
              n’est nécessaire.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#315B3E]/15 bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#397A67]">
            Format de l’épreuve
          </p>
          <p className="mt-1 text-sm font-black text-[#0B302B]">
            {RACE_STAGE_TYPE_LABELS[entry.stage.stageType]}
          </p>
        </div>
        <span className="rounded-full bg-[#EAF5F0] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#176951]">
          {entry.stage.distanceKm.toLocaleString("fr-FR", {
            maximumFractionDigits: 1,
          })} km
        </span>
      </div>
      <nav
        className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-[#315B3E]/15 bg-white p-2 shadow-sm"
        aria-label="Live et résultats officiels"
      >
        {state.status === "finished" && resultAvailable && !replayRequested ? (
          <Link
            href={replayHref}
            prefetch={false}
            onClick={() => setIsReplayNavigationPending(true)}
            aria-label="Ouvrir le replay du live"
            className="inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-black text-[#315B3E] transition hover:bg-[#EAF5F0]"
          >
            {isReplayNavigationPending
              ? "Ouverture du replay…"
              : "▶ Replay du live"}
          </Link>
        ) : (
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
        )}
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
            : isRefreshPending
              ? "Consolidation du classement…"
              : "Résultats après l’arrivée"}
        </button>
      </nav>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0">
          {view === "results" && officialResults ? (
            <RaceOfficialResults
              edition={entry.edition}
              selectedStageId={entry.stage.id}
              officialResults={officialResults}
              postRaceInterview={postRaceInterview}
              initialClassification={initialClassification}
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
              standingsOverride={officialStandings}
              standingsBeforeStageOverride={officialStandingsBeforeStage}
            />
          )}
        </div>

        <RaceLiveChat
          key={entry.stage.id}
          stageId={entry.stage.id}
          raceEditionId={entry.edition.id}
          currentDirectorId={currentDirectorId}
          initialMessages={initialMessages}
          mode={state.status === "live" ? "live" : "replay"}
        />
      </div>
    </div>
  );
}

function buildOfficialStandings(
  entry: RaceStageEntry,
  officialResults: OfficialRaceEditionResults | null,
  throughStageNumber: number,
): StageRaceStandings | null {
  if (
    entry.edition.raceFormat !== "stage_race" ||
    !officialResults ||
    throughStageNumber < 1
  ) {
    return null;
  }

  const stageResults = officialResults.stages
    .filter((stage) => stage.stageNumber <= throughStageNumber)
    .sort((first, second) => first.stageNumber - second.stageNumber)
    .map((stage) => stage.results);
  if (stageResults.length === 0) return null;

  const secondary = buildPersistedStageRaceStandings(
    stageResults,
    new Map(entry.edition.engagedRiders.map((rider) => [rider.id, rider.age])),
  );
  const general = buildPersistedGeneralClassification(
    stageResults.map((stage) => stage.map(toPersistedGeneralResult)),
  )
    .filter(
      (result) =>
        result.status === "finished" && result.elapsedTimeMs !== null,
    )
    .map((result) => ({
      riderId: result.riderId,
      elapsedTimeSeconds: Math.round((result.elapsedTimeMs ?? 0) / 1_000),
    }));

  return { general, ...secondary };
}

function toPersistedGeneralResult(result: OfficialRiderResult) {
  return {
    riderId: result.riderId,
    riderName: result.riderName,
    teamId: result.teamId,
    teamProfileId: result.teamProfileId,
    teamName: result.teamName,
    rank: result.rank,
    status: result.status,
    elapsedTimeMs: result.elapsedTimeMs,
    timeBonusSeconds: result.timeBonusSeconds,
    timePenaltySeconds: result.timePenaltySeconds,
    abandonmentReason: result.abandonmentReason,
  };
}

function RaceModuleLoading() {
  return (
    <div
      role="status"
      className="min-h-40 animate-pulse rounded-2xl border border-[#315B3E]/15 bg-[#F3F8F5]"
    >
      <span className="sr-only">Chargement de la course…</span>
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
