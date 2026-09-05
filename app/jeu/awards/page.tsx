import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import Link from "@/components/ui/app-link";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getSeasonAwards, type SeasonAward } from "@/services/season-awards";

export const metadata: Metadata = {
  title: "Awards du peloton",
  description: "Les distinctions collectives et individuelles de chaque saison.",
};

const awardSymbols: Record<SeasonAward["key"], string> = {
  rider_of_year: "★",
  team_of_year: "◆",
  serial_winner: "✦",
  young_rider: "↗",
  director_of_year: "♟",
};

export default async function SeasonAwardsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");
  const [headerData, awards] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getSeasonAwards(supabase),
  ]);
  const seasons = groupAwardsBySeason(awards);

  return (
    <main className="min-h-screen bg-[#F5F0E3] text-[#082A2A]">
      <GameHeader simulatorEmail={user.email} displayName={headerData.displayName} sponsor={headerData.teamSponsorIdentity?.sponsor ?? null} maxWidth="wide" />
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />
        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#3C2B10,#7A5818_55%,#B88A2E)] px-6 py-8 text-white shadow-xl sm:px-10">
          <div aria-hidden="true" className="absolute -right-12 -top-24 text-[18rem] font-black leading-none text-white/5">★</div>
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FFE39A]">Cérémonie de fin de saison</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">Awards du peloton</h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#FFF0C7]">
              Cinq distinctions sont figées à chaque clôture : coureur, équipe, chasseur de bouquets, révélation et Directeur Sportif de l’année.
            </p>
          </div>
        </header>

        {seasons.length ? seasons.map(({ seasonId, seasonName, gameYear, awards: seasonAwards }) => (
          <section key={seasonId} className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A711F]">Palmarès officiel</p>
                <h2 className="mt-1 text-2xl font-black text-[#3C2B10]">{seasonName}</h2>
              </div>
              <span className="text-sm font-black text-[#9A711F]">{gameYear}</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {seasonAwards.map((award) => <AwardCard key={award.id} award={award} />)}
            </div>
          </section>
        )) : (
          <div className="mt-7 rounded-2xl border border-dashed border-[#9A711F]/30 bg-white/70 px-6 py-10 text-center">
            <p className="font-black text-[#3C2B10]">La première cérémonie se prépare.</p>
            <p className="mt-2 text-sm font-semibold text-[#756445]">Les lauréats apparaîtront automatiquement à la prochaine clôture de saison.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function AwardCard({ award }: { award: SeasonAward }) {
  const href = award.riderId
    ? `/jeu/coureurs/${award.riderId}`
    : award.teamId
      ? `/jeu/equipes/${award.teamId}`
      : null;
  const name = <span className="text-lg font-black text-[#3C2B10]">{award.recipientName}</span>;
  return (
    <article className="rounded-2xl border border-[#B88A2E]/25 bg-white p-5 shadow-[0_12px_30px_rgba(77,55,14,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9A711F]">{award.title}</p>
          <div className="mt-2">{href ? <Link href={href} className="hover:underline">{name}</Link> : name}</div>
        </div>
        <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-[#F6E8BD] text-xl font-black text-[#9A711F]">{awardSymbols[award.key]}</span>
      </div>
      {award.teamName && award.teamName !== award.recipientName ? <p className="mt-1 text-xs font-bold text-[#756445]">{award.teamName}</p> : null}
      <p className="mt-3 text-xs font-semibold leading-5 text-[#756445]">{award.description}</p>
      {award.statValue !== null && award.statLabel ? <p className="mt-4 border-t border-[#B88A2E]/15 pt-3 text-sm font-black text-[#9A711F]">{award.statValue.toLocaleString("fr-FR")} {award.statLabel}</p> : null}
    </article>
  );
}

function groupAwardsBySeason(awards: SeasonAward[]) {
  const groups = new Map<string, { seasonId: string; seasonName: string; gameYear: number; awards: SeasonAward[] }>();
  for (const award of awards) {
    const group = groups.get(award.seasonId) ?? { seasonId: award.seasonId, seasonName: award.seasonName, gameYear: award.gameYear, awards: [] };
    group.awards.push(award);
    groups.set(award.seasonId, group);
  }
  return [...groups.values()].sort((left, right) => right.gameYear - left.gameYear);
}
