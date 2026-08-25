import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { TeamDivisionBadge } from "@/components/game/team-division-badge";
import { DIVISION_RULES } from "@/lib/game/economy";
import { TEAM_DIVISION_LABELS } from "@/lib/game/team-divisions";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getUciRankings,
  type NationRankingEntry,
  type RiderRankingEntry,
  type TeamRankingEntry,
} from "@/services/uci-rankings";
import {
  getJuniorRankings,
  type JuniorRankingEntry,
  type JuniorRankings,
} from "@/services/junior-rankings";

export const metadata: Metadata = {
  title: "Classements UCI",
  description: "Classements des équipes, coureurs et nations de la saison.",
};

type RankingView = "equipes" | "individuel" | "nations";
type RankingCircuit = "uci" | "juniors";

export default async function UciRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    vue?: string | string[];
    circuit?: string | string[];
    page?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawView = Array.isArray(query.vue) ? query.vue[0] : query.vue;
  const view: RankingView = isRankingView(rawView) ? rawView : "equipes";
  const rawCircuit = Array.isArray(query.circuit) ? query.circuit[0] : query.circuit;
  const circuit: RankingCircuit = rawCircuit === "juniors" ? "juniors" : "uci";
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, rankingData] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    circuit === "juniors" ? getJuniorRankings(view, page) : getUciRankings(),
  ]);
  const rankings = circuit === "uci" ? rankingData as Awaited<ReturnType<typeof getUciRankings>> : null;
  const juniorRankings = circuit === "juniors" ? rankingData as JuniorRankings | null : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <BackToOfficeLink />

        <header className="mt-5 rounded-[2rem] border border-[#315B3E]/15 bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-[#FFFDF4] shadow-[0_24px_70px_rgba(19,60,46,0.18)] sm:px-10 sm:py-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
            Hiérarchie sportive · {(rankings ?? juniorRankings)?.seasonName ?? "Saison active"}
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            {circuit === "juniors" ? "Classements juniors" : "Classements UCI"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
            {circuit === "juniors"
              ? "Les points sont consolidés à l’arrivée de chaque course. Le classement des nations additionne les cinq meilleurs juniors de chaque pays."
              : "Les points évoluent pendant la saison. La division affichée reste celle attribuée en début de saison ; le classement final déterminera la division de la saison suivante."}
          </p>
        </header>

        <nav aria-label="Circuits de classement" className="mt-6 flex flex-wrap gap-2">
          <CircuitTab href={`/jeu/classements?circuit=uci&vue=${view}`} active={circuit === "uci"}>Circuit UCI</CircuitTab>
          <CircuitTab href={`/jeu/classements?circuit=juniors&vue=${view}`} active={circuit === "juniors"}>Circuit juniors</CircuitTab>
        </nav>

        <nav aria-label="Vues du classement" className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-[#315B3E]/12 bg-white p-2 shadow-[0_10px_30px_rgba(19,60,46,0.08)]">
          <Tab href={`/jeu/classements?circuit=${circuit}&vue=equipes`} active={view === "equipes"}>Équipes</Tab>
          <Tab href={`/jeu/classements?circuit=${circuit}&vue=individuel`} active={view === "individuel"}>Individuel</Tab>
          <Tab href={`/jeu/classements?circuit=${circuit}&vue=nations`} active={view === "nations"}>Nations</Tab>
        </nav>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
          {circuit === "juniors" ? (
            <JuniorRankingContent rankings={juniorRankings} view={view} />
          ) : !rankings ? (
            <p className="px-6 py-10 text-center font-bold text-[#60756E]">Aucune saison active.</p>
          ) : view === "equipes" ? (
            <TeamsTable entries={rankings.teams} />
          ) : view === "individuel" ? (
            <RidersTable entries={rankings.riders} />
          ) : (
            <NationsTable entries={rankings.nations} />
          )}
        </section>

        {circuit === "juniors" && juniorRankings?.enabled ? (
          <RankingPagination rankings={juniorRankings} />
        ) : null}

        {circuit === "uci" && view === "equipes" ? <DivisionAdvantages /> : null}
      </section>
    </main>
  );
}

function CircuitTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={active ? "rounded-full bg-[#F2C94C] px-5 py-2.5 text-sm font-black text-[#071A17] shadow-sm" : "rounded-full border border-[#315B3E]/15 bg-white px-5 py-2.5 text-sm font-black text-[#48665F] hover:bg-[#EAF5F3]"}>
      {children}
    </Link>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? "rounded-xl bg-[#0B302B] px-5 py-3 text-sm font-extrabold text-white" : "rounded-xl px-5 py-3 text-sm font-extrabold text-[#48665F] hover:bg-[#EAF5F3]"}
    >
      {children}
    </Link>
  );
}

function TeamsTable({ entries }: { entries: TeamRankingEntry[] }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left">
      <caption className="sr-only">Classement général des équipes</caption>
      <TableHead labels={["Rang", "Équipe", "Directeur Sportif", "Points"]} />
      <tbody>{entries.map((entry) => <TeamRows key={entry.teamId} entry={entry} />)}</tbody>
    </table></div>
  );
}

function TeamRows({ entry }: { entry: TeamRankingEntry }) {
  const boundary = [1, 21, 51, 101].includes(entry.rank);
  return <>
    {boundary ? <tr><td colSpan={4} className="border-y border-[#278B70]/15 bg-[#DDF3E7] px-6 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#176951]">Projection saison suivante · {TEAM_DIVISION_LABELS[entry.projectedDivision]} à partir de la position {entry.rank}</td></tr> : null}
    <tr className="border-b border-[#315B3E]/10 text-sm hover:bg-[#F8FBF9]">
      <RankCell rank={entry.rank} />
      <td className="px-5 py-4"><Link href={`/jeu/equipes/${entry.teamId}`} className="font-black text-[#183F37] hover:text-[#278B70]">{entry.teamName}</Link><span className="mt-2 block"><TeamDivisionBadge division={entry.division} isProfessional={entry.isProfessional} compact /></span></td>
      <td className="px-5 py-4">{entry.directorUsername ? <Link href={`/jeu/directeurs-sportifs/${encodeURIComponent(entry.directorUsername)}`} className="font-bold text-[#48665F] hover:text-[#278B70]">{entry.directorName}</Link> : <span className="text-[#83938D]">Poste vacant</span>}</td>
      <PointsCell points={entry.points} />
    </tr>
  </>;
}

function RidersTable({ entries }: { entries: RiderRankingEntry[] }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left">
      <caption className="sr-only">Classement individuel des coureurs</caption>
      <TableHead labels={["Rang", "Coureur", "Équipe", "Points"]} />
      <tbody>{entries.map((entry) => <tr key={entry.riderId} className="border-b border-[#315B3E]/10 text-sm hover:bg-[#F8FBF9]">
        <RankCell rank={entry.rank} />
        <td className="px-5 py-4"><Link href={`/jeu/coureurs/${entry.riderId}`} className="font-black text-[#183F37] hover:text-[#278B70]">{entry.riderName}</Link><p className="mt-1 text-xs text-[#60756E]"><span className={`fi fi-${entry.countryCode.toLowerCase()} mr-2`} />{entry.countryName}</p></td>
        <td className="px-5 py-4">{entry.teamId ? <Link href={`/jeu/equipes/${entry.teamId}`} className="font-bold text-[#48665F] hover:text-[#278B70]">{entry.teamName}</Link> : "Agent libre"}</td>
        <PointsCell points={entry.points} />
      </tr>)}</tbody>
    </table></div>
  );
}

function NationsTable({ entries }: { entries: NationRankingEntry[] }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[660px] border-collapse text-left">
      <caption className="sr-only">Classement UCI des nations</caption>
      <TableHead labels={["Rang", "Nation", "Coureurs", "Points"]} />
      <tbody>{entries.map((entry) => <tr key={entry.countryCode} className="border-b border-[#315B3E]/10 text-sm hover:bg-[#F8FBF9]">
        <RankCell rank={entry.rank} />
        <td className="px-5 py-4"><Link href={`/jeu/nations/${entry.countryCode.toLowerCase()}`} className="inline-flex items-center gap-3 font-black text-[#183F37] hover:text-[#278B70]"><span className={`fi fi-${entry.countryCode.toLowerCase()} text-2xl`} />{entry.countryName}</Link></td>
        <td className="px-5 py-4 text-center font-bold text-[#60756E]">{entry.riderCount}</td>
        <PointsCell points={entry.points} />
      </tr>)}</tbody>
    </table></div>
  );
}

function JuniorRankingContent({ rankings, view }: { rankings: JuniorRankings | null; view: RankingView }) {
  if (!rankings) {
    return <p className="px-6 py-10 text-center font-bold text-[#60756E]">Aucune saison active.</p>;
  }
  if (!rankings.enabled) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">Ouverture programmée</p>
        <h2 className="mt-2 text-2xl font-black text-[#183F37]">Le circuit junior s’active en Saison 3</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-[#60756E]">Aucun calcul ni chargement supplémentaire n’est exécuté pendant les deux premières saisons.</p>
      </div>
    );
  }
  if (!rankings.entries.length) {
    return <p className="px-6 py-10 text-center font-bold text-[#60756E]">Le classement sera publié après la première arrivée junior.</p>;
  }
  return <JuniorTable entries={rankings.entries} view={view} />;
}

function JuniorTable({ entries, view }: { entries: JuniorRankingEntry[]; view: RankingView }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <caption className="sr-only">Classement du circuit junior</caption>
        <TableHead labels={view === "individuel" ? ["Rang", "Coureur", "Équipe", "Victoires", "Points"] : view === "equipes" ? ["Rang", "Dev Team", "Juniors classés", "Victoires", "Points"] : ["Rang", "Nation", "Base", "Victoires", "Points"]} />
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.entityKey} className="border-b border-[#315B3E]/10 text-sm hover:bg-[#F8FBF9]">
              <RankCell rank={entry.rank} />
              <td className="px-5 py-4">
                {view === "individuel" && entry.academyRiderId ? (
                  <Link href={`/jeu/centre-de-formation/development/${entry.academyRiderId}`} className="font-black text-[#183F37] hover:text-[#278B70]">{entry.displayName}</Link>
                ) : (
                  <span className="font-black text-[#183F37]">{entry.displayName}</span>
                )}
                {entry.countryCode ? <p className="mt-1 text-xs text-[#60756E]"><span className={`fi fi-${entry.countryCode.toLowerCase()} mr-2 rounded-sm`} />{entry.countryCode}</p> : null}
              </td>
              <td className="px-5 py-4 font-bold text-[#60756E]">{entry.secondaryName ?? (view === "nations" ? "Top 5" : entry.raceCount)}</td>
              <td className="px-5 py-4 text-center font-black text-[#176951]">{entry.wins}</td>
              <PointsCell points={entry.points} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingPagination({ rankings }: { rankings: JuniorRankings }) {
  if (rankings.pageCount <= 1) return null;
  const previous = Math.max(1, rankings.page - 1);
  const next = Math.min(rankings.pageCount, rankings.page + 1);
  return (
    <nav aria-label="Pagination du classement junior" className="mt-5 flex items-center justify-between rounded-2xl border border-[#315B3E]/12 bg-white px-4 py-3 text-sm font-black text-[#315B3E]">
      <Link aria-disabled={rankings.page === 1} href={`/jeu/classements?circuit=juniors&vue=${rankings.view}&page=${previous}`} className={rankings.page === 1 ? "pointer-events-none opacity-40" : "hover:text-[#176951]"}>← Précédent</Link>
      <span>Page {rankings.page} / {rankings.pageCount} · {rankings.totalEntries} classés</span>
      <Link aria-disabled={rankings.page === rankings.pageCount} href={`/jeu/classements?circuit=juniors&vue=${rankings.view}&page=${next}`} className={rankings.page === rankings.pageCount ? "pointer-events-none opacity-40" : "hover:text-[#176951]"}>Suivant →</Link>
    </nav>
  );
}

function TableHead({ labels }: { labels: string[] }) {
  return <thead className="bg-[#0B302B] text-xs font-extrabold uppercase tracking-[0.13em] text-[#9BE0BC]"><tr>{labels.map((label, index) => <th key={label} className={`px-6 py-4 ${index === 0 ? "w-24 text-center" : index === labels.length - 1 ? "text-right" : ""}`}>{label}</th>)}</tr></thead>;
}

function RankCell({ rank }: { rank: number }) { return <td className="px-6 py-4 text-center text-lg font-black text-[#176951]">#{rank}</td>; }
function PointsCell({ points }: { points: number }) { return <td className="px-6 py-4 text-right text-lg font-black text-[#183F37]">{new Intl.NumberFormat("fr-FR").format(points)}</td>; }

function DivisionAdvantages() {
  return <section className="mt-7 rounded-[2rem] bg-[#0B302B] p-6 text-white sm:p-8">
    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9BE0BC]">Affectation à la clôture</p>
    <h2 className="mt-2 text-2xl font-black">Divisions de la saison suivante</h2>
    <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#BFD1C6]">Aucun changement de division n’intervient en cours de saison. Les positions ci-dessous sont figées lors de la clôture puis appliquées à la saison suivante.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{DIVISION_RULES.map((division) => <article key={division.code} className="border-l-2 border-[#F2C94C]/60 pl-4"><h3 className="font-black text-[#F2C94C]">{division.name}</h3><p className="mt-2 text-sm font-semibold leading-6 text-[#BFD1C6]">Rangs {division.minimumRank}–{division.maximumRank} à la clôture · +{division.seasonReputationBonus} réputation sur la saison.</p></article>)}</div>
  </section>;
}

function isRankingView(value: string | undefined): value is RankingView {
  return value === "equipes" || value === "individuel" || value === "nations";
}
