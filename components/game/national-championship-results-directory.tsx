import Link from "@/components/ui/app-link";
import type {
  RaceCalendarEdition,
  RaceCompetitionType,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

type NationalChampionshipGroup = {
  competitionType: Extract<
    RaceCompetitionType,
    "national_road" | "national_time_trial"
  >;
  title: string;
  discipline: "route" | "contre-la-montre";
  dayNumber: number;
  editions: RaceCalendarEdition[];
};

export function NationalChampionshipResultsDirectory({
  calendar,
  countryCodes,
}: {
  calendar: SeasonRaceCalendar;
  countryCodes: string[];
}) {
  const relevantCodes = new Set(countryCodes.map((code) => code.toUpperCase()));
  const groups = buildNationalChampionshipGroups(calendar, relevantCodes).filter(
    (group) => group.dayNumber <= calendar.currentDayNumber,
  );
  if (groups.length === 0) return null;

  return (
    <section
      className="mb-6 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_55px_rgba(19,60,46,0.1)]"
      aria-labelledby="national-results-title"
    >
      <header className="bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-6 text-white sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0CA]">
          Résultats sans replay
        </p>
        <h2 id="national-results-title" className="mt-2 text-2xl font-black">
          Championnats nationaux
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#C1D3CA]">
          Chaque discipline regroupe les classements des pays liés à votre
          effectif. Les épreuves sans partant apparaissent comme annulées.
        </p>
      </header>

      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-2">
        {groups.map((group) => {
          const resolvedCount = group.editions.filter(
            (edition) =>
              edition.status === "completed" ||
              edition.status === "cancelled",
          ).length;
          const allResolved = resolvedCount === group.editions.length;

          return (
            <article
              key={group.competitionType}
              className="rounded-2xl border border-[#315B3E]/15 bg-[#F6FAF7] p-5"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#176951]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#176951]">
                  J{group.dayNumber} · {group.editions.length} pays
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${
                    allResolved
                      ? "bg-[#D7EEE8] text-[#176951]"
                      : "bg-[#FFF2C7] text-[#7A5B09]"
                  }`}
                >
                  {allResolved
                    ? "Journée résolue"
                    : "Simulation automatique"}
                </span>
              </span>
              <span className="mt-4 block text-xl font-black text-[#183F37]">
                {group.title}
              </span>
              <span className="mt-2 block text-sm font-semibold leading-6 text-[#60756E]">
                {allResolved
                  ? "Consultez directement chaque classement officiel disponible."
                  : "Tous les pays sont résolus ensemble ; aucun direct ni replay n’est généré."}
              </span>
              <div className="mt-4 space-y-2">
                {[...group.editions]
                  .sort((left, right) =>
                    left.countryName.localeCompare(right.countryName, "fr"),
                  )
                  .map((edition) => {
                    const stage = edition.stages[0];
                    const label = (
                      <>
                        <span
                          className={`fi fi-${edition.countryCode.toLowerCase()} rounded shadow-sm`}
                          role="img"
                          aria-label={`Drapeau ${edition.countryName}`}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {edition.countryName}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wide">
                          {edition.status === "cancelled"
                            ? "Annulé"
                            : edition.status === "completed"
                              ? "Classement"
                              : "À venir"}
                        </span>
                      </>
                    );

                    return edition.status === "completed" && stage ? (
                      <Link
                        key={edition.id}
                        href={`/jeu/resultats/${edition.slug}/${stage.stageNumber}`}
                        className="flex min-h-10 items-center gap-3 rounded-xl border border-[#315B3E]/12 bg-white px-3 text-sm font-bold text-[#183F37] transition hover:border-[#278B70]/40 hover:text-[#176951]"
                      >
                        {label}
                      </Link>
                    ) : (
                      <div
                        key={edition.id}
                        className="flex min-h-10 items-center gap-3 rounded-xl border border-[#315B3E]/10 bg-white/60 px-3 text-sm font-bold text-[#60756E]"
                      >
                        {label}
                      </div>
                    );
                  })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function buildNationalChampionshipGroups(
  calendar: SeasonRaceCalendar,
  countryCodes: Set<string>,
): NationalChampionshipGroup[] {
  const configurations = [
    {
      competitionType: "national_time_trial" as const,
      title: "CN contre-la-montre",
      discipline: "contre-la-montre" as const,
    },
    {
      competitionType: "national_road" as const,
      title: "CN sur route",
      discipline: "route" as const,
    },
  ];

  return configurations.flatMap((configuration) => {
    const editions = calendar.editions.filter(
      (edition) =>
        edition.competitionType === configuration.competitionType &&
        countryCodes.has(edition.countryCode.toUpperCase()),
    );
    const dayNumber = Math.min(
      ...editions.flatMap((edition) =>
        edition.stages.map((stage) => stage.dayNumber),
      ),
    );
    if (editions.length === 0 || !Number.isFinite(dayNumber)) return [];

    return [{ ...configuration, dayNumber, editions }];
  });
}
