import Link from "@/components/ui/app-link";
import type {
  RaceCalendarEdition,
  RaceCompetitionType,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

export type NationalChampionshipGroup = {
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
  groups,
}: {
  groups: NationalChampionshipGroup[];
}) {
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
          Choisissez une discipline, puis le pays où votre équipe était
          engagée pour ouvrir son classement officiel.
        </p>
      </header>

      <div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-2">
        {groups.map((group) => (
          <NationalChampionshipGroupCard
            key={group.competitionType}
            group={group}
          />
        ))}
      </div>
    </section>
  );
}

export function NationalChampionshipGroupCard({
  group,
  period = "current",
}: {
  group: NationalChampionshipGroup;
  period?: "current" | "past";
}) {
  const allResolved = isNationalChampionshipGroupResolved(group);

  return (
    <article
      data-race-period={period}
      data-race-competition="national-championship"
      className="rounded-2xl border border-[#315B3E]/15 bg-[#F6FAF7] p-5 shadow-sm"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-[#176951]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#176951]">
          J{group.dayNumber} · {group.editions.length} championnat
          {group.editions.length > 1 ? "s" : ""}
        </span>
        <span
          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${
            allResolved
              ? "bg-[#D7EEE8] text-[#176951]"
              : "bg-[#FFF2C7] text-[#7A5B09]"
          }`}
        >
          {allResolved ? "Résultats disponibles" : "À venir"}
        </span>
      </span>
      <span className="mt-4 block text-xl font-black text-[#183F37]">
        {group.title}
      </span>
      <span className="mt-2 block text-sm font-semibold leading-6 text-[#60756E]">
        {allResolved
          ? "Choisissez votre championnat pour consulter le classement officiel."
          : "Les résultats seront publiés après la simulation, sans direct ni replay."}
      </span>
      <Link
        href={`/jeu/resultats/championnats-nationaux/${group.discipline}`}
        prefetch={false}
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#176951] px-4 text-sm font-black text-white transition hover:bg-[#0B302B]"
      >
        Choisir un championnat →
      </Link>
    </article>
  );
}

export function splitNationalChampionshipGroupsForResults(
  groups: NationalChampionshipGroup[],
  currentDayNumber: number,
) {
  return {
    current: groups.filter(
      (group) =>
        group.dayNumber <= currentDayNumber &&
        !isNationalChampionshipGroupPast(group, currentDayNumber),
    ),
    past: groups.filter((group) =>
      isNationalChampionshipGroupPast(group, currentDayNumber),
    ),
  };
}

function isNationalChampionshipGroupPast(
  group: NationalChampionshipGroup,
  currentDayNumber: number,
) {
  return group.dayNumber < currentDayNumber;
}

function isNationalChampionshipGroupResolved(
  group: NationalChampionshipGroup,
) {
  return group.editions.every(
    (edition) =>
      edition.status === "completed" || edition.status === "cancelled",
  );
}

export function buildNationalChampionshipGroups(
  calendar: SeasonRaceCalendar,
  enteredEditionIds: Set<string>,
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
        enteredEditionIds.has(edition.id),
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
