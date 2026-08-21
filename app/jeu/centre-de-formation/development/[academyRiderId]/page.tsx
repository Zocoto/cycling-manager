import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound, redirect } from "next/navigation";

import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { GameHeader } from "@/components/game/game-header";
import { PotentialStars } from "@/components/game/potential-stars";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { RiderClimateProfileCard } from "@/components/game/rider-climate-profile-card";
import { RiderStatsRadar } from "@/components/game/rider-stats-radar";
import { getRiderExperience } from "@/lib/game/rider-experience";
import { createAmateurRiderJersey } from "@/lib/rider-jersey";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDevelopmentRiderProfile } from "@/services/development-team";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Fiche junior",
  description: "Consultez le profil et la carrière junior d’un coureur de l’équipe de développement.",
};

type Props = {
  params: Promise<{ academyRiderId: string }>;
};

export default async function DevelopmentRiderPage({ params }: Props) {
  const { academyRiderId } = await params;
  if (!isUuid(academyRiderId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [profile, headerData] = await Promise.all([
    getDevelopmentRiderProfile(user.id, academyRiderId),
    getGameHeaderData(supabase, user.id),
  ]);
  if (!profile) notFound();

  const team = profile.currentDevelopmentTeam;
  const jersey = team ? createAmateurRiderJersey(team.jersey) : undefined;
  const finalResults = profile.results.filter((result) => result.scope === "general");
  const wins = finalResults.filter((result) => result.rank === 1).length;
  const podiums = finalResults.filter((result) => result.rank <= 3).length;
  const experience = getRiderExperience(profile.careerRaceDays);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />
      <section className="mx-auto max-w-[1450px] px-5 py-8 sm:px-8 sm:py-11">
        <Link
          href={`/jeu/equipes/${profile.teamId}`}
          className="inline-flex items-center gap-2 text-sm font-black text-[#315B3E] transition hover:text-[#176951]"
        >
          <span aria-hidden="true">←</span> Retour à la fiche équipe
        </Link>

        <header className="mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(130deg,#071A17_0%,#0B302B_55%,#176951_100%)] text-white shadow-[0_25px_70px_rgba(19,60,46,0.2)]">
          <div className="h-2 bg-[linear-gradient(90deg,#F2C94C_0_33%,#FFFDF4_33%_66%,#278B70_66%)]" />
          <div className="grid gap-7 p-6 sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)_280px] lg:items-center">
            <div className="relative w-fit">
              <RiderAvatar
                profileKey={profile.profileKey}
                seed={profile.avatarSeed}
                riderId={profile.id}
                age={profile.age}
                jersey={jersey}
                label={`Portrait de ${profile.firstName} ${profile.lastName}`}
                className="h-44 w-44 rounded-[2rem] border-2 border-white/25 shadow-2xl sm:h-52 sm:w-52"
              />
              {profile.raceNumber ? (
                <span className="absolute -bottom-3 -right-3 grid h-12 w-12 place-items-center rounded-xl border-2 border-white/70 bg-[#F2C94C] text-lg font-black text-[#071A17] shadow-xl">
                  {profile.raceNumber}
                </span>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#071A17]">
                  Coureur junior
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#D7EBE4]">
                  Années U19
                </span>
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                {profile.firstName} {profile.lastName}
              </h1>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                <IdentityBadge>{profile.age} ans</IdentityBadge>
                <IdentityBadge>
                  <span className={`fi fi-${profile.countryCode.toLowerCase()} mr-2 rounded-sm`} />
                  {profile.countryName}
                </IdentityBadge>
                <IdentityBadge>{profile.sportingProfile}</IdentityBadge>
                <IdentityBadge>Formation · {profile.trainingPriority}</IdentityBadge>
              </div>
              <div className="mt-5 inline-flex rounded-xl border border-white/15 bg-white/10 px-4 py-2">
                <PotentialStars potentialSteps={profile.potentialSteps} dark compact />
              </div>
            </div>

            {team ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <AmateurTeamJersey
                  jersey={team.jersey}
                  teamName={team.displayName}
                  className="mx-auto h-40 w-32 drop-shadow-xl"
                />
                <p className="mt-2 text-sm font-black">{team.displayName}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#9BE0CA]">
                  Équipe junior
                </p>
              </div>
            ) : null}
          </div>
        </header>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
          <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
              Profil sportif
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Caractéristiques actuelles
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#60756E]">
              Les notes évoluent avec les entraînements de l’École de cyclisme et sont
              immédiatement reprises par l’équipe de développement.
            </p>
            <div className="mt-4">
              <RiderStatsRadar ratings={profile.ratings} />
            </div>
          </section>

          <div className="space-y-5">
            <RiderClimateProfileCard profile={profile.climateProfile} />
            <section className="rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
                Bilan junior
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <CareerMetric value={finalResults.length} label="Courses" />
                <CareerMetric value={podiums} label="Podiums" />
                <CareerMetric value={wins} label="Victoires" />
              </div>
              <div className="mt-4 rounded-xl bg-[#EAF5F3] px-4 py-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                      Expérience
                    </p>
                    <p className="mt-1 text-sm font-black text-[#183F37]">
                      {experience.level}
                    </p>
                  </div>
                  <p className="text-right text-xl font-black text-[#176951]">
                    {experience.score}
                    <span className="text-[10px] text-[#60756E]"> / 100 XP</span>
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#278B70]"
                    style={{ width: `${experience.score}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] font-bold text-[#60756E]">
                  {experience.raceDays} jour{experience.raceDays > 1 ? "s" : ""} de course disputé{experience.raceDays > 1 ? "s" : ""} avec la Devteam
                </p>
              </div>
              {profile.promotionGameYear ? (
                <p className="mt-4 rounded-xl bg-[#FFF3BC] px-3 py-3 text-xs font-black text-[#705400]">
                  Passage professionnel programmé pour la saison {profile.promotionGameYear}.
                </p>
              ) : null}
            </section>
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-sm">
          <div className="p-5 sm:p-7">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">Carrière</p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">Historique des saisons</h2>
            <p className="mt-2 text-sm font-semibold text-[#60756E]">
              Les saisons courues ici restent identifiées comme années juniors lors du passage chez les professionnels.
            </p>
          </div>
          <div className="overflow-x-auto border-t border-[#315B3E]/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#F3F8F5] text-[10px] font-black uppercase tracking-[0.12em] text-[#60756E]">
                <tr><th className="px-5 py-3">Saison</th><th className="px-5 py-3">Équipe</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3 text-center">Courses</th><th className="px-5 py-3 text-center">Podiums</th><th className="px-5 py-3 text-center">Victoires</th></tr>
              </thead>
              <tbody>
                {profile.history.map((entry) => (
                  <tr key={entry.seasonId} className="border-t border-[#315B3E]/10">
                    <td className="px-5 py-4 font-black text-[#183F37]">{entry.seasonName}</td>
                    <td className="px-5 py-4 font-black text-[#176951]">{entry.teamName}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-[#E6D9F5] px-3 py-1 text-[9px] font-black uppercase text-[#5A2D82]">Année junior</span></td>
                    <td className="px-5 py-4 text-center font-black">{entry.raceCount}</td>
                    <td className="px-5 py-4 text-center font-black">{entry.podiums}</td>
                    <td className="px-5 py-4 text-center font-black">{entry.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">Résultats</p>
          <h2 className="mt-2 text-2xl font-black text-[#183F37]">Palmarès junior détaillé</h2>
          {profile.results.length ? (
            <div className="mt-4 grid gap-2">
              {profile.results.map((result) => (
                <div key={result.id} className="grid gap-2 rounded-xl border border-[#315B3E]/10 bg-[#FAFCFB] px-4 py-3 sm:grid-cols-[70px_minmax(0,1fr)_auto] sm:items-center">
                  <span className={`text-xl font-black ${result.rank <= 3 ? "text-[#B78612]" : "text-[#176951]"}`}>{result.rank}{result.rank === 1 ? "er" : "e"}</span>
                  <div><p className="text-sm font-black text-[#183F37]">{result.stageName ?? result.raceName}</p>{result.stageName ? <p className="text-[10px] font-bold text-[#789087]">{result.raceName}</p> : null}</div>
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#60756E]">{result.scope === "general" ? "Classement final" : "Étape"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-[#F3F8F5] px-4 py-5 text-sm font-semibold text-[#60756E]">Ce junior n’a pas encore disputé d’épreuve avec l’équipe de développement.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function IdentityBadge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5">{children}</span>;
}

function CareerMetric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-xl bg-[#EAF5F3] px-2 py-3 text-center"><p className="text-xl font-black text-[#176951]">{value}</p><p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#60756E]">{label}</p></div>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
