import Link from "@/components/ui/app-link";
import { DashboardEventsCard } from "@/components/game/dashboard-events-card";
import type { DashboardEvent } from "@/lib/game/dashboard-events";
import {
  formatPublicGameNewsDate,
  getPublicGameNewsTeamColors,
  type PublicGameNewsItem,
} from "@/lib/game/public-game-news";
import { getTeamSportingStatusLabel } from "@/lib/game/team-divisions";
import type {
  NationRankingEntry,
  RiderRankingEntry,
  TeamRankingEntry,
  UciRankings,
} from "@/services/uci-rankings";

export function DashboardMonitoringOverview({
  teamId,
  dashboardEvents,
  rankings,
  pelotonNews,
}: {
  teamId: string | null;
  dashboardEvents: DashboardEvent[];
  rankings: UciRankings | null;
  pelotonNews: PublicGameNewsItem[];
}) {
  return (
    <section aria-labelledby="dashboard-monitoring-title" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">
            Centre de monitoring
          </p>
          <h2
            id="dashboard-monitoring-title"
            className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#082A2A]"
          >
            L’essentiel, sans bruit
          </h2>
        </div>
        <p className="text-xs font-bold text-[#60756E]">
          {rankings?.seasonName ?? "Saison active"}
        </p>
      </div>

      <div className="mt-5 grid items-stretch gap-6 xl:grid-cols-2">
        <div className="h-full" data-tutorial-id="dashboard-news-feed">
          <DashboardEventsCard events={dashboardEvents} />
        </div>
        <PelotonHighlightsCard items={pelotonNews} />
      </div>

      <div
        className="mt-6 grid items-start gap-6 lg:grid-cols-3"
        aria-label="Aperçu des classements UCI"
      >
        <TeamLeadersCard teamId={teamId} entries={rankings?.teams ?? []} />
        <RiderLeadersCard entries={rankings?.riders ?? []} />
        <NationLeadersCard entries={rankings?.nations ?? []} />
      </div>
    </section>
  );
}

function PelotonHighlightsCard({ items }: { items: PublicGameNewsItem[] }) {
  const visibleItems = items.slice(0, 3);
  const additionalItems = items.slice(3);

  return (
    <section
      aria-labelledby="dashboard-highlights-title"
      className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-[#0B302B] text-white shadow-[0_24px_70px_rgba(19,60,46,0.13)]"
    >
      <header className="flex min-h-[118px] items-center justify-between gap-4 px-6 py-4 sm:px-8">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8ED9B1]">
            Vie du peloton
          </p>
          <h2
            id="dashboard-highlights-title"
            className="mt-1.5 text-xl font-black tracking-[-0.02em]"
          >
            Temps forts
          </h2>
          <p className="mt-0.5 text-sm font-semibold text-[#BDD1C7]">
            Victoires, arrivées et signatures qui font bouger le jeu.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-extrabold text-white">
          {items.length} info{items.length > 1 ? "s" : ""}
        </span>
      </header>

      <div className="flex flex-1 flex-col border-t border-white/10">
        {visibleItems.length ? (
          <ol className="flex-1 divide-y divide-white/10">
            {visibleItems.map((item) => (
              <PelotonNewsRow key={item.id} item={item} />
            ))}
          </ol>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-xl text-[#9BE0BC]"
            >
              ✓
            </span>
            <p className="mt-3 text-sm font-black text-white">
              Le peloton est calme
            </p>
            <p className="mt-1 max-w-sm text-xs font-semibold leading-5 text-[#9FB8AE]">
              Les prochaines victoires, signatures et arrivées apparaîtront ici.
            </p>
          </div>
        )}

        {additionalItems.length ? (
          <details className="group/more border-t border-white/10">
            <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-3 text-xs font-black text-[#9BE0BC] transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F2C94C] [&::-webkit-details-marker]:hidden sm:px-8">
              <span className="group-open/more:hidden">
                Afficher {additionalItems.length} autre
                {additionalItems.length > 1 ? "s" : ""} temps fort
                {additionalItems.length > 1 ? "s" : ""}
              </span>
              <span className="hidden group-open/more:inline">
                Réduire les temps forts
              </span>
              <span
                aria-hidden="true"
                className="transition-transform group-open/more:rotate-180"
              >
                ⌄
              </span>
            </summary>
            <ol className="divide-y divide-white/10 border-t border-white/10">
              {additionalItems.map((item) => (
                <PelotonNewsRow key={item.id} item={item} />
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function PelotonNewsRow({ item }: { item: PublicGameNewsItem }) {
  const presentation = getNewsPresentation(item);
  const teamColors = getPublicGameNewsTeamColors(item);

  return (
    <li>
      <Link
        href={presentation.href}
        className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-6 py-3.5 transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F2C94C] sm:px-8"
      >
        <span
          aria-hidden="true"
          data-team-colors={teamColors ? "team" : undefined}
          className={`mt-1 h-2.5 w-2.5 rounded-full ${teamColors ? "" : presentation.dotClassName}`}
          style={
            teamColors
              ? {
                  background: `linear-gradient(135deg, ${teamColors.primary} 0 55%, ${teamColors.secondary} 55% 100%)`,
                  boxShadow: `0 0 0 1px ${teamColors.accent}`,
                }
              : undefined
          }
        />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#9BE0BC]">
              {presentation.label}
            </span>
            <time
              dateTime={item.happenedAt}
              className="text-[10px] font-semibold text-[#78968C]"
            >
              {formatPublicGameNewsDate(item.happenedAt)}
            </time>
          </span>
          <span className="mt-1 block truncate text-sm font-black leading-5 text-white">
            {item.title}
          </span>
          <span className="mt-0.5 line-clamp-1 block text-xs font-semibold leading-5 text-[#9FB8AE]">
            {item.detail}
          </span>
        </span>
      </Link>
    </li>
  );
}

function getNewsPresentation(item: PublicGameNewsItem) {
  if (item.id.startsWith("sponsor:")) {
    return {
      label: "Nouveau sponsor",
      href: "/jeu/sponsoring",
      dotClassName: "bg-[#D49BFF]",
    };
  }

  if (item.kind === "victory") {
    return {
      label: "Victoire",
      href: item.href ?? "/jeu/resultats",
      dotClassName: "bg-[#F2C94C]",
    };
  }

  if (item.kind === "movement") {
    return {
      label: "Transfert",
      href: "/jeu/transferts",
      dotClassName: "bg-[#8AB8F8]",
    };
  }

  if (item.kind === "staff") {
    return {
      label: "Signature staff",
      href: "/jeu/staff",
      dotClassName: "bg-[#E1A4F5]",
    };
  }

  if (item.kind === "arrival") {
    return {
      label: "Nouveau DS",
      href: item.href ?? "/jeu/classements?vue=equipes",
      dotClassName: "bg-[#42CDA8]",
    };
  }

  return {
    label: "Résultat",
    href: item.href ?? "/jeu/resultats",
    dotClassName: "bg-[#42CDA8]",
  };
}

function TeamLeadersCard({
  teamId,
  entries,
}: {
  teamId: string | null;
  entries: TeamRankingEntry[];
}) {
  const topEntries = entries.slice(0, 10);
  const currentTeam = teamId
    ? entries.find((entry) => entry.teamId === teamId) ?? null
    : null;

  return (
    <RankingCard
      id="dashboard-team-ranking"
      eyebrow="Classement UCI"
      title="Équipes"
      badge={currentTeam ? `Vous · #${currentTeam.rank}` : "Top 10"}
      href="/jeu/classements?vue=equipes"
      entries={topEntries.map((entry) => (
        <TeamLeaderRow
          key={entry.teamId}
          entry={entry}
          isCurrent={entry.teamId === teamId}
        />
      ))}
    />
  );
}

function RiderLeadersCard({ entries }: { entries: RiderRankingEntry[] }) {
  return (
    <RankingCard
      id="dashboard-rider-ranking"
      eyebrow="Classement UCI"
      title="Coureurs"
      badge="Top 10"
      href="/jeu/classements?vue=individuel"
      entries={entries.slice(0, 10).map((entry) => (
        <RiderLeaderRow key={entry.riderId} entry={entry} />
      ))}
    />
  );
}

function NationLeadersCard({ entries }: { entries: NationRankingEntry[] }) {
  return (
    <RankingCard
      id="dashboard-nation-ranking"
      eyebrow="Classement UCI"
      title="Pays"
      badge="Top 10"
      href="/jeu/classements?vue=nations"
      entries={entries.slice(0, 10).map((entry) => (
        <NationLeaderRow key={entry.countryCode} entry={entry} />
      ))}
    />
  );
}

function RankingCard({
  id,
  eyebrow,
  title,
  badge,
  href,
  entries,
}: {
  id: string;
  eyebrow: string;
  title: string;
  badge: string;
  href: string;
  entries: React.ReactNode[];
}) {
  const visibleEntries = entries.slice(0, 5);
  const additionalEntries = entries.slice(5, 10);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-white shadow-[0_18px_50px_rgba(19,60,46,0.09)]">
      <header className="flex min-h-20 items-center justify-between gap-3 border-b border-[#315B3E]/10 bg-[linear-gradient(145deg,#F8FBF9,#EEF6F2)] px-5 py-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#278B70]">
            {eyebrow}
          </p>
          <h3 id={id} className="mt-1 text-lg font-black text-[#082A2A]">
            {title}
          </h3>
        </div>
        <span className="rounded-full bg-[#0B302B] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#F2C94C]">
          {badge}
        </span>
      </header>

      {entries.length ? (
        <>
          <ol aria-labelledby={id} className="flex-1 divide-y divide-[#315B3E]/10 px-4">
            {visibleEntries}
          </ol>
          {additionalEntries.length ? (
            <details className="group/ranking border-t border-[#315B3E]/10">
              <summary className="cursor-pointer list-none bg-[#F8FBF9] px-5 py-3 text-center text-[10px] font-black uppercase tracking-[0.1em] text-[#176951] transition hover:bg-[#E8F7F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70] [&::-webkit-details-marker]:hidden">
                <span className="group-open/ranking:hidden">
                  Afficher les rangs 6 à 10
                </span>
                <span className="hidden group-open/ranking:inline">
                  Réduire le classement
                </span>
              </summary>
              <ol
                aria-label={`${title}, rangs 6 à 10`}
                className="divide-y divide-[#315B3E]/10 border-t border-[#315B3E]/10 px-4"
              >
                {additionalEntries}
              </ol>
            </details>
          ) : null}
        </>
      ) : (
        <p className="flex flex-1 items-center px-6 py-8 text-sm font-semibold leading-6 text-[#60756E]">
          Ce classement apparaîtra dès l’attribution des premiers points UCI.
        </p>
      )}

      <Link
        href={href}
        className="flex items-center justify-between border-t border-[#315B3E]/10 bg-white px-5 py-3 text-xs font-black text-[#176951] transition hover:bg-[#E8F7F1]"
      >
        Classement complet
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

function TeamLeaderRow({
  entry,
  isCurrent,
}: {
  entry: TeamRankingEntry;
  isCurrent: boolean;
}) {
  return (
    <li
      aria-current={isCurrent ? "true" : undefined}
      className={`grid min-h-[58px] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 px-1 py-2 ${
        isCurrent ? "rounded-lg bg-[#FFF7D9]" : ""
      }`}
    >
      <span className={`text-center text-xs font-black ${isCurrent ? "text-[#8A6812]" : "text-[#789087]"}`}>
        #{entry.rank}
      </span>
      <span className="min-w-0">
        <Link
          href={`/jeu/equipes/${entry.teamId}`}
          className={`block truncate text-sm font-black hover:text-[#278B70] ${
            isCurrent ? "text-[#5F4708]" : "text-[#183F37]"
          }`}
        >
          {entry.teamName}
        </Link>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#789087]">
          {getTeamSportingStatusLabel(
            entry.division,
            entry.isProfessional
          )}
          {isCurrent ? " · votre équipe" : ""}
        </span>
      </span>
      <span className={`text-xs font-black tabular-nums ${isCurrent ? "text-[#8A6812]" : "text-[#315B3E]"}`}>
        {formatPoints(entry.points)}
      </span>
    </li>
  );
}

function RiderLeaderRow({ entry }: { entry: RiderRankingEntry }) {
  return (
    <li className="grid min-h-[58px] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 px-1 py-2">
      <span className="text-center text-xs font-black text-[#789087]">
        #{entry.rank}
      </span>
      <span className="min-w-0">
        <Link
          href={`/jeu/coureurs/${entry.riderId}`}
          className="block truncate text-sm font-black text-[#183F37] hover:text-[#278B70]"
        >
          {entry.riderName}
        </Link>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] font-semibold text-[#789087]">
          <span className={`fi fi-${entry.countryCode.toLowerCase()} rounded`} />
          {entry.teamName ?? "Agent libre"}
        </span>
      </span>
      <span className="text-xs font-black tabular-nums text-[#315B3E]">
        {formatPoints(entry.points)}
      </span>
    </li>
  );
}

function NationLeaderRow({ entry }: { entry: NationRankingEntry }) {
  return (
    <li className="grid min-h-[58px] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 px-1 py-2">
      <span className="text-center text-xs font-black text-[#789087]">
        #{entry.rank}
      </span>
      <span className="min-w-0">
        <Link
          href={`/jeu/nations/${entry.countryCode.toLowerCase()}`}
          className="flex min-w-0 items-center gap-2 text-sm font-black text-[#183F37] hover:text-[#278B70]"
        >
          <span
            className={`fi fi-${entry.countryCode.toLowerCase()} shrink-0 rounded`}
          />
          <span className="truncate">{entry.countryName}</span>
        </Link>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-[#789087]">
          {entry.riderCount} coureur{entry.riderCount > 1 ? "s" : ""} classé
          {entry.riderCount > 1 ? "s" : ""}
        </span>
      </span>
      <span className="text-xs font-black tabular-nums text-[#315B3E]">
        {formatPoints(entry.points)}
      </span>
    </li>
  );
}

function formatPoints(points: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(points);
}
