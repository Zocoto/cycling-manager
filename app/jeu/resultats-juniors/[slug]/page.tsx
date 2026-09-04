import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import Link from "@/components/ui/app-link";
import { RACE_PROFILE_LABELS } from "@/lib/game/race-calendar";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getJuniorChampionshipResultPage } from "@/services/junior-championship-results";

export const metadata: Metadata = {
  title: "Résultats juniors officiels",
  description:
    "Consultez directement les résultats des championnats internationaux juniors.",
};

type JuniorChampionshipResultsPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function JuniorChampionshipResultsPage({
  params,
}: JuniorChampionshipResultsPageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) redirect("/connexion");

  const [headerData, snapshot] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getJuniorChampionshipResultPage(slug),
  ]);
  if (!snapshot) notFound();

  const results = snapshot.results
    .filter((result) => result.scope === "general")
    .sort((left, right) => left.rank - right.rank);
  const isWorld = snapshot.race.competitionType.startsWith("world_");
  const isNationsCup =
    snapshot.race.competitionType === "nations_cup_junior";
  const isTimeTrial = snapshot.race.competitionType.endsWith("time_trial");

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1350px] px-4 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu/calendrier"
          className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-xs font-black text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          ← Retour au calendrier
        </Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_22px_60px_rgba(11,48,43,0.2)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#0085C7_0_20%,#E31837_20%_40%,#111827_40%_60%,#FFD100_60%_80%,#009B3A_80%_100%)]"
          />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#BDE4D6]">
                  {isNationsCup
                    ? "Nations Cup juniors"
                    : isWorld
                      ? "Championnat du monde junior"
                      : "Championnat continental junior"}
                </span>
                <span className="rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#273018]">
                  {isTimeTrial ? "Contre-la-montre" : "Course en ligne"}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                {snapshot.race.name}
              </h1>
              <p className="mt-3 text-sm font-semibold text-[#C7DBD2]">
                J{snapshot.race.startDayNumber} · {snapshot.race.locationName} ·{" "}
                {RACE_PROFILE_LABELS[snapshot.race.profileType]}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right">
              <p className="text-3xl font-black text-[#F2C94C]">
                {snapshot.selectedRiderCount}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#C7DBD2]">
                sélectionnés par les fédérations
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-sm">
          <div className="border-b border-[#315B3E]/10 px-5 py-5 sm:px-8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
              Publication officielle
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Classement final
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#60756E]">
              Cette épreuve n’a pas de direct visuel : son classement est publié
              ici dès la validation des résultats.
            </p>
          </div>

          {results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-[#0B302B] text-[10px] font-black uppercase tracking-[0.14em] text-white">
                  <tr>
                    <th className="w-20 px-5 py-3 text-center">#</th>
                    <th className="px-4 py-3">Coureur</th>
                    <th className="px-4 py-3">Nation</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-5 py-3 text-right">Temps / écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#315B3E]/10">
                  {results.map((result) => (
                    <tr
                      key={result.id}
                      className={
                        result.rank <= 3
                          ? "bg-[#FFF9DE]"
                          : "odd:bg-white even:bg-[#F8FBF9]"
                      }
                    >
                      <td className="px-5 py-4 text-center text-base font-black text-[#176951]">
                        {result.rank}
                      </td>
                      <td className="px-4 py-4 font-black text-[#183F37]">
                        {result.academyRiderId ? (
                          <Link
                            href={`/jeu/centre-de-formation/development/${result.academyRiderId}`}
                            className="hover:text-[#176951] hover:underline"
                          >
                            {result.riderName}
                          </Link>
                        ) : (
                          result.riderName
                        )}
                      </td>
                      <td className="px-4 py-4 font-bold text-[#60756E]">
                        <span
                          className={`fi fi-${result.countryCode.toLowerCase()} mr-2 rounded-sm`}
                        />
                        {result.teamName}
                      </td>
                      <td className="px-4 py-4 text-right font-black text-[#B57B00]">
                        {result.points || "—"}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-black text-[#183F37]">
                        {result.gapToWinnerSeconds === 0
                          ? formatRaceTime(result.elapsedTimeSeconds)
                          : `+${formatGap(result.gapToWinnerSeconds)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="font-black text-[#183F37]">
                Le résultat n’est pas encore publié.
              </p>
              <p className="mt-2 text-sm font-semibold text-[#60756E]">
                Les sélections sont consultables dès maintenant ; le classement
                apparaîtra automatiquement après la course.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function formatRaceTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")} min ${String(seconds).padStart(2, "0")} s`;
}

function formatGap(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes} min ${String(seconds).padStart(2, "0")} s`
    : `${seconds} s`;
}
