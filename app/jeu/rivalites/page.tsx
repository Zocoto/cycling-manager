import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import Link from "@/components/ui/app-link";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentTeamRivalries, type TeamRivalry } from "@/services/team-rivalries";

export const metadata: Metadata = {
  title: "Rivalités d’équipes",
  description: "Les duels sportifs qui rythment la saison.",
};

export default async function TeamRivalriesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [headerData, rivalries] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamRivalries(supabase),
  ]);
  const active = rivalries.filter((rivalry) => rivalry.status === "active");
  const history = rivalries.filter((rivalry) => rivalry.status === "completed");

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorIdentity?.sponsor ?? null} maxWidth="wide" />
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />
        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#0B302B_55%,#7A253E)] px-6 py-8 text-white shadow-xl sm:px-10">
          <div aria-hidden="true" className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[52px] border-white/5" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F7A8BE]">Feuilleton de la saison</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">Rivalités d’équipes</h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
              Deux équipes humaines proches au classement sont associées. Chaque course commune fait évoluer le duel ; le bilan final récompense les deux DS, avec une prime au vainqueur.
            </p>
          </div>
        </header>

        <section className="mt-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176951]">En cours</p>
          {active.length ? (
            <div className="mt-3 grid gap-5 lg:grid-cols-2">
              {active.map((rivalry) => <RivalryCard key={rivalry.id} rivalry={rivalry} />)}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[#315B3E]/25 bg-white px-6 py-8 text-sm font-semibold leading-6 text-[#60756E]">
              Aucune rivalité active pour le moment. Les duels sont créés automatiquement entre équipes humaines au début de la saison, ou dès qu’un nouvel adversaire est disponible.
            </div>
          )}
        </section>

        {history.length ? (
          <section className="mt-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176951]">Archives</p>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {history.map((rivalry) => <RivalryCard key={rivalry.id} rivalry={rivalry} />)}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function RivalryCard({ rivalry }: { rivalry: TeamRivalry }) {
  const ownIsA = rivalry.ownTeamId === rivalry.teamA.id;
  const opponent = ownIsA ? rivalry.teamB : rivalry.teamA;
  const own = ownIsA ? rivalry.teamA : rivalry.teamB;
  const totalDecisive = Math.max(1, rivalry.teamA.wins + rivalry.teamB.wins);
  const intensityLabel = rivalry.intensity >= 35 ? "Brûlante" : rivalry.intensity >= 15 ? "Installée" : "Naissante";
  const result = rivalry.status === "completed"
    ? rivalry.winnerTeamId === null
      ? "Égalité finale"
      : rivalry.winnerTeamId === rivalry.ownTeamId
        ? "Rivalité remportée"
        : "Rivalité perdue"
    : "Duel actif";

  return (
    <article className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_14px_35px_rgba(19,60,46,0.08)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#315B3E]/10 bg-[#F7FBF8] px-5 py-3">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#176951]">{rivalry.seasonName}</span>
        <span className="rounded-full bg-[#7A253E]/10 px-2.5 py-1 text-[9px] font-black uppercase text-[#7A253E]">{result}</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <TeamIdentity team={own} isOwn />
          <div>
            <p className="text-3xl font-black tabular-nums text-[#183F37]">{own.wins}<span className="mx-2 text-[#B4C2BD]">–</span>{opponent.wins}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#789087]">{rivalry.draws} nul{rivalry.draws > 1 ? "s" : ""}</p>
          </div>
          <TeamIdentity team={opponent} />
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E4ECE8]">
          <div className="h-full bg-[#176951]" style={{ width: `${Math.round((own.wins / totalDecisive) * 100)}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px] font-bold text-[#60756E]">
          <span>{rivalry.sharedRaces} confrontation{rivalry.sharedRaces > 1 ? "s" : ""}</span>
          <span>Intensité {intensityLabel.toLowerCase()} · {rivalry.intensity}</span>
          {rivalry.ownReputationDelta !== null ? <span className="text-[#176951]">+{rivalry.ownReputationDelta} réputation</span> : null}
        </div>
      </div>
    </article>
  );
}

function TeamIdentity({ team, isOwn = false }: { team: TeamRivalry["teamA"]; isOwn?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-wider text-[#789087]">{isOwn ? "Votre équipe" : "Adversaire"}</p>
      <Link href={`/jeu/equipes/${team.id}`} className="mt-1 block truncate text-sm font-black text-[#183F37] hover:text-[#176951]">{team.name}</Link>
      <p className="mt-1 truncate text-[10px] font-semibold text-[#60756E]">{team.directorName}</p>
    </div>
  );
}
