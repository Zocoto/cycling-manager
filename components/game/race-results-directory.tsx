"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { settleOfficialRaceResultsAction } from "@/app/jeu/resultats/actions";
import { RaceLiveLab } from "@/components/game/race-live-lab";
import { RaceOfficialResults } from "@/components/game/race-official-results";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import {
  RACE_CATEGORY_CODES,
  RACE_CATEGORY_STYLE,
  RACE_PROFILE_LABELS,
  isCurrentTeamRegisteredForRace,
  type RaceCalendarEdition,
  type RaceCalendarStage,
  type RaceCategoryCode,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import {
  RACE_SIMULATION_DEMO_SLUG,
  canSimulateRaceEdition,
  getStageLiveState,
} from "@/lib/game/race-live";
import type {
  OfficialRaceEditionResults,
  OfficialRaceResultsDirectory,
} from "@/lib/game/race-results";

type RaceResultsDirectoryProps = {
  calendar: SeasonRaceCalendar;
  nowIso: string;
  officialResults: OfficialRaceResultsDirectory;
};

type StageEntry = {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
};

type ResultsScope = "team" | "all";

export function RaceResultsDirectory({
  calendar,
  nowIso,
  officialResults,
}: RaceResultsDirectoryProps) {
  const [scope, setScope] = useState<ResultsScope>("team");
  const [selectedCategories, setSelectedCategories] = useState<RaceCategoryCode[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date(nowIso));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const entries = useMemo(
    () =>
      calendar.editions
        .flatMap((edition) => edition.stages.map((stage) => ({ edition, stage })))
        .sort(
          (first, second) =>
            first.stage.dayNumber - second.stage.dayNumber ||
            first.edition.prestigeRank - second.edition.prestigeRank ||
            first.stage.stageNumber - second.stage.stageNumber
        ),
    [calendar.editions]
  );
  const scopeEntries = useMemo(
    () =>
      scope === "all"
        ? entries
        : entries.filter(({ edition }) =>
            isCurrentTeamRegisteredForRace(edition)
          ),
    [entries, scope]
  );
  const visibleEntries = useMemo(
    () =>
      selectedCategories.length === 0
        ? scopeEntries
        : scopeEntries.filter(({ edition }) => selectedCategories.includes(edition.categoryCode)),
    [scopeEntries, selectedCategories]
  );
  const visibleEditions = useMemo(() => {
    const grouped = new Map<string, { edition: RaceCalendarEdition; stages: RaceCalendarStage[] }>();
    for (const entry of visibleEntries) {
      const current = grouped.get(entry.edition.id) ?? { edition: entry.edition, stages: [] };
      current.stages.push(entry.stage);
      grouped.set(entry.edition.id, current);
    }
    return [...grouped.values()];
  }, [visibleEntries]);
  const selectedEntry = visibleEntries.find(({ stage }) => stage.id === selectedStageId) ?? null;
  const liveCount = scopeEntries.filter(({ stage }) => getStageLiveState(stage, now).status === "live").length;
  const finishedCount = scopeEntries.filter(({ stage }) => getStageLiveState(stage, now).status === "finished").length;

  function toggleCategory(category: RaceCategoryCode) {
    setSelectedStageId(null);
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category]
    );
  }

  return (
    <div>
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.12)]">
        <div className="bg-[linear-gradient(135deg,#071A17,#176951)] px-5 py-6 text-white sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9BE0CA]">
                Saison {calendar.gameYear}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                Répertoire Résultats / Live
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#C1D3CA]">
                Choisissez une course ou une étape. Le direct commence à 20 h, puis son replay et son classement deviennent disponibles.
              </p>
            </div>
            <div className="flex gap-2 text-xs font-black">
              {liveCount > 0 ? (
                <span className="rounded-full bg-[#EF5B65] px-3 py-2 text-white shadow-[0_0_22px_rgba(239,91,101,0.45)]">
                  ● {liveCount} en direct
                </span>
              ) : null}
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[#DCE9E3]">
                {finishedCount} replay{finishedCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="border-b border-[#315B3E]/15 bg-[#F6FAF7] px-5 py-5 sm:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#176951]/15 bg-[#EAF5F0] p-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#176951]">Courses suivies</p>
              <p className="mt-1 text-xs font-semibold text-[#688176]">Vos engagements sont affichés en priorité pour retrouver immédiatement le direct et les résultats.</p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Portée des résultats et directs">
              <button
                type="button"
                onClick={() => {
                  setScope("team");
                  setSelectedStageId(null);
                }}
                aria-pressed={scope === "team"}
                className={`min-h-10 rounded-full border px-4 text-xs font-extrabold uppercase tracking-wider transition ${
                  scope === "team"
                    ? "border-[#176951] bg-[#176951] text-white"
                    : "border-[#176951]/25 bg-white text-[#176951]"
                }`}
              >
                Mon équipe
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope("all");
                  setSelectedStageId(null);
                }}
                aria-pressed={scope === "all"}
                className={`min-h-10 rounded-full border px-4 text-xs font-extrabold uppercase tracking-wider transition ${
                  scope === "all"
                    ? "border-[#0B302B] bg-[#0B302B] text-white"
                    : "border-[#315B3E]/25 bg-white text-[#315B3E]"
                }`}
              >
                Toutes les courses
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#315B3E]">Filtrer le circuit</p>
              <p className="mt-1 text-xs font-semibold text-[#688176]">Affinez la sélection courante par catégorie.</p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Filtres des résultats et directs">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategories([]);
                  setSelectedStageId(null);
                }}
                aria-pressed={selectedCategories.length === 0}
                className={`min-h-10 rounded-full border px-4 text-xs font-extrabold uppercase tracking-wider transition ${
                  selectedCategories.length === 0
                    ? "border-[#0B302B] bg-[#0B302B] text-white"
                    : "border-[#315B3E]/25 bg-white text-[#315B3E]"
                }`}
              >
                Toutes catégories
              </button>
              {RACE_CATEGORY_CODES.map((category) => {
                const style = RACE_CATEGORY_STYLE[category];
                const selected = selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    aria-pressed={selected}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-extrabold uppercase tracking-wider transition hover:-translate-y-0.5"
                    style={{
                      borderColor: style.border,
                      backgroundColor: selected ? style.background : "#FFFFFF",
                      color: selected ? style.foreground : style.border,
                    }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.background }} />
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid max-h-[48rem] gap-3 overflow-y-auto p-4 sm:p-6 lg:grid-cols-2">
          {visibleEditions.map(({ edition, stages }) => (
            <RaceDirectoryCard
              key={edition.id}
              edition={edition}
              stages={stages}
              now={now}
              selectedStageId={selectedStageId}
              onSelect={setSelectedStageId}
            />
          ))}
          {visibleEditions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#315B3E]/25 bg-[#F8FBF9] px-6 py-10 text-center lg:col-span-2">
              <p className="font-black text-[#0B302B]">
                {scope === "team"
                  ? "Votre équipe n’est engagée sur aucune course de cette sélection."
                  : "Aucune course ne correspond à ces catégories."}
              </p>
              <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#688176]">
                {scope === "team"
                  ? "Élargissez le répertoire pour consulter les autres directs, replays et classements de la saison."
                  : "Réinitialisez les catégories pour retrouver tout le répertoire."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategories([]);
                  if (scope === "team") setScope("all");
                }}
                className="mt-4 min-h-10 rounded-full bg-[#0B302B] px-5 text-xs font-extrabold uppercase tracking-wider text-white"
              >
                {scope === "team" ? "Voir toutes les courses" : "Réinitialiser les catégories"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-8" id="course-live">
        {selectedEntry ? (
          <SelectedRaceExperience
            key={`${selectedEntry.stage.id}-${Boolean(officialResults[selectedEntry.edition.id]?.stages.some((stage) => stage.stageId === selectedEntry.stage.id))}`}
            entry={selectedEntry}
            now={now}
            nowIso={nowIso}
            officialResults={officialResults[selectedEntry.edition.id] ?? null}
          />
        ) : (
          <div className="rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white/55 px-6 py-12 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#176951]/10 text-2xl text-[#176951]">▶</span>
            <h2 className="mt-5 text-xl font-black text-[#0B302B]">Sélectionnez une course</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#688176]">
              Une course passée ouvre son replay, une course en cours rejoint le direct et une course à venir affiche clairement son heure de départ.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RaceDirectoryCard({
  edition,
  stages,
  now,
  selectedStageId,
  onSelect,
}: {
  edition: RaceCalendarEdition;
  stages: RaceCalendarStage[];
  now: Date;
  selectedStageId: string | null;
  onSelect: (stageId: string) => void;
}) {
  const style = RACE_CATEGORY_STYLE[edition.categoryCode];

  return (
    <article className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9]">
      <header className="flex items-center gap-3 border-b border-[#315B3E]/10 bg-white px-4 py-3">
        <span
          className="rounded px-2 py-1 text-[9px] font-black uppercase tracking-wider"
          style={{ backgroundColor: style.background, color: style.foreground }}
        >
          {style.shortLabel}
        </span>
        <span className={`fi fi-${edition.countryCode.toLowerCase()} rounded shadow-sm`} aria-label={edition.countryName} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-black text-[#0B302B]">{edition.name}</h3>
        <span className="rounded-full bg-[#176951]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#176951]">
          {edition.slug === RACE_SIMULATION_DEMO_SLUG && edition.engagedRiderCount === 0
            ? "Démo"
            : `${edition.engagedRiderCount} engagé${edition.engagedRiderCount > 1 ? "s" : ""}`}
        </span>
      </header>
      <div className="divide-y divide-[#315B3E]/10">
        {stages.map((stage) => {
          const state = getStageLiveState(stage, now);
          const selected = selectedStageId === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => {
                onSelect(stage.id);
                window.setTimeout(() => document.getElementById("course-live")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
              }}
              aria-pressed={selected}
              className={`grid w-full gap-3 px-4 py-4 text-left transition sm:grid-cols-[minmax(140px,0.72fr)_minmax(180px,1.28fr)] sm:items-center ${
                selected ? "bg-[#E5F4EE] shadow-[inset_4px_0_0_#176951]" : "hover:bg-white"
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#688176]">
                    J{stage.dayNumber}{edition.raceFormat === "stage_race" ? ` · E${stage.stageNumber}` : ""}
                  </span>
                  <LiveStateBadge
                    status={state.status}
                    simulationAvailable={canSimulateRaceEdition(edition)}
                  />
                </span>
                <span className="mt-1 block truncate text-xs font-black text-[#0B302B]">
                  {edition.raceFormat === "stage_race" ? stage.name : RACE_PROFILE_LABELS[stage.profileType]}
                </span>
                <span className="mt-1 block text-[10px] font-semibold text-[#789087]">
                  {stage.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km · {state.durationMinutes} min de live
                </span>
              </span>
              <RaceStageProfile segments={stage.segments} compact />
            </button>
          );
        })}
      </div>
    </article>
  );
}

function SelectedRaceExperience({
  entry,
  now,
  nowIso,
  officialResults,
}: {
  entry: StageEntry;
  now: Date;
  nowIso: string;
  officialResults: OfficialRaceEditionResults | null;
}) {
  const state = getStageLiveState(entry.stage, now);
  const simulationAvailable = canSimulateRaceEdition(
    entry.edition
  );
  const router = useRouter();
  const settlementStartedRef = useRef(false);
  const [isSettlementPending, startSettlementTransition] = useTransition();
  const resultAvailable = Boolean(
    officialResults?.stages.some((stage) => stage.stageId === entry.stage.id)
  );
  const [view, setView] = useState<"live" | "results">(
    state.status === "finished" && resultAvailable ? "results" : "live"
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
        console.error("Impossible d’actualiser les résultats officiels :", error);
        settlementStartedRef.current = false;
      }
    });
  }, [resultAvailable, router, simulationAvailable, state.status]);

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
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#72D4B7]">Live programmé</p>
            <h2 className="mt-3 text-3xl font-black">{entry.edition.name}</h2>
            <p className="mt-2 text-sm font-semibold text-[#AFC6BB]">
              {entry.edition.raceFormat === "stage_race" ? `Étape ${entry.stage.stageNumber} · ` : ""}
              {entry.stage.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km
            </p>
            <div className="mt-6">
              <RaceStageProfile segments={entry.stage.segments} tone="dark" showLegend />
            </div>
          </div>
          <div className="rounded-2xl border border-[#F2C94C]/30 bg-[#F2C94C]/10 p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F2C94C]">Le direct n’a pas encore commencé</p>
            <p className="mt-3 text-2xl font-black">Départ à {state.startsAt ? formatParisTime(state.startsAt) : "20 h"}</p>
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
      <nav className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-[#315B3E]/15 bg-white p-2 shadow-sm" aria-label="Live et résultats officiels">
        <button
          type="button"
          onClick={() => setView("live")}
          aria-pressed={view === "live"}
          className={`min-h-11 rounded-xl px-5 text-sm font-black transition ${view === "live" ? "bg-[#0B302B] text-white" : "text-[#315B3E] hover:bg-[#EAF5F0]"}`}
        >
          {state.status === "live" ? "● Course en direct" : "▶ Replay du live"}
        </button>
        <button
          type="button"
          onClick={() => resultAvailable && setView("results")}
          disabled={!resultAvailable}
          aria-pressed={view === "results"}
          className={`min-h-11 rounded-xl px-5 text-sm font-black transition ${view === "results" ? "bg-[#176951] text-white" : resultAvailable ? "text-[#176951] hover:bg-[#EAF5F0]" : "cursor-wait text-[#7E938A] opacity-70"}`}
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
          mode={state.status === "live" ? "live" : "replay"}
          nowIso={state.status === "live" ? now.toISOString() : nowIso}
        />
      )}
    </div>
  );
}

function LiveStateBadge({
  status,
  simulationAvailable,
}: {
  status: ReturnType<typeof getStageLiveState>["status"];
  simulationAvailable: boolean;
}) {
  if (!simulationAvailable) {
    return (
      <span className="rounded-full bg-[#60756E]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#60756E]">
        Sans engagés
      </span>
    );
  }

  const style = {
    live: "bg-[#EF5B65] text-white shadow-[0_0_14px_rgba(239,91,101,0.32)]",
    finished: "bg-[#176951]/10 text-[#176951]",
    scheduled: "bg-[#F2C94C]/25 text-[#705A08]",
    cancelled: "bg-red-100 text-red-800",
  }[status];
  const label = {
    live: "● Live",
    finished: "Replay",
    scheduled: "20 h",
    cancelled: "Annulée",
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${style}`}>{label}</span>;
}

function formatParisTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
