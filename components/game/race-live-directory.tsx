"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "@/components/ui/app-link";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import {
  RACE_CATEGORY_CODES,
  RACE_CATEGORY_STYLE,
  RACE_DAY_SLOT_CONFIG,
  RACE_PROFILE_LABELS,
  compareRaceDaySlots,
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

type ResultsScope = "team" | "all";

export function RaceLiveDirectory({
  calendar,
  nowIso,
}: {
  calendar: SeasonRaceCalendar;
  nowIso: string;
}) {
  const [scope, setScope] = useState<ResultsScope>("team");
  const [selectedCategories, setSelectedCategories] = useState<
    RaceCategoryCode[]
  >([]);
  const [now, setNow] = useState(() => new Date(nowIso));

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      15_000
    );
    return () => window.clearInterval(timer);
  }, []);

  const entries = useMemo(
    () =>
      calendar.editions
        .filter(
          (edition) =>
            edition.competitionType === "standard" ||
            edition.engagedRiderCount > 0
        )
        .flatMap((edition) =>
          edition.stages.map((stage) => ({
            edition,
            stage,
          }))
        )
        .sort(
          (first, second) =>
            first.stage.dayNumber - second.stage.dayNumber ||
            compareRaceDaySlots(
              first.stage.daySlot,
              second.stage.daySlot
            ) ||
            first.edition.prestigeRank -
              second.edition.prestigeRank ||
            first.stage.stageNumber -
              second.stage.stageNumber
        ),
    [calendar.editions]
  );
  const scopeEntries =
    scope === "all"
      ? entries
      : entries.filter(({ edition }) =>
          isCurrentTeamRegisteredForRace(edition)
        );
  const visibleEntries =
    selectedCategories.length === 0
      ? scopeEntries
      : scopeEntries.filter(({ edition }) =>
          selectedCategories.includes(edition.categoryCode)
        );
  const visibleEditions = useMemo(() => {
    const grouped = new Map<
      string,
      {
        edition: RaceCalendarEdition;
        stages: RaceCalendarStage[];
      }
    >();
    for (const entry of visibleEntries) {
      const current = grouped.get(entry.edition.id) ?? {
        edition: entry.edition,
        stages: [],
      };
      current.stages.push(entry.stage);
      grouped.set(entry.edition.id, current);
    }
    return [...grouped.values()];
  }, [visibleEntries]);
  const liveCount = scopeEntries.filter(
    ({ stage }) =>
      getStageLiveState(stage, now).status === "live"
  ).length;
  const finishedCount = scopeEntries.filter(
    ({ stage }) =>
      getStageLiveState(stage, now).status === "finished"
  ).length;

  function toggleCategory(category: RaceCategoryCode) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category]
    );
  }

  return (
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
              Chaque course s’ouvre désormais dans son propre espace : seuls son live, sa startlist, son chat et ses résultats sont chargés.
            </p>
          </div>
          <div className="flex gap-2 text-xs font-black">
            {liveCount > 0 ? (
              <span className="rounded-full bg-[#EF5B65] px-3 py-2 text-white shadow-[0_0_22px_rgba(239,91,101,0.45)]">
                ● {liveCount} en direct
              </span>
            ) : null}
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[#DCE9E3]">
              {finishedCount} replay
              {finishedCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-[#315B3E]/15 bg-[#F6FAF7] px-5 py-5 sm:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#176951]/15 bg-[#EAF5F0] p-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#176951]">
              Courses suivies
            </p>
            <p className="mt-1 text-xs font-semibold text-[#688176]">
              Vos engagements restent affichés en priorité.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            aria-label="Portée des résultats et directs"
          >
            {(["team", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                aria-pressed={scope === value}
                className={`min-h-10 rounded-full border px-4 text-xs font-extrabold uppercase tracking-wider transition ${
                  scope === value
                    ? "border-[#0B302B] bg-[#0B302B] text-white"
                    : "border-[#315B3E]/25 bg-white text-[#315B3E]"
                }`}
              >
                {value === "team"
                  ? "Mon équipe"
                  : "Toutes les courses"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#315B3E]">
              Filtrer le circuit
            </p>
            <p className="mt-1 text-xs font-semibold text-[#688176]">
              Affinez la sélection par catégorie.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            aria-label="Filtres des résultats et directs"
          >
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
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
              const selected =
                selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-pressed={selected}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-extrabold uppercase tracking-wider transition hover:-translate-y-0.5"
                  style={{
                    borderColor: style.border,
                    backgroundColor: selected
                      ? style.background
                      : "#FFFFFF",
                    color: selected
                      ? style.foreground
                      : style.border,
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: style.background,
                    }}
                  />
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
          />
        ))}
        {visibleEditions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#315B3E]/25 bg-[#F8FBF9] px-6 py-10 text-center lg:col-span-2">
            <p className="font-black text-[#0B302B]">
              {scope === "team"
                ? "Votre équipe n’est engagée sur aucune course de cette sélection."
                : "Aucune course ne correspond à ces catégories."}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategories([]);
                if (scope === "team") setScope("all");
              }}
              className="mt-4 min-h-10 rounded-full bg-[#0B302B] px-5 text-xs font-extrabold uppercase tracking-wider text-white"
            >
              {scope === "team"
                ? "Voir toutes les courses"
                : "Réinitialiser les catégories"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RaceDirectoryCard({
  edition,
  stages,
  now,
}: {
  edition: RaceCalendarEdition;
  stages: RaceCalendarStage[];
  now: Date;
}) {
  const style = RACE_CATEGORY_STYLE[edition.categoryCode];

  return (
    <article className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9]">
      <header className="flex items-center gap-3 border-b border-[#315B3E]/10 bg-white px-4 py-3">
        <span
          className="rounded px-2 py-1 text-[9px] font-black uppercase tracking-wider"
          style={{
            backgroundColor: style.background,
            color: style.foreground,
          }}
        >
          {style.shortLabel}
        </span>
        <span
          className={`fi fi-${edition.countryCode.toLowerCase()} rounded shadow-sm`}
          aria-label={edition.countryName}
        />
        <h3 className="min-w-0 flex-1 truncate text-sm font-black text-[#0B302B]">
          {edition.name}
        </h3>
        <span className="rounded-full bg-[#176951]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#176951]">
          {edition.slug === RACE_SIMULATION_DEMO_SLUG &&
          edition.engagedRiderCount === 0
            ? "Démo"
            : `${edition.engagedRiderCount} engagé${edition.engagedRiderCount > 1 ? "s" : ""}`}
        </span>
      </header>
      <div className="divide-y divide-[#315B3E]/10">
        {stages.map((stage) => {
          const state = getStageLiveState(stage, now);
          return (
            <Link
              key={stage.id}
              href={`/jeu/resultats/${edition.slug}/${stage.stageNumber}`}
              prefetch={false}
              className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-white sm:grid-cols-[minmax(140px,0.72fr)_minmax(180px,1.28fr)] sm:items-center"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#688176]">
                    J{stage.dayNumber} ·{" "}
                    {
                      RACE_DAY_SLOT_CONFIG[stage.daySlot]
                        .shortLabel
                    }
                    {edition.raceFormat === "stage_race"
                      ? ` · E${stage.stageNumber}`
                      : ""}
                  </span>
                  <LiveStateBadge
                    status={state.status}
                    simulationAvailable={canSimulateRaceEdition(
                      edition
                    )}
                    scheduledLabel={
                      RACE_DAY_SLOT_CONFIG[stage.daySlot]
                        .shortLabel
                    }
                  />
                </span>
                <span className="mt-1 block truncate text-xs font-black text-[#0B302B]">
                  {edition.raceFormat === "stage_race"
                    ? stage.name
                    : RACE_PROFILE_LABELS[stage.profileType]}
                </span>
                <span className="mt-1 block text-[10px] font-semibold text-[#789087]">
                  {stage.distanceKm.toLocaleString("fr-FR", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  km · {state.durationMinutes} min de live
                </span>
              </span>
              <RaceStageProfile
                segments={stage.segments}
                compact
              />
            </Link>
          );
        })}
      </div>
    </article>
  );
}

function LiveStateBadge({
  status,
  simulationAvailable,
  scheduledLabel,
}: {
  status: ReturnType<typeof getStageLiveState>["status"];
  simulationAvailable: boolean;
  scheduledLabel: string;
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
    scheduled: scheduledLabel,
    cancelled: "Annulée",
  }[status];

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${style}`}
    >
      {label}
    </span>
  );
}
