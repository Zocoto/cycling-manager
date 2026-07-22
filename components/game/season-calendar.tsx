"use client";

import Link from "@/components/ui/app-link";
import { useMemo, useState } from "react";

import { RaceStageProfile } from "@/components/game/race-stage-profile";

import {
  RACE_CATEGORY_CODES,
  RACE_CATEGORY_STYLE,
  RACE_DAY_SLOTS,
  RACE_DAY_SLOT_CONFIG,
  RACE_PROFILE_LABELS,
  buildCalendarWeeks,
  compareRaceDaySlots,
  isRaceEditionAvailableToCurrentTeam,
  type CalendarWeek,
  type RaceCalendarEdition,
  type RaceCategoryCode,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

const DEFAULT_VISIBLE_LANES_PER_SLOT = 3;

const shortDateFormatter =
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

type SeasonCalendarProps = {
  calendar: SeasonRaceCalendar;
  reputationPoints: number;
  nowIso: string;
};

type CalendarScope = "team" | "all";

export function SeasonCalendar({
  calendar,
  reputationPoints,
  nowIso,
}: SeasonCalendarProps) {
  const [scope, setScope] =
    useState<CalendarScope>("team");
  const [selectedCategories, setSelectedCategories] =
    useState<RaceCategoryCode[]>([]);
  const scopeEditions = useMemo(
    () => {
      const standardEditions = calendar.editions.filter(
        (edition) => edition.competitionType === "standard"
      );

      return scope === "all"
        ? standardEditions
        : standardEditions.filter((edition) =>
            isRaceEditionAvailableToCurrentTeam({
              edition,
              reputationPoints,
              now: new Date(nowIso),
            })
          );
    },
    [calendar.editions, nowIso, reputationPoints, scope]
  );
  const visibleEditions = useMemo(
    () =>
      selectedCategories.length === 0
        ? scopeEditions
        : scopeEditions.filter((edition) =>
            selectedCategories.includes(
              edition.categoryCode
            )
          ),
    [scopeEditions, selectedCategories]
  );
  const weeks = useMemo(
    () => buildCalendarWeeks(visibleEditions),
    [visibleEditions]
  );
  const profileEntries = useMemo(
    () =>
      visibleEditions
        .flatMap((edition) =>
          edition.stages.map((stage) => ({ edition, stage }))
        )
        .sort(
          (first, second) =>
            first.stage.dayNumber - second.stage.dayNumber ||
            compareRaceDaySlots(first.stage.daySlot, second.stage.daySlot) ||
            first.edition.prestigeRank - second.edition.prestigeRank ||
            first.edition.name.localeCompare(second.edition.name, "fr") ||
            first.stage.stageNumber - second.stage.stageNumber
        ),
    [visibleEditions]
  );
  const dayByNumber = useMemo(
    () =>
      new Map(
        calendar.days.map((day) => [
          day.dayNumber,
          day,
        ])
      ),
    [calendar.days]
  );
  const eventsByDay = useMemo(() => {
    const groupedEvents = new Map<
      number,
      SeasonRaceCalendar["events"]
    >();

    for (const event of calendar.events) {
      const dayEvents =
        groupedEvents.get(event.dayNumber) ?? [];
      dayEvents.push(event);
      groupedEvents.set(
        event.dayNumber,
        dayEvents
      );
    }

    return groupedEvents;
  }, [calendar.events]);

  function toggleCategory(
    categoryCode: RaceCategoryCode
  ) {
    setSelectedCategories((current) =>
      current.includes(categoryCode)
        ? current.filter(
            (value) => value !== categoryCode
          )
        : [...current, categoryCode]
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#176951]/15 bg-[#EAF5F0] p-4 sm:px-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#176951]">
            Courses proposées
          </p>
          <p className="mt-1 text-sm font-medium text-[#557064]">
            Les épreuves accessibles selon votre réputation et les délais sont affichées en priorité.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Portée du calendrier">
          <button
            type="button"
            onClick={() => {
              setScope("team");
            }}
            aria-pressed={scope === "team"}
            className={`min-h-10 rounded-full border px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] ${
              scope === "team"
                ? "border-[#176951] bg-[#176951] text-white"
                : "border-[#176951]/25 bg-white text-[#176951] hover:border-[#176951]/55"
            }`}
          >
            Accessibles à mon équipe
          </button>
          <button
            type="button"
            onClick={() => {
              setScope("all");
            }}
            aria-pressed={scope === "all"}
            className={`min-h-10 rounded-full border px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] ${
              scope === "all"
                ? "border-[#0B302B] bg-[#0B302B] text-white"
                : "border-[#315B3E]/25 bg-white text-[#315B3E] hover:border-[#315B3E]/55"
            }`}
          >
            Toutes les courses
          </button>
          <span className="inline-flex min-h-10 items-center rounded-full border border-[#315B3E]/15 bg-white px-3 text-xs font-black text-[#315B3E]">
            {scopeEditions.length} / {calendar.editions.filter((edition) => edition.competitionType === "standard").length}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#315B3E]">
            Filtrer le circuit
          </p>

          <p className="mt-1 text-sm font-medium text-[#557064]">
            Plusieurs catégories peuvent être combinées dans la sélection ci-dessus.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Filtres du calendrier">
          <button
            type="button"
            onClick={() => {
              setSelectedCategories([]);
            }}
            aria-pressed={
              selectedCategories.length === 0
            }
            className={`min-h-10 rounded-full border px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951] ${
              selectedCategories.length === 0
                ? "border-[#0B302B] bg-[#0B302B] text-white"
                : "border-[#315B3E]/25 bg-white text-[#315B3E] hover:border-[#315B3E]/55"
            }`}
          >
            Toutes catégories
          </button>

          {RACE_CATEGORY_CODES.map(
            (categoryCode) => {
              const style =
                RACE_CATEGORY_STYLE[
                  categoryCode
                ];
              const isSelected =
                selectedCategories.includes(
                  categoryCode
                );

              return (
                <button
                  key={categoryCode}
                  type="button"
                  onClick={() =>
                    toggleCategory(categoryCode)
                  }
                  aria-pressed={isSelected}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-xs font-extrabold uppercase tracking-wider transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
                  style={{
                    borderColor: style.border,
                    backgroundColor: isSelected
                      ? style.background
                      : "#FFFFFF",
                    color: isSelected
                      ? style.foreground
                      : style.border,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        style.background,
                    }}
                  />
                  {style.label}
                </button>
              );
            }
          )}
        </div>
      </div>

      <div className="mt-7 hidden space-y-4 md:block">
        {weeks.map((week) => (
          <DesktopCalendarWeek
            key={week.weekNumber}
            week={week}
            currentDayNumber={
              calendar.currentDayNumber
            }
            dayByNumber={dayByNumber}
            eventsByDay={eventsByDay}
          />
        ))}
      </div>

      <div className="mt-7 space-y-4 md:hidden">
        {calendar.days.map((day) => {
          const dayEditions = visibleEditions
            .flatMap((edition) =>
              edition.stages
                .filter(
                  (stage) =>
                    stage.dayNumber ===
                    day.dayNumber
                )
                .map((stage) => ({ edition, stage }))
            )
            .sort(
              (first, second) =>
                compareRaceDaySlots(first.stage.daySlot, second.stage.daySlot) ||
                first.edition.prestigeRank - second.edition.prestigeRank ||
                first.edition.name.localeCompare(second.edition.name, "fr") ||
                first.stage.stageNumber - second.stage.stageNumber
            );

          return (
            <MobileCalendarDay
              key={day.id}
              dayNumber={day.dayNumber}
              date={day.calendarDate}
              isCurrent={
                day.dayNumber ===
                calendar.currentDayNumber
              }
              isPast={
                day.dayNumber <
                calendar.currentDayNumber
              }
              events={
                eventsByDay.get(day.dayNumber) ??
                []
              }
              entries={dayEditions}
            />
          );
        })}
      </div>

      {profileEntries.length > 0 ? (
        <section className="mt-10 border-t border-[#315B3E]/15 pt-8" aria-labelledby="calendar-profiles-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#315B3E]">
                Lecture du terrain
              </p>
              <h2 id="calendar-profiles-title" className="mt-2 text-2xl font-black text-[#0B302B]">
                Profils tronçonnés de la saison
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#557064]">
                Chaque trait vertical correspond à un tronçon de 10 km. Les drapeaux indiquent la position exacte des GPM et des sprints intermédiaires.
              </p>
            </div>
            <span className="rounded-full border border-[#315B3E]/20 bg-white px-3 py-1.5 text-xs font-extrabold text-[#315B3E]">
              {profileEntries.length} profil{profileEntries.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {profileEntries.map(({ edition, stage }) => {
              const style = RACE_CATEGORY_STYLE[edition.categoryCode];
              const mountainCount = stage.segments.filter((segment) => segment.prime?.type === "mountain").length;
              const sprintCount = stage.segments.filter((segment) => segment.prime?.type === "intermediate_sprint").length;

              return (
                <Link
                  key={stage.id}
                  href={`/jeu/courses/${edition.slug}`}
                  className="group grid gap-3 rounded-2xl border border-[#315B3E]/15 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#315B3E]/30 hover:shadow-md sm:grid-cols-[minmax(180px,0.75fr)_minmax(260px,1.25fr)] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-2 py-1 text-[9px] font-black uppercase tracking-wider"
                        style={{ backgroundColor: style.background, color: style.foreground }}
                      >
                        {style.shortLabel}
                      </span>
                      <RaceCountryFlag
                        countryCode={edition.countryCode}
                        countryName={edition.countryName}
                      />
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#688176]">
                        J{stage.dayNumber} · {RACE_DAY_SLOT_CONFIG[stage.daySlot].label}
                        {edition.raceFormat === "stage_race" ? ` · Étape ${stage.stageNumber}` : ""}
                      </span>
                    </div>
                    <h3 className="mt-2 truncate text-sm font-black text-[#0B302B] group-hover:text-[#176951]">
                      {edition.name}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#688176]">
                      {RACE_PROFILE_LABELS[stage.profileType]} · {stage.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#789087]">
                      {mountainCount || sprintCount
                        ? `${mountainCount} GPM · ${sprintCount} SI`
                        : "Sans classement annexe"}
                    </p>
                  </div>
                  <RaceStageProfile segments={stage.segments} compact />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {visibleEditions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#315B3E]/30 bg-[#F6FAF7] px-6 py-10 text-center">
          <p className="font-black text-[#0B302B]">
            Aucune course ne correspond à ces filtres.
          </p>

          <button
            type="button"
            onClick={() => {
              setSelectedCategories([]);
              if (scope === "team") {
                setScope("all");
              }
            }}
            className="mt-4 rounded-full bg-[#0B302B] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-white"
          >
            {scope === "team"
              ? "Afficher toutes les courses"
              : "Réinitialiser les catégories"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DesktopCalendarWeek({
  week,
  currentDayNumber,
  dayByNumber,
  eventsByDay,
}: {
  week: CalendarWeek;
  currentDayNumber: number;
  dayByNumber: Map<
    number,
    SeasonRaceCalendar["days"][number]
  >;
  eventsByDay: Map<
    number,
    SeasonRaceCalendar["events"]
  >;
}) {
  const visibleLaneCountBySlot = Object.fromEntries(
    RACE_DAY_SLOTS.map((slot) => [
      slot,
      Math.min(
        DEFAULT_VISIBLE_LANES_PER_SLOT,
        week.laneCountBySlot[slot]
      ),
    ])
  ) as Record<(typeof RACE_DAY_SLOTS)[number], number>;
  const hasHiddenLanes = RACE_DAY_SLOTS.some(
    (slot) => week.laneCountBySlot[slot] > DEFAULT_VISIBLE_LANES_PER_SLOT
  );
  const earlyLaneCount = visibleLaneCountBySlot.early;
  const lateLaneCount = visibleLaneCountBySlot.late;
  const rowCount = earlyLaneCount + lateLaneCount + 2 + (hasHiddenLanes ? 1 : 0);

  return (
    <section
      aria-label={`Semaine ${week.weekNumber}, J${week.startDay} à J${week.endDay}`}
      className="grid grid-cols-7 gap-x-2 overflow-visible rounded-2xl border border-[#315B3E]/15 bg-[#DCEAE4] p-2 shadow-sm"
      style={{
        gridTemplateRows: `minmax(9.5rem, auto) repeat(${rowCount}, minmax(2.1rem, auto))`,
      }}
    >
      {Array.from({ length: 7 }, (_, index) => {
        const dayNumber =
          week.startDay + index;
        const day = dayByNumber.get(dayNumber);
        const isCurrent =
          dayNumber === currentDayNumber;
        const isPast =
          dayNumber < currentDayNumber;

        return (
          <div
            key={dayNumber}
            className={`min-w-0 rounded-xl border px-3 py-3 ${
              isCurrent
                ? "border-[#F2C94C] bg-[#FFF8D9] shadow-[inset_0_0_0_2px_rgba(242,201,76,0.28)]"
                : isPast
                  ? "border-[#315B3E]/10 bg-[#F3F6F3]/80"
                  : "border-[#315B3E]/10 bg-white"
            }`}
            style={{
              gridColumn: index + 1,
              gridRow: `1 / span ${rowCount + 1}`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-black text-[#0B302B]">
                  J{dayNumber}
                </p>
                {day ? (
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[#688176]">
                    {formatShortDate(
                      day.calendarDate
                    )}
                  </p>
                ) : null}
              </div>

              {isCurrent ? (
                <span className="rounded-full bg-[#F2C94C] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#17261E]">
                  Aujourd’hui
                </span>
              ) : null}
            </div>

            <div className="mt-3 space-y-1.5">
              {(eventsByDay.get(dayNumber) ?? []).map(
                (event) => (
                  <SeasonEventBadge
                    key={event.id}
                    event={event}
                    compact
                  />
                )
              )}
            </div>
          </div>
        );
      })}

      {RACE_DAY_SLOTS.map((slot) => {
        const config = RACE_DAY_SLOT_CONFIG[slot];
        const row = slot === "early" ? 2 : earlyLaneCount + 3;

        return (
          <div
            key={slot}
            className="relative z-20 mx-1 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#0B302B] px-3 py-1.5 text-white shadow-sm"
            style={{ gridColumn: "1 / 8", gridRow: row }}
          >
            <span className="text-[10px] font-black uppercase tracking-[0.18em]">
              {config.label} · {config.departureLabel}
            </span>
            <span className="text-[9px] font-bold text-[#A9C6BB]">
              {config.registrationCutoffLabel}
            </span>
          </div>
        );
      })}

      {week.segments
        .filter(
          (segment) =>
            segment.lane < visibleLaneCountBySlot[segment.daySlot]
        )
        .map((segment) => {
          const style =
            RACE_CATEGORY_STYLE[
              segment.edition.categoryCode
            ];
          const columnStart =
            segment.startDay -
            week.startDay +
            1;
          const columnEnd =
            segment.endDay -
            week.startDay +
            2;

          return (
            <Link
              key={`${segment.edition.id}-${week.weekNumber}`}
              href={`/jeu/courses/${segment.edition.slug}`}
              title={`${segment.edition.name} — ${segment.edition.countryName}`}
              className={`relative z-10 mx-1 flex min-w-0 items-center gap-2 self-center overflow-hidden border px-2.5 py-1.5 text-[11px] font-black shadow-sm transition hover:z-20 hover:-translate-y-0.5 hover:brightness-110 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#071A17] ${
                segment.startsBeforeWeek
                  ? "rounded-l-sm"
                  : "rounded-l-lg"
              } ${
                segment.continuesAfterWeek
                  ? "rounded-r-sm"
                  : "rounded-r-lg"
              }`}
              style={{
                gridColumn: `${columnStart} / ${columnEnd}`,
                gridRow:
                  segment.daySlot === "early"
                    ? segment.lane + 3
                    : earlyLaneCount + segment.lane + 4,
                backgroundColor: style.background,
                borderColor: style.border,
                color: style.foreground,
              }}
            >
              <span className="shrink-0 rounded bg-black/15 px-1 py-0.5 text-[9px] tracking-wider">
                {style.shortLabel}
              </span>

              <RaceCountryFlag
                countryCode={segment.edition.countryCode}
                countryName={segment.edition.countryName}
                className="border-white/70"
              />

              <span className="truncate">
                {segment.startsBeforeWeek
                  ? "← "
                  : ""}
                {segment.edition.name}
                {segment.continuesAfterWeek
                  ? " →"
                  : ""}
              </span>

              {segment.edition.currentTeamRegistration
                ?.status === "accepted" ? (
                <span className="ml-auto shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-black">
                  ✓ {segment.edition.currentTeamRegistration.rosterCount}
                </span>
              ) : null}
            </Link>
          );
        })}

      {hasHiddenLanes
        ? Array.from({ length: 7 }, (_, index) => {
            const dayNumber = week.startDay + index;
            const hiddenSegments = week.segments.filter(
              (segment) =>
                segment.lane >= visibleLaneCountBySlot[segment.daySlot] &&
                segment.startDay <= dayNumber &&
                segment.endDay >= dayNumber
            );

            if (hiddenSegments.length === 0) {
              return null;
            }

            const tooltipId = `calendar-overflow-${week.weekNumber}-${dayNumber}`;

            return (
              <div
                key={dayNumber}
                className="group/overflow relative z-30 mx-1 self-center"
                style={{
                  gridColumn: index + 1,
                  gridRow: earlyLaneCount + lateLaneCount + 4,
                }}
              >
                <button
                  type="button"
                  aria-describedby={tooltipId}
                  aria-label={`${hiddenSegments.length} autres courses à J${dayNumber}`}
                  className="w-full rounded-lg border border-[#315B3E]/20 bg-white/95 px-2 py-1.5 text-xs font-black text-[#315B3E] shadow-sm transition hover:border-[#176951]/45 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
                >
                  +{hiddenSegments.length}
                </button>

                <div
                  id={tooltipId}
                  role="tooltip"
                  className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-[#315B3E]/15 bg-[#071A17] p-3 text-left text-white opacity-0 shadow-xl transition group-hover/overflow:visible group-hover/overflow:opacity-100 group-focus-within/overflow:visible group-focus-within/overflow:opacity-100"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
                    Autres courses · J{dayNumber}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {hiddenSegments.map((segment) => {
                      const style =
                        RACE_CATEGORY_STYLE[
                          segment.edition.categoryCode
                        ];

                      return (
                        <li
                          key={segment.edition.id}
                          className="flex min-w-0 items-center gap-2"
                        >
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-black tracking-wider"
                            style={{
                              backgroundColor: style.background,
                              color: style.foreground,
                            }}
                          >
                            {style.shortLabel}
                          </span>
                          <RaceCountryFlag
                            countryCode={segment.edition.countryCode}
                            countryName={segment.edition.countryName}
                          />
                          <span className="truncate text-[11px] font-bold">
                            {segment.edition.name}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 border-t border-white/10 pt-2 text-[10px] font-semibold leading-4 text-[#C8D8D0]">
                    Filtrez une catégorie pour afficher et ouvrir la course souhaitée.
                  </p>
                </div>
              </div>
            );
          })
        : null}
    </section>
  );
}

function MobileCalendarDay({
  dayNumber,
  date,
  isCurrent,
  isPast,
  events,
  entries,
}: {
  dayNumber: number;
  date: string;
  isCurrent: boolean;
  isPast: boolean;
  events: SeasonRaceCalendar["events"];
  entries: Array<{
    edition: RaceCalendarEdition;
    stage: RaceCalendarEdition["stages"][number];
  }>;
}) {
  return (
    <section
      className={`rounded-2xl border p-4 ${
        isCurrent
          ? "border-[#F2C94C] bg-[#FFF8D9]"
          : isPast
            ? "border-[#315B3E]/10 bg-[#F3F6F3]"
            : "border-[#315B3E]/15 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-[#0B302B]">
            J{dayNumber}
          </h3>
          <p className="text-xs font-bold uppercase tracking-wide text-[#688176]">
            {formatShortDate(date)}
          </p>
        </div>

        {isCurrent ? (
          <span className="rounded-full bg-[#F2C94C] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#17261E]">
            Aujourd’hui
          </span>
        ) : null}
      </div>

      {events.length > 0 ? (
        <div className="mt-4 space-y-2">
          {events.map((event) => (
            <SeasonEventBadge
              key={event.id}
              event={event}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {entries.map(({ edition, stage }, entryIndex) => {
          const style =
            RACE_CATEGORY_STYLE[
              edition.categoryCode
            ];
          const slotConfig = RACE_DAY_SLOT_CONFIG[stage.daySlot];
          const startsSlot = entries[entryIndex - 1]?.stage.daySlot !== stage.daySlot;

          return (
            <div key={stage.id} className="space-y-2">
            {startsSlot ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[#0B302B] px-3 py-2 text-white">
                <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                  {slotConfig.label} · {slotConfig.departureLabel}
                </span>
                <span className="text-[9px] font-bold text-[#A9C6BB]">
                  Gel {slotConfig.registrationCutoffHour} h
                </span>
              </div>
            ) : null}
            <Link
              href={`/jeu/courses/${edition.slug}`}
              className="flex items-center gap-3 rounded-xl border px-3 py-3 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#071A17]"
              style={{
                borderColor: style.border,
                backgroundColor: style.background,
                color: style.foreground,
              }}
            >
              <span className="rounded bg-black/15 px-2 py-1 text-[10px] font-black tracking-wider">
                {style.shortLabel}
              </span>

              <RaceCountryFlag
                countryCode={edition.countryCode}
                countryName={edition.countryName}
                className="border-white/70"
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">
                  {edition.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-85">
                  {edition.raceFormat ===
                  "stage_race"
                    ? `Étape ${stage.stageNumber} · `
                    : ""}
                  {slotConfig.shortLabel}
                  {" · "}
                  {
                    RACE_PROFILE_LABELS[
                      stage.profileType
                    ]
                  }
                  {" · "}
                  {stage.distanceKm.toLocaleString(
                    "fr-FR",
                    {
                      maximumFractionDigits: 0,
                    }
                  )} km
                </span>
              </span>

              {edition.currentTeamRegistration
                ?.status === "accepted" ? (
                <span className="shrink-0 rounded-full bg-white/20 px-2 py-1 text-[10px] font-black">
                  ✓ {edition.currentTeamRegistration.rosterCount}
                </span>
              ) : null}
            </Link>
            </div>
          );
        })}

        {entries.length === 0 &&
        events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#315B3E]/20 px-4 py-3 text-sm font-semibold text-[#688176]">
            Aucune course programmée.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function RaceCountryFlag({
  countryCode,
  countryName,
  className = "border-white",
}: {
  countryCode: string;
  countryName: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Drapeau ${countryName}`}
      title={countryName}
      className={`fi fi-${countryCode.toLowerCase()} inline-block h-3.5 w-5 shrink-0 rounded-sm border shadow-sm ${className}`}
    />
  );
}

function SeasonEventBadge({
  event,
  compact = false,
}: {
  event: SeasonRaceCalendar["events"][number];
  compact?: boolean;
}) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full bg-[#176951]"
      />
      <span className="min-w-0 truncate">
        {event.title}
      </span>
    </>
  );
  const className = `flex items-center gap-2 rounded-lg border border-[#B99525]/55 bg-[#FFF2C7] text-[#17261E] shadow-sm ${
    compact
      ? "px-2 py-1.5 text-[10px] font-extrabold"
      : "px-3 py-2.5 text-xs font-extrabold"
  }`;

  if (event.href) {
    return (
      <Link
        href={event.href}
        className={`${className} transition hover:border-[#8A6B16] hover:bg-[#FFE58A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]`}
        title={event.description ?? event.title}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={className}
      title={event.description ?? event.title}
    >
      {content}
    </div>
  );
}

function formatShortDate(value: string) {
  return shortDateFormatter.format(
    new Date(`${value}T00:00:00Z`)
  );
}
