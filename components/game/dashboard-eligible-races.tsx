import Link from "next/link";
import {
  RACE_CATEGORY_STYLE,
  getRegistrationAvailability,
  isRaceEditionAvailableToCurrentTeam,
  type RaceCalendarEdition,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

export type DashboardEligibleRace = {
  edition: RaceCalendarEdition;
  startDayNumber: number;
  endDayNumber: number;
  calendarDate: string | null;
};

export function DashboardEligibleRaces({
  calendar,
  reputationPoints,
  riderCount,
  now = new Date(),
}: {
  calendar: SeasonRaceCalendar | null;
  reputationPoints: number;
  riderCount: number;
  now?: Date;
}) {
  const races = calendar
    ? getOpenEligibleDashboardRaces({
        calendar,
        reputationPoints,
        riderCount,
        now,
        limit: 4,
      })
    : [];

  return (
    <section
      aria-labelledby="dashboard-eligible-races-title"
      className="flex h-full min-h-72 flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#F8FBF9] text-[#082A2A] shadow-[0_16px_40px_rgba(4,25,21,0.18)]"
    >
      <header className="flex items-center justify-between gap-4 border-b border-[#315B3E]/10 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Inscriptions accessibles
          </p>
          <h3
            id="dashboard-eligible-races-title"
            className="mt-1 text-lg font-black text-[#082A2A]"
          >
            Courses à engager
          </h3>
        </div>
        {calendar ? (
          <span className="rounded-full bg-[#E8F7F1] px-3 py-1.5 text-xs font-black text-[#176951]">
            J{calendar.currentDayNumber}
          </span>
        ) : null}
      </header>

      {races.length ? (
        <ol className="flex-1 divide-y divide-[#315B3E]/10">
          {races.map(({ edition, startDayNumber, endDayNumber, calendarDate }) => {
            const style = RACE_CATEGORY_STYLE[edition.categoryCode];
            const registration = edition.currentTeamRegistration;
            const actionLabel =
              registration?.status === "accepted"
                ? "Voir l’inscription"
                : registration?.status === "pending"
                  ? "Voir la demande"
                  : registration?.status === "withdrawn"
                    ? "Se réinscrire"
                    : "S’inscrire";

            return (
              <li key={edition.id}>
                <Link
                  href={`/jeu/courses/${edition.slug}#inscription`}
                  className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70]"
                >
                  <span
                    aria-hidden="true"
                    className="h-10 w-1.5 rounded-full"
                    style={{ backgroundColor: style.background }}
                  />

                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`fi fi-${edition.countryCode.toLowerCase()} shrink-0 rounded`}
                        role="img"
                        aria-label={`Drapeau ${edition.countryName}`}
                      />
                      <span className="truncate text-sm font-black text-[#183F37] transition group-hover:text-[#176951]">
                        {edition.name}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">
                      {style.label} · {formatRaceDays(startDayNumber, endDayNumber)}
                      {calendarDate ? ` · ${formatCalendarDate(calendarDate)}` : ""}
                    </span>
                  </span>

                  <span className="rounded-lg bg-[#E8F7F1] px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-[#176951] transition group-hover:bg-[#176951] group-hover:text-white">
                    {actionLabel}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F7F1] text-xl text-[#176951]"
          >
            ✓
          </span>
          <p className="mt-3 text-sm font-black text-[#153C34]">
            Rien à engager aujourd’hui
          </p>
          <p className="mt-1 max-w-sm text-xs font-semibold leading-5 text-[#60756E]">
            Seules les inscriptions ouvertes, compatibles avec votre réputation
            et la taille de votre effectif apparaissent ici.
          </p>
        </div>
      )}

      <Link
        href="/jeu/calendrier"
        className="flex items-center justify-between border-t border-[#315B3E]/10 bg-white px-5 py-3 text-xs font-black text-[#176951] transition hover:bg-[#E8F7F1]"
      >
        Ouvrir toutes les inscriptions
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export function getOpenEligibleDashboardRaces({
  calendar,
  reputationPoints,
  riderCount,
  now,
  limit,
}: {
  calendar: SeasonRaceCalendar;
  reputationPoints: number;
  riderCount: number;
  now: Date;
  limit: number;
}): DashboardEligibleRace[] {
  const dateByDayNumber = new Map(
    calendar.days.map((day) => [day.dayNumber, day.calendarDate]),
  );

  return calendar.editions
    .flatMap((edition): DashboardEligibleRace[] => {
      if (
        edition.status === "cancelled" ||
        edition.status === "completed" ||
        edition.status === "in_progress" ||
        riderCount < edition.minimumRosterSize
      ) {
        return [];
      }

      const closesAt =
        edition.categoryCode === "elite"
          ? edition.wildcardClosesAt
          : edition.registrationClosesAt;
      const availability = getRegistrationAvailability({
        policy: edition.registrationPolicy,
        closesAt,
        minimumReputation: edition.minimumReputation,
        reputationPoints,
        now,
      });

      if (
        availability !== "open" ||
        !isRaceEditionAvailableToCurrentTeam({
          edition,
          reputationPoints,
          now,
        })
      ) {
        return [];
      }

      const activeStages = edition.stages.filter(
        (stage) => stage.status !== "cancelled",
      );
      if (!activeStages.length) return [];

      const startDayNumber = Math.min(
        ...activeStages.map((stage) => stage.dayNumber),
      );
      const endDayNumber = Math.max(
        ...activeStages.map((stage) => stage.dayNumber),
      );
      if (startDayNumber < calendar.currentDayNumber) return [];

      return [
        {
          edition,
          startDayNumber,
          endDayNumber,
          calendarDate: dateByDayNumber.get(startDayNumber) ?? null,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.startDayNumber - right.startDayNumber ||
        left.edition.prestigeRank - right.edition.prestigeRank ||
        left.edition.name.localeCompare(right.edition.name, "fr"),
    )
    .slice(0, Math.max(0, limit));
}

function formatRaceDays(startDay: number, endDay: number) {
  return startDay === endDay ? `J${startDay}` : `J${startDay}–J${endDay}`;
}

function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00Z`));
}
