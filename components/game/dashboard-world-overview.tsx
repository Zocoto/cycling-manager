import Link from "@/components/ui/app-link";
import { DashboardEventsCard } from "@/components/game/dashboard-events-card";
import type { DashboardEvent } from "@/lib/game/dashboard-events";
import {
  formatPublicGameNewsDate,
  type PublicGameNewsItem,
} from "@/lib/game/public-game-news";
import {
  RACE_CATEGORY_STYLE,
  type RaceCalendarEdition,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import { TEAM_DIVISION_LABELS } from "@/lib/game/team-divisions";
import type {
  NationRankingEntry,
  RiderRankingEntry,
  TeamRankingEntry,
  UciRankings,
} from "@/services/uci-rankings";

type UpcomingRace = {
  edition: RaceCalendarEdition;
  nextDayNumber: number;
  startDayNumber: number;
  endDayNumber: number;
};

export function DashboardWorldOverview({
  teamId,
  dashboardEvents,
  rankings,
  calendar,
  pelotonNews,
}: {
  teamId: string | null;
  dashboardEvents: DashboardEvent[];
  rankings: UciRankings | null;
  calendar: SeasonRaceCalendar | null;
  pelotonNews: PublicGameNewsItem[];
}) {
  return (
    <section aria-labelledby="dashboard-world-overview-title" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">
            Vue globale
          </p>
          <h2
            id="dashboard-world-overview-title"
            className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#082A2A]"
          >
            Le cyclisme en un coup d’œil
          </h2>
        </div>
        <p className="text-xs font-bold text-[#60756E]">
          {rankings?.seasonName ?? calendar?.seasonName ?? "Saison active"}
        </p>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <TeamRankingNeighborhood teamId={teamId} rankings={rankings} />
        <UpcomingRacesCard calendar={calendar} />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div data-tutorial-id="dashboard-news-feed">
          <DashboardEventsCard events={dashboardEvents} />
        </div>
        <PelotonHighlightsCard items={pelotonNews} />
      </div>

      <div className="mt-6">
        <UciLeadersCard rankings={rankings} />
      </div>
    </section>
  );
}

function TeamRankingNeighborhood({
  teamId,
  rankings,
}: {
  teamId: string | null;
  rankings: UciRankings | null;
}) {
  const currentTeamIndex =
    teamId && rankings
      ? rankings.teams.findIndex((entry) => entry.teamId === teamId)
      : -1;
  const currentTeam =
    currentTeamIndex >= 0 ? rankings?.teams[currentTeamIndex] ?? null : null;
  const neighborhood =
    rankings && currentTeamIndex >= 0
      ? getTeamRankingWindow(rankings.teams, currentTeamIndex, 4)
      : rankings?.teams.slice(0, 5) ?? [];

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.1)]">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[linear-gradient(130deg,#071A17,#0B302B_58%,#176951)] px-5 py-5 text-white sm:px-7">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
            Classement UCI par équipes
          </p>
          <h3 className="mt-1 text-xl font-black">
            {currentTeam ? `Votre équipe est ${formatRank(currentTeam.rank)}` : "La hiérarchie actuelle"}
          </h3>
        </div>
        {currentTeam ? (
          <div className="text-right">
            <p className="text-3xl font-black text-[#F2C94C]">#{currentTeam.rank}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#BFD1C6]">
              {formatPoints(currentTeam.points)} pts
            </p>
          </div>
        ) : null}
      </header>

      {neighborhood.length ? (
        <ol aria-label="Équipes voisines au classement UCI" className="divide-y divide-[#315B3E]/10">
          {neighborhood.map((entry) => {
            const isCurrent = entry.teamId === teamId;
            return (
              <li
                key={entry.teamId}
                aria-current={isCurrent ? "true" : undefined}
                className={
                  isCurrent
                    ? "grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 bg-[#FFF7D9] px-5 py-3 sm:px-7"
                    : "grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 transition hover:bg-[#F7FAF8] sm:px-7"
                }
              >
                <span className={`text-center text-sm font-black ${isCurrent ? "text-[#8A6812]" : "text-[#60756E]"}`}>
                  #{entry.rank}
                </span>
                <span className="min-w-0">
                  <Link
                    href={`/jeu/equipes/${entry.teamId}`}
                    className={`block truncate text-sm font-black hover:text-[#278B70] ${isCurrent ? "text-[#5F4708]" : "text-[#183F37]"}`}
                  >
                    {entry.teamName}
                  </Link>
                  <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">
                    {TEAM_DIVISION_LABELS[entry.division]}
                    {isCurrent ? " · votre équipe" : ""}
                  </span>
                </span>
                <span className={`text-right text-sm font-black tabular-nums ${isCurrent ? "text-[#8A6812]" : "text-[#315B3E]"}`}>
                  {formatPoints(entry.points)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyOverviewState>
          Votre équipe n’a pas encore marqué de points UCI. Les cinq premières équipes apparaîtront ici dès le premier classement.
        </EmptyOverviewState>
      )}

      <CardFooterLink href="/jeu/classements?vue=equipes">
        Ouvrir le classement complet
      </CardFooterLink>
    </article>
  );
}

function UpcomingRacesCard({
  calendar,
}: {
  calendar: SeasonRaceCalendar | null;
}) {
  const races = calendar ? getUpcomingRaces(calendar, 5) : [];
  const calendarDateByDay = new Map(
    calendar?.days.map((day) => [day.dayNumber, day.calendarDate]) ?? [],
  );

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.1)]">
      <header className="flex items-center justify-between gap-4 border-b border-[#315B3E]/10 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Calendrier mondial
          </p>
          <h3 className="mt-1 text-xl font-black text-[#082A2A]">
            Prochaines courses
          </h3>
        </div>
        {calendar ? (
          <span className="rounded-full bg-[#E8F7F1] px-3 py-1.5 text-xs font-black text-[#176951]">
            J{calendar.currentDayNumber}
          </span>
        ) : null}
      </header>

      {races.length ? (
        <ol aria-label="Prochaines courses" className="divide-y divide-[#315B3E]/10">
          {races.map(({ edition, nextDayNumber, startDayNumber, endDayNumber }) => {
            const style = RACE_CATEGORY_STYLE[edition.categoryCode];
            const calendarDate = calendarDateByDay.get(nextDayNumber);
            return (
              <li key={edition.id}>
                <Link
                  href={`/jeu/courses/${edition.slug}`}
                  className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5 transition hover:bg-[#F7FAF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] sm:px-6"
                >
                  <span
                    aria-hidden="true"
                    className="h-9 w-1.5 rounded-full"
                    style={{ backgroundColor: style.background }}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`fi fi-${edition.countryCode.toLowerCase()} shrink-0 rounded`} />
                      <span className="truncate text-sm font-black text-[#183F37] group-hover:text-[#278B70]">
                        {edition.name}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-semibold text-[#60756E]">
                      {style.label} · {formatRaceDays(startDayNumber, endDayNumber)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-xs font-black text-[#176951]">
                      {calendarDate ? formatCalendarDate(calendarDate) : `J${nextDayNumber}`}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-bold text-[#8A9B95]">
                      {nextDayNumber === calendar?.currentDayNumber ? "Aujourd’hui" : `J${nextDayNumber}`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyOverviewState>
          Aucune course à venir n’est encore programmée sur la saison active.
        </EmptyOverviewState>
      )}

      <CardFooterLink href="/jeu/calendrier">Voir les 28 jours</CardFooterLink>
    </article>
  );
}

function PelotonHighlightsCard({
  items,
}: {
  items: PublicGameNewsItem[];
}) {
  const visibleItems = items.slice(0, 3);
  const additionalItems = items.slice(3);

  return (
    <details
      open
      className="group/peloton overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-[#0B302B] text-white shadow-[0_18px_50px_rgba(19,60,46,0.13)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F2C94C] [&::-webkit-details-marker]:hidden sm:px-6">
        <span>
          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
            Fil du peloton
          </span>
          <span className="mt-1 block text-xl font-black">Les temps forts</span>
        </span>
        <span className="inline-flex items-center gap-2 text-xs font-black text-[#F2C94C]">
          {items.length} info{items.length > 1 ? "s" : ""}
          <span aria-hidden="true" className="transition-transform group-open/peloton:rotate-180">⌄</span>
        </span>
      </summary>

      <div className="border-t border-white/10">
        {visibleItems.length ? (
          <ol className="divide-y divide-white/10">
            {visibleItems.map((item) => <PelotonNewsRow key={item.id} item={item} />)}
          </ol>
        ) : (
          <p className="px-6 py-8 text-sm font-semibold leading-6 text-[#BFD1C6]">
            Les victoires, faits de course marquants et transferts majeurs apparaîtront ici.
          </p>
        )}

        {additionalItems.length ? (
          <details className="group/more border-t border-white/10">
            <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-3 text-xs font-black text-[#9BE0BC] hover:bg-white/5 [&::-webkit-details-marker]:hidden">
              Afficher {additionalItems.length} autre{additionalItems.length > 1 ? "s" : ""} temps fort{additionalItems.length > 1 ? "s" : ""}
              <span aria-hidden="true" className="transition-transform group-open/more:rotate-180">⌄</span>
            </summary>
            <ol className="divide-y divide-white/10 border-t border-white/10">
              {additionalItems.map((item) => <PelotonNewsRow key={item.id} item={item} />)}
            </ol>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function PelotonNewsRow({ item }: { item: PublicGameNewsItem }) {
  const href = item.kind === "movement" ? "/jeu/transferts" : "/jeu/resultats";
  const label =
    item.kind === "victory"
      ? "Victoire"
      : item.kind === "movement"
        ? "Transfert majeur"
        : "Fait de course";

  return (
    <li>
      <Link
        href={href}
        className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-5 py-4 transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F2C94C] sm:px-6"
      >
        <span
          aria-hidden="true"
          className={`mt-1 h-2.5 w-2.5 rounded-full ${
            item.kind === "victory"
              ? "bg-[#F2C94C]"
              : item.kind === "movement"
                ? "bg-[#8AB8F8]"
                : "bg-[#42CDA8]"
          }`}
        />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#9BE0BC]">
              {label}
            </span>
            <time dateTime={item.happenedAt} className="text-[10px] font-semibold text-[#78968C]">
              {formatPublicGameNewsDate(item.happenedAt)}
            </time>
          </span>
          <span className="mt-1 block text-sm font-black leading-5 text-white">
            {item.title}
          </span>
          <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5 text-[#9FB8AE]">
            {item.detail}
          </span>
        </span>
      </Link>
    </li>
  );
}

function UciLeadersCard({ rankings }: { rankings: UciRankings | null }) {
  const riders = rankings?.riders.slice(0, 10) ?? [];
  const nations = rankings?.nations.slice(0, 10) ?? [];

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.08)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#315B3E]/10 px-5 py-4 sm:px-7">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Leaders UCI
          </p>
          <h3 className="mt-1 text-lg font-black text-[#082A2A]">
            Coureurs et nations de référence
          </h3>
        </div>
        <Link href="/jeu/classements?vue=individuel" className="text-xs font-black text-[#176951] hover:text-[#278B70]">
          Tous les classements →
        </Link>
      </header>

      {riders.length || nations.length ? (
        <div className="grid divide-y divide-[#315B3E]/10 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <CompactRiderRanking entries={riders} />
          <CompactNationRanking entries={nations} />
        </div>
      ) : (
        <EmptyOverviewState>
          Les tops UCI seront disponibles dès l’attribution des premiers points.
        </EmptyOverviewState>
      )}
    </article>
  );
}

function CompactRiderRanking({ entries }: { entries: RiderRankingEntry[] }) {
  return (
    <section aria-labelledby="dashboard-rider-top-title" className="p-5 sm:p-6">
      <h4 id="dashboard-rider-top-title" className="text-xs font-black uppercase tracking-[0.14em] text-[#60756E]">
        Top 10 coureurs
      </h4>
      <ol className="mt-3 divide-y divide-[#315B3E]/10">
        {entries.slice(0, 5).map((entry) => <RiderLeaderRow key={entry.riderId} entry={entry} />)}
      </ol>
      {entries.length > 5 ? (
        <details className="group/top mt-2">
          <summary className="cursor-pointer list-none rounded-lg bg-[#F4F8F6] px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.11em] text-[#176951] hover:bg-[#E8F7F1] [&::-webkit-details-marker]:hidden">
            <span className="group-open/top:hidden">Afficher les rangs 6 à 10</span>
            <span className="hidden group-open/top:inline">Réduire le classement</span>
          </summary>
          <ol className="divide-y divide-[#315B3E]/10">
            {entries.slice(5).map((entry) => <RiderLeaderRow key={entry.riderId} entry={entry} />)}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

function RiderLeaderRow({ entry }: { entry: RiderRankingEntry }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5">
      <span className="text-center text-xs font-black text-[#789087]">#{entry.rank}</span>
      <span className="min-w-0">
        <Link href={`/jeu/coureurs/${entry.riderId}`} className="block truncate text-sm font-black text-[#183F37] hover:text-[#278B70]">
          {entry.riderName}
        </Link>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] font-semibold text-[#789087]">
          <span className={`fi fi-${entry.countryCode.toLowerCase()} rounded`} />
          {entry.teamName ?? "Agent libre"}
        </span>
      </span>
      <span className="text-xs font-black tabular-nums text-[#315B3E]">{formatPoints(entry.points)}</span>
    </li>
  );
}

function CompactNationRanking({ entries }: { entries: NationRankingEntry[] }) {
  return (
    <section aria-labelledby="dashboard-nation-top-title" className="p-5 sm:p-6">
      <h4 id="dashboard-nation-top-title" className="text-xs font-black uppercase tracking-[0.14em] text-[#60756E]">
        Top 10 nations
      </h4>
      <ol className="mt-3 divide-y divide-[#315B3E]/10">
        {entries.slice(0, 5).map((entry) => <NationLeaderRow key={entry.countryCode} entry={entry} />)}
      </ol>
      {entries.length > 5 ? (
        <details className="group/nations mt-2">
          <summary className="cursor-pointer list-none rounded-lg bg-[#F4F8F6] px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.11em] text-[#176951] hover:bg-[#E8F7F1] [&::-webkit-details-marker]:hidden">
            <span className="group-open/nations:hidden">Afficher les rangs 6 à 10</span>
            <span className="hidden group-open/nations:inline">Réduire le classement</span>
          </summary>
          <ol className="divide-y divide-[#315B3E]/10">
            {entries.slice(5).map((entry) => <NationLeaderRow key={entry.countryCode} entry={entry} />)}
          </ol>
        </details>
      ) : null}
    </section>
  );
}

function NationLeaderRow({ entry }: { entry: NationRankingEntry }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5">
      <span className="text-center text-xs font-black text-[#789087]">#{entry.rank}</span>
      <Link
        href={`/jeu/nations/${entry.countryCode.toLowerCase()}`}
        className="flex min-w-0 items-center gap-2 text-sm font-black text-[#183F37] hover:text-[#278B70]"
      >
        <span className={`fi fi-${entry.countryCode.toLowerCase()} shrink-0 rounded`} />
        <span className="truncate">{entry.countryName}</span>
      </Link>
      <span className="text-xs font-black tabular-nums text-[#315B3E]">{formatPoints(entry.points)}</span>
    </li>
  );
}

function CardFooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-t border-[#315B3E]/10 bg-[#F8FBF9] px-5 py-3 text-xs font-black text-[#176951] transition hover:bg-[#E8F7F1] sm:px-7"
    >
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function EmptyOverviewState({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-6 py-8 text-sm font-semibold leading-6 text-[#60756E]">
      {children}
    </p>
  );
}

export function getTeamRankingWindow(
  entries: TeamRankingEntry[],
  currentIndex: number,
  radius: number,
) {
  const desiredLength = Math.min(entries.length, radius * 2 + 1);
  let start = Math.max(0, currentIndex - radius);
  const end = Math.min(entries.length, start + desiredLength);
  start = Math.max(0, end - desiredLength);
  return entries.slice(start, end);
}

export function getUpcomingRaces(
  calendar: SeasonRaceCalendar,
  limit: number,
): UpcomingRace[] {
  return calendar.editions
    .flatMap((edition) => {
      const activeStages = edition.stages.filter(
        (stage) => stage.status !== "cancelled",
      );
      if (!activeStages.length) return [];
      const startDayNumber = Math.min(...activeStages.map((stage) => stage.dayNumber));
      const endDayNumber = Math.max(...activeStages.map((stage) => stage.dayNumber));
      if (endDayNumber < calendar.currentDayNumber || edition.status === "cancelled" || edition.status === "completed") {
        return [];
      }
      const nextStage = activeStages
        .filter((stage) => stage.dayNumber >= calendar.currentDayNumber)
        .sort((left, right) => left.dayNumber - right.dayNumber || left.stageNumber - right.stageNumber)[0];
      if (!nextStage) return [];
      return [{ edition, nextDayNumber: nextStage.dayNumber, startDayNumber, endDayNumber }];
    })
    .sort(
      (left, right) =>
        left.nextDayNumber - right.nextDayNumber ||
        left.edition.prestigeRank - right.edition.prestigeRank ||
        left.edition.name.localeCompare(right.edition.name, "fr"),
    )
    .slice(0, Math.max(0, limit));
}

function formatRank(rank: number) {
  return rank === 1 ? "1re" : `${rank}e`;
}

function formatPoints(points: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(points);
}

function formatRaceDays(startDay: number, endDay: number) {
  return startDay === endDay ? `J${startDay}` : `J${startDay}–J${endDay}`;
}

function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00Z`));
}
