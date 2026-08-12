"use client";

import { useEffect, useMemo, useState } from "react";

import { RaceStageProfile } from "@/components/game/race-stage-profile";
import Link from "@/components/ui/app-link";
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
  canSimulateRaceEdition,
  getStageLiveState,
} from "@/lib/game/race-live";

export type ResultsScope = "team" | "unridden";

type DirectoryEntry = {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
};

type DirectoryEdition = {
  edition: RaceCalendarEdition;
  stages: RaceCalendarStage[];
};

export function RaceLiveDirectory({
  calendar,
  nowIso,
  initialScope = "team",
}: {
  calendar: SeasonRaceCalendar;
  nowIso: string;
  initialScope?: ResultsScope;
}) {
  const [scope, setScope] = useState<ResultsScope>(initialScope);
  const [selectedCategories, setSelectedCategories] = useState<
    RaceCategoryCode[]
  >([]);
  const [now, setNow] = useState(() => new Date(nowIso));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const entries = useMemo(
    () =>
      calendar.editions
        .filter(
          (edition) =>
            edition.competitionType === "standard" ||
            edition.competitionType === "world_championship" ||
            edition.engagedRiderCount > 0,
        )
        .flatMap((edition) =>
          edition.stages.map((stage) => ({
            edition,
            stage,
          })),
        )
        .sort(
          (first, second) =>
            first.stage.dayNumber - second.stage.dayNumber ||
            compareRaceDaySlots(first.stage.daySlot, second.stage.daySlot) ||
            first.edition.prestigeRank - second.edition.prestigeRank ||
            first.stage.stageNumber - second.stage.stageNumber,
        ),
    [calendar.editions],
  );
  const scopeEntries = entries.filter(({ edition }) =>
    isEditionInResultsScope(edition, scope),
  );
  const visibleEntries =
    selectedCategories.length === 0
      ? scopeEntries
      : scopeEntries.filter(({ edition }) =>
          selectedCategories.includes(edition.categoryCode),
        );
  const currentDayEntries = visibleEntries.filter(
    ({ stage }) => stage.dayNumber === calendar.currentDayNumber,
  );
  const currentEditionIds = new Set(
    currentDayEntries.map(({ edition }) => edition.id),
  );
  const pastEntries = visibleEntries.filter(
    ({ edition, stage }) =>
      stage.dayNumber < calendar.currentDayNumber &&
      !currentEditionIds.has(edition.id),
  );
  const pastEditions = groupEntriesByEdition(pastEntries).reverse();
  const liveCount = currentDayEntries.filter(
    ({ stage }) => getStageLiveState(stage, now).status === "live",
  ).length;
  const replayCount = currentDayEntries.filter(
    ({ stage }) => getStageLiveState(stage, now).status === "finished",
  ).length;

  function toggleCategory(category: RaceCategoryCode) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  }

  return (
    <section className="overflow-visible rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.12)]">
      <div className="overflow-hidden rounded-t-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-5 py-6 text-white sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9BE0CA]">
              Saison {calendar.gameYear} · Jour {calendar.currentDayNumber}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Résultats / Live du jour
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#C1D3CA]">
              Accédez aux directs et aux replays du jour. Les anciennes courses
              restent disponibles dans les archives.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-black">
            {liveCount > 0 ? (
              <span className="rounded-full bg-[#EF5B65] px-3 py-2 text-white shadow-[0_0_22px_rgba(239,91,101,0.45)]">
                ● {liveCount} en direct
              </span>
            ) : null}
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[#DCE9E3]">
              {replayCount} replay{replayCount > 1 ? "s" : ""} aujourd’hui
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-[#315B3E]/15 bg-[#F6FAF7] px-5 py-5 sm:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#176951]/15 bg-[#EAF5F0] p-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#176951]">
              {scope === "team"
                ? "Courses de votre équipe"
                : "Courses non courues"}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#688176]">
              {scope === "team"
                ? "Retrouvez les épreuves auxquelles votre équipe participe et les Mondiaux diffusés à tous."
                : "Suivez en spectateur les autres directs, replays et résultats."}
            </p>
          </div>
          <div
            className="grid w-full grid-cols-2 gap-2 sm:w-auto"
            aria-label="Portée des résultats et directs"
          >
            {(["team", "unridden"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                aria-pressed={scope === value}
                className={`min-h-11 rounded-xl border px-3 text-xs font-extrabold uppercase leading-4 tracking-wider transition sm:rounded-full sm:px-4 ${
                  scope === value
                    ? "border-[#0B302B] bg-[#0B302B] text-white"
                    : "border-[#315B3E]/25 bg-white text-[#315B3E]"
                }`}
              >
                {value === "team" ? "Mon équipe" : "Courses non courues"}
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
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: style.background }}
                  />
                  {style.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-2">
          {currentDayEntries.map(({ edition, stage }) => (
            <StageDirectoryCard
              key={stage.id}
              edition={edition}
              stage={stage}
              now={now}
            />
          ))}
          {currentDayEntries.length === 0 ? (
            <DirectoryEmptyState
              scope={scope}
              hasCategoryFilter={selectedCategories.length > 0}
              onReset={() => {
                setSelectedCategories([]);
                if (scope === "team") setScope("unridden");
              }}
            />
          ) : null}
        </div>
      </div>

      {pastEditions.length > 0 ? (
        <details className="group/archive border-t border-[#315B3E]/15 bg-[#F6FAF7] last:rounded-b-[2rem]">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none sm:px-8 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-xs font-extrabold uppercase tracking-[0.18em] text-[#315B3E]">
                Courses passées
              </span>
              <span className="mt-1 block text-xs font-semibold text-[#688176]">
                Retrouvez les résultats et replays des jours précédents.
              </span>
            </span>
            <span className="inline-flex items-center gap-3">
              <span className="rounded-full bg-[#176951]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#176951]">
                {pastEditions.length} course{pastEditions.length > 1 ? "s" : ""}
              </span>
              <span
                aria-hidden="true"
                className="text-xl font-black text-[#176951] transition group-open/archive:rotate-180"
              >
                ⌄
              </span>
            </span>
          </summary>
          <div className="grid gap-3 border-t border-[#315B3E]/10 p-4 sm:p-6 lg:grid-cols-2">
            {pastEditions.map(({ edition, stages }) => (
              <DirectoryCard
                key={edition.id}
                edition={edition}
                stages={stages}
                currentDayNumber={calendar.currentDayNumber}
                now={now}
                period="past"
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function StageDirectoryCard({
  edition,
  stage,
  now,
}: {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  now: Date;
}) {
  const style = RACE_CATEGORY_STYLE[edition.categoryCode];
  const state = getStageLiveState(stage, now);
  const isStageRace = edition.raceFormat === "stage_race";

  return (
    <article
      data-race-period="today"
      data-race-format={isStageRace ? "stage-race" : "one-day"}
      data-stage-number={stage.stageNumber}
      className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-[#315B3E]/10 bg-white px-4 py-3">
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
          className={"fi fi-" + edition.countryCode.toLowerCase() + " rounded shadow-sm"}
          aria-label={edition.countryName}
        />
        <h3 className="min-w-0 flex-1 truncate text-sm font-black text-[#0B302B]">
          {edition.name}
        </h3>
        <LiveStateBadge
          status={state.status}
          simulationAvailable={canSimulateRaceEdition(edition)}
          scheduledLabel={RACE_DAY_SLOT_CONFIG[stage.daySlot].shortLabel}
        />
      </div>
      <Link
        href={"/jeu/resultats/" + edition.slug + "/" + stage.stageNumber}
        prefetch={false}
        className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-white sm:grid-cols-[minmax(140px,0.72fr)_minmax(180px,1.28fr)] sm:items-center"
      >
        <span className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#688176]">
            J{stage.dayNumber} {"\u00B7"} {RACE_DAY_SLOT_CONFIG[stage.daySlot].shortLabel}
          </span>
          <span className="mt-1 block truncate text-xs font-black text-[#0B302B]">
            {isStageRace
              ? "E" + stage.stageNumber + " \u00B7 " + stage.name
              : RACE_PROFILE_LABELS[stage.profileType]}
          </span>
          <span className="mt-1 block text-[10px] font-semibold text-[#789087]">
            {isStageRace
              ? RACE_PROFILE_LABELS[stage.profileType] + " \u00B7 "
              : null}
            {formatDistance(stage.distanceKm)} km {"\u00B7"} {state.durationMinutes} min de live
          </span>
        </span>
        <RaceStageProfile segments={stage.segments} compact />
      </Link>
    </article>
  );
}

function DirectoryCard({
  edition,
  stages,
  currentDayNumber,
  now,
  period,
}: {
  edition: RaceCalendarEdition;
  stages: RaceCalendarStage[];
  currentDayNumber: number;
  now: Date;
  period: "today" | "past";
}) {
  if (edition.raceFormat === "stage_race") {
    return (
      <TourDirectoryCard
        edition={edition}
        visibleStages={stages}
        currentDayNumber={currentDayNumber}
        now={now}
        period={period}
      />
    );
  }

  const stage = stages[stages.length - 1];
  if (!stage) {
    return null;
  }

  return (
    <OneDayDirectoryCard
      edition={edition}
      stage={stage}
      now={now}
      period={period}
    />
  );
}

function TourDirectoryCard({
  edition,
  visibleStages,
  currentDayNumber,
  now,
  period,
}: {
  edition: RaceCalendarEdition;
  visibleStages: RaceCalendarStage[];
  currentDayNumber: number;
  now: Date;
  period: "today" | "past";
}) {
  const style = RACE_CATEGORY_STYLE[edition.categoryCode];
  const anchorStage = [...visibleStages].sort(
    (first, second) => second.stageNumber - first.stageNumber,
  )[0];
  const availableStages = edition.stages.filter(
    (stage) => stage.dayNumber <= currentDayNumber,
  );
  const futureStageCount = edition.stages.length - availableStages.length;
  const state = anchorStage ? getStageLiveState(anchorStage, now) : null;

  return (
    <article
      data-race-period={period}
      data-race-format="stage-race"
      className="relative rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] shadow-sm"
    >
      <div className="flex items-center gap-3 rounded-t-2xl border-b border-[#315B3E]/10 bg-white px-4 py-3">
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
        <span className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#688176]">
          Tour · {edition.stages.length} étapes
        </span>
        {state ? (
          <LiveStateBadge
            status={state.status}
            simulationAvailable={canSimulateRaceEdition(edition)}
            scheduledLabel={RACE_DAY_SLOT_CONFIG[anchorStage.daySlot].shortLabel}
          />
        ) : null}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(180px,1.1fr)] sm:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
            {period === "today" && anchorStage
              ? `Étape du jour · E${anchorStage.stageNumber}`
              : anchorStage
                ? `Dernier replay · E${anchorStage.stageNumber}`
                : "Épreuve par étapes"}
          </p>
          <h3 className="mt-1 truncate text-base font-black text-[#0B302B]">
            {edition.name}
          </h3>
          {anchorStage ? (
            <>
              <p className="mt-1 truncate text-xs font-bold text-[#48665F]">
                {anchorStage.name}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-[#789087]">
                {RACE_PROFILE_LABELS[anchorStage.profileType]} ·{" "}
                {formatDistance(anchorStage.distanceKm)} km
              </p>
            </>
          ) : null}
          <Link
            href={`/jeu/resultats/${edition.slug}`}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#0B302B] px-4 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-[#176951]"
          >
            Ouvrir le tour →
          </Link>
        </div>
        {anchorStage ? (
          <RaceStageProfile segments={anchorStage.segments} compact />
        ) : null}
      </div>

      <StageSummaryPopover
        edition={edition}
        availableStages={availableStages}
        futureStageCount={futureStageCount}
        now={now}
      />
    </article>
  );
}

function StageSummaryPopover({
  edition,
  availableStages,
  futureStageCount,
  now,
}: {
  edition: RaceCalendarEdition;
  availableStages: RaceCalendarStage[];
  futureStageCount: number;
  now: Date;
}) {
  return (
    <details className="group/stages relative border-t border-[#315B3E]/10">
      <summary
        title="Afficher le résumé des étapes"
        className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#176951] marker:content-none [&::-webkit-details-marker]:hidden"
      >
        Résumé des étapes
        <span aria-hidden="true">ⓘ</span>
      </summary>
      <div className="invisible absolute bottom-10 right-3 z-30 w-[min(23rem,calc(100vw-3rem))] translate-y-1 rounded-2xl border border-[#176951]/20 bg-white p-3 opacity-0 shadow-[0_18px_45px_rgba(11,48,43,0.24)] transition group-hover/stages:visible group-hover/stages:translate-y-0 group-hover/stages:opacity-100 group-focus-within/stages:visible group-focus-within/stages:translate-y-0 group-focus-within/stages:opacity-100 group-open/stages:visible group-open/stages:translate-y-0 group-open/stages:opacity-100">
        <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#315B3E]">
          {edition.name}
        </p>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {availableStages.map((stage) => {
            const state = getStageLiveState(stage, now);
            return (
              <li key={stage.id}>
                <Link
                  href={`/jeu/resultats/${edition.slug}/${stage.stageNumber}`}
                  prefetch={false}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl px-2 py-2 text-left normal-case tracking-normal transition hover:bg-[#EAF5F0]"
                >
                  <span className="rounded-lg bg-[#176951]/10 px-2 py-1 text-[10px] font-black text-[#176951]">
                    E{stage.stageNumber}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black text-[#0B302B]">
                      {stage.name}
                    </span>
                    <span className="block text-[9px] font-bold text-[#789087]">
                      J{stage.dayNumber} ·{" "}
                      {RACE_PROFILE_LABELS[stage.profileType]} ·{" "}
                      {formatDistance(stage.distanceKm)} km
                    </span>
                  </span>
                  <span className="text-[9px] font-black uppercase text-[#176951]">
                    {({ live: "Live", finished: "Replay", scheduled: "À venir", cancelled: "Annulée" } as const)[state.status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {futureStageCount > 0 ? (
          <p className="mt-2 rounded-lg bg-[#F4F8F6] px-3 py-2 text-[9px] font-bold normal-case tracking-normal text-[#688176]">
            {futureStageCount} étape{futureStageCount > 1 ? "s" : ""} à venir
            apparaîtra{futureStageCount > 1 ? "ont" : ""} au fil des jours.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function OneDayDirectoryCard({
  edition,
  stage,
  now,
  period,
}: {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  now: Date;
  period: "today" | "past";
}) {
  const style = RACE_CATEGORY_STYLE[edition.categoryCode];
  const state = getStageLiveState(stage, now);

  return (
    <article
      data-race-period={period}
      data-race-format="one-day"
      className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-[#315B3E]/10 bg-white px-4 py-3">
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
        <LiveStateBadge
          status={state.status}
          simulationAvailable={canSimulateRaceEdition(edition)}
          scheduledLabel={RACE_DAY_SLOT_CONFIG[stage.daySlot].shortLabel}
        />
      </div>
      <Link
        href={`/jeu/resultats/${edition.slug}/${stage.stageNumber}`}
        prefetch={false}
        className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-white sm:grid-cols-[minmax(140px,0.72fr)_minmax(180px,1.28fr)] sm:items-center"
      >
        <span className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#688176]">
            J{stage.dayNumber} · {RACE_DAY_SLOT_CONFIG[stage.daySlot].shortLabel}
          </span>
          <span className="mt-1 block truncate text-xs font-black text-[#0B302B]">
            {RACE_PROFILE_LABELS[stage.profileType]}
          </span>
          <span className="mt-1 block text-[10px] font-semibold text-[#789087]">
            {formatDistance(stage.distanceKm)} km · {state.durationMinutes} min
            de live
          </span>
        </span>
        <RaceStageProfile segments={stage.segments} compact />
      </Link>
    </article>
  );
}

function DirectoryEmptyState({
  scope,
  hasCategoryFilter,
  onReset,
}: {
  scope: ResultsScope;
  hasCategoryFilter: boolean;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#315B3E]/25 bg-[#F8FBF9] px-6 py-10 text-center lg:col-span-2">
      <p className="font-black text-[#0B302B]">
        {scope === "team"
          ? "Votre équipe n’a aucune course aujourd’hui."
          : hasCategoryFilter
            ? "Aucune course du jour ne correspond à ces catégories."
            : "Aucune autre course n’est programmée aujourd’hui."}
      </p>
      {scope === "team" || hasCategoryFilter ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 min-h-10 rounded-full bg-[#0B302B] px-5 text-xs font-extrabold uppercase tracking-wider text-white"
        >
          {scope === "team" ? "Voir les courses non courues" : "Réinitialiser"}
        </button>
      ) : null}
    </div>
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
      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${style}`}
    >
      {label}
    </span>
  );
}

function groupEntriesByEdition(entries: DirectoryEntry[]): DirectoryEdition[] {
  const grouped = new Map<string, DirectoryEdition>();

  for (const entry of entries) {
    const current = grouped.get(entry.edition.id) ?? {
      edition: entry.edition,
      stages: [],
    };
    current.stages.push(entry.stage);
    grouped.set(entry.edition.id, current);
  }

  return [...grouped.values()];
}

export function isEditionInResultsScope(
  edition: RaceCalendarEdition,
  scope: ResultsScope,
) {
  if (edition.competitionType === "world_championship") {
    return true;
  }

  const isRegistered = isCurrentTeamRegisteredForRace(edition);

  return scope === "team" ? isRegistered : !isRegistered;
}

function formatDistance(distanceKm: number) {
  return distanceKm.toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  });
}
