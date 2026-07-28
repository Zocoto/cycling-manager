import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { RankingBadge } from "@/components/game/ranking-badge";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { TeamJerseyPreview } from "@/components/game/team-jersey-preview";
import { TeamDivisionBadge } from "@/components/game/team-division-badge";
import { TeamSeasonResultsPopover } from "@/components/game/team-season-results-popover";
import { DEFAULT_AMATEUR_JERSEY } from "@/lib/amateur-team";
import type { TeamResultCandidate } from "@/lib/game/team-result-highlights";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPublicTeam } from "@/services/public-directory";
import { getPublicTeamRiders } from "@/services/public-rider-profile";
import { getPublicTeamProfileHistory } from "@/services/public-team-profile-history";
import { getPublicTeamRiderHistory } from "@/services/public-team-rider-history";
import { getTeamAmateurIdentity } from "@/services/team-amateur-identity";
import { getActiveTeamSponsorIdentity } from "@/services/team-sponsor-identity";
import { getTeamRankingEntry } from "@/services/uci-rankings";

export const metadata: Metadata = {
  title: "Fiche équipe",
  description:
    "Consultez la fiche publique d’une équipe dans Cyclostratège.",
};

type PublicTeamPageProps = {
  params: Promise<{
    identifiant: string;
  }>;
};

export default async function PublicTeamPage({
  params,
}: PublicTeamPageProps) {
  const { identifiant } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [team, headerData] = await Promise.all([
    getPublicTeam(supabase, identifiant),
    getGameHeaderData(supabase, user.id),
  ]);

  if (!team) {
    notFound();
  }

  const [
    amateurIdentity,
    sponsorIdentity,
    riders,
    riderHistory,
    seasonHistory,
    teamRanking,
  ] = await Promise.all([
    getTeamAmateurIdentity(team.public_identifier),
    getActiveTeamSponsorIdentity(team.public_identifier),
    getPublicTeamRiders(team.public_identifier),
    getPublicTeamRiderHistory(team.public_identifier),
    getPublicTeamProfileHistory(team.public_identifier),
    getTeamRankingEntry(team.public_identifier),
  ]);
  const riderJersey = sponsorIdentity
    ? createSponsoredRiderJersey({
        colors: sponsorIdentity.sponsor.colors,
        style: sponsorIdentity.selectedJersey.style,
        imagePath: sponsorIdentity.selectedJersey.imagePath,
      })
    : amateurIdentity
      ? createAmateurRiderJersey(amateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;

  const countryHref = `/jeu/nations/${team.country_code.toLowerCase()}`;
  const directorHref = team.sporting_director_username
    ? `/jeu/directeurs-sportifs/${encodeURIComponent(
        team.sporting_director_username
      )}`
    : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={`/jeu/recherche?q=${encodeURIComponent(team.display_name)}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#176951] transition hover:text-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
        >
          <span aria-hidden="true">←</span>
          Retour à la recherche
        </Link>

        <div className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.12)]">
          <div className="bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-9 text-[#FFFDF4] sm:px-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              {sponsorIdentity ? (
                <SponsorLogoMark
                  src={sponsorIdentity.sponsor.logoPath}
                  alt={`Logo de ${sponsorIdentity.sponsor.name}`}
                  sponsorName={sponsorIdentity.sponsor.name}
                  primaryColor={sponsorIdentity.sponsor.colors.primary}
                  backgroundColor={sponsorIdentity.sponsor.colors.background}
                  textColor={sponsorIdentity.sponsor.colors.text}
                  className="h-24 w-40 rounded-3xl border-white/20 p-3 shadow-xl"
                />
              ) : (
                <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-3xl font-black shadow-xl">
                  {getInitials(team.display_name)}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#A8DEC6]">
                  Équipe cycliste
                </p>
                <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                  {team.display_name}
                </h1>
              </div>

              <div className="flex flex-col gap-3">
                <TeamDivisionBadge division={team.division_code} dark />
                <RankingBadge
                  rank={teamRanking?.rank ?? null}
                  points={teamRanking?.points ?? 0}
                  label="Classement en cours"
                  href="/jeu/classements?vue=equipes"
                  dark
                />
                <Link
                  href={countryHref}
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
                >
                  <CountryFlag
                    countryCode={team.country_code}
                    countryName={team.country_name}
                  />
                  <span>
                    <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[#A8DEC6]">
                      Pays
                    </span>
                    <span className="mt-1 block font-black">
                      {team.country_name}
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-2">
            <TeamSeasonIdentityCard
              teamName={team.display_name}
              amateurIdentity={amateurIdentity}
              sponsorIdentity={sponsorIdentity}
            />

            {directorHref ? (
              <Link
                href={directorHref}
                className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5 shadow-[0_8px_24px_rgba(19,60,46,0.06)] transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_14px_30px_rgba(19,60,46,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
              >
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
                  Directeur Sportif
                </p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#183F37]">
                      {team.sporting_director_name}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[#278B70]">
                      @{team.sporting_director_username}
                    </p>
                  </div>
                  <span className="text-xl font-black text-[#278B70]" aria-hidden="true">
                    →
                  </span>
                </div>
              </Link>
            ) : (
              <InfoCard
                eyebrow="Directeur Sportif"
                title="Poste vacant"
                description="Aucun Directeur Sportif principal n’est actuellement affecté."
              />
            )}

            {amateurIdentity?.isConfigured ? (
              <div className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5 lg:col-span-2">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <AmateurTeamJersey
                    jersey={amateurIdentity.jersey}
                    teamName={amateurIdentity.amateurName}
                    className="h-28 w-24 shrink-0 drop-shadow-lg"
                  />
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
                      Origine de l’équipe
                    </p>
                    <p className="mt-2 font-black text-[#183F37]">
                      Équipe fondée sous le nom {amateurIdentity.amateurName}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white/75 p-6 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Effectif public
          </p>
          <h2 className="mt-2 text-xl font-black text-[#183F37]">
            Les coureurs de l’équipe
          </h2>
          {riders.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {riders.map((rider) => {
                const riderName = `${rider.firstName} ${rider.lastName}`.trim();

                return (
                  <Link
                    key={rider.id}
                    href={`/jeu/coureurs/${rider.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-4 rounded-2xl border border-[#315B3E]/12 bg-white p-4 shadow-[0_8px_24px_rgba(19,60,46,0.06)] transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_14px_30px_rgba(19,60,46,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
                  >
                    <RiderAvatar
                      profileKey={rider.avatarProfileKey}
                      seed={rider.avatarSeed}
                      riderId={rider.id}
                      age={rider.age ?? 25}
                      jersey={riderJersey}
                      label={`Portrait généré de ${riderName}`}
                      className="h-14 w-14"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-[#183F37]">
                        {riderName}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs font-semibold text-[#60756E]">
                        <CountryFlag
                          countryCode={rider.countryCode}
                          countryName={rider.countryName}
                          compact
                        />
                        {rider.countryName}
                        {rider.age ? ` · ${rider.age} ans` : ""}
                      </span>
                    </span>
                    <span className="text-sm font-black text-[#278B70]" aria-hidden="true">
                      ↗
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-[#315B3E]/20 bg-[#EAF5F3]/55 px-4 py-5 text-sm font-bold text-[#60756E]">
              Aucun coureur n’est actuellement sous contrat avec cette équipe.
            </p>
          )}
        </section>

        <TeamRiderMemory riders={riderHistory} currentJersey={riderJersey} />
        <RecentTeamResults results={seasonHistory.recentResults} />
        <TeamSeasonHistory history={seasonHistory.seasons} />
      </section>
    </main>
  );
}

function TeamRiderMemory({
  riders,
  currentJersey,
}: {
  riders: Awaited<ReturnType<typeof getPublicTeamRiderHistory>>;
  currentJersey: RiderJerseyAppearance;
}) {
  return (
    <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(19,60,46,0.12)] sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9BE0BC]">
            Mémoire de l’équipe
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Glossaire des coureurs
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#BFD1C6]">
            Tous les coureurs ayant porté les couleurs de l’équipe, des effectifs
            actuels aux carrières désormais archivées.
          </p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-[#F2C94C]">
          {riders.length} coureur{riders.length > 1 ? "s" : ""}
        </span>
      </div>

      {riders.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {riders.map((rider) => {
            const riderName = `${rider.firstName} ${rider.lastName}`.trim();
            const presence =
              rider.firstGameYear === rider.lastGameYear
                ? rider.firstSeasonName
                : `${rider.firstSeasonName} → ${rider.lastSeasonName}`;

            return (
              <Link
                key={rider.id}
                href={`/jeu/coureurs/${rider.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 transition hover:-translate-y-0.5 hover:border-[#F2C94C]/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
              >
                <RiderAvatar
                  profileKey={rider.avatarProfileKey}
                  seed={rider.avatarSeed}
                  riderId={rider.id}
                  age={rider.age ?? 25}
                  jersey={rider.isCurrent ? currentJersey : FREE_AGENT_RIDER_JERSEY}
                  label={`Portrait de ${riderName}`}
                  className="h-14 w-14 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-black text-white">
                      {riderName}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                        rider.isCurrent
                          ? "bg-[#42B99A]/20 text-[#9BE0BC]"
                          : rider.isArchived
                            ? "bg-[#F2C94C]/20 text-[#FFE897]"
                            : "bg-white/10 text-[#D6DFD2]"
                      }`}
                    >
                      {rider.isCurrent
                        ? "Effectif actuel"
                        : rider.isArchived
                          ? "Carrière archivée"
                          : "Ancien coureur"}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-[#BFD1C6]">
                    <CountryFlag
                      countryCode={rider.countryCode}
                      countryName={rider.countryName}
                      compact
                    />
                    {presence} · {rider.seasonsCount} saison
                    {rider.seasonsCount > 1 ? "s" : ""}
                  </span>
                  {rider.isArchived && rider.age ? (
                    <span className="mt-1 block text-[10px] font-bold text-[#FFE897]">
                      Retraité à {rider.age} ans
                      {rider.retirementSeasonName
                        ? ` · ${rider.retirementSeasonName}`
                        : ""}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm font-black text-[#F2C94C]" aria-hidden="true">
                  ↗
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-white/15 px-5 py-6 text-sm font-bold text-[#BFD1C6]">
          Aucun passage de coureur n’est encore enregistré pour cette équipe.
        </p>
      )}
    </section>
  );
}
function TeamSeasonIdentityCard({
  teamName,
  amateurIdentity,
  sponsorIdentity,
}: {
  teamName: string;
  amateurIdentity: Awaited<ReturnType<typeof getTeamAmateurIdentity>>;
  sponsorIdentity: Awaited<ReturnType<typeof getActiveTeamSponsorIdentity>>;
}) {
  return (
    <div className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
        Identité de la saison en cours
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <TeamJerseyPreview
          amateurJersey={amateurIdentity?.jersey ?? DEFAULT_AMATEUR_JERSEY}
          amateurTeamName={amateurIdentity?.amateurName ?? teamName}
          sponsor={sponsorIdentity?.sponsor ?? null}
          sponsorJersey={sponsorIdentity?.selectedJersey ?? null}
          className="h-32 w-24 shrink-0 drop-shadow-lg"
        />

        <div className="min-w-0 flex-1">
          {sponsorIdentity ? (
            <SponsorLogoMark
              src={sponsorIdentity.sponsor.logoPath}
              alt={`Logo de ${sponsorIdentity.sponsor.name}`}
              sponsorName={sponsorIdentity.sponsor.name}
              primaryColor={sponsorIdentity.sponsor.colors.primary}
              backgroundColor={sponsorIdentity.sponsor.colors.background}
              textColor={sponsorIdentity.sponsor.colors.text}
              className="h-20 w-36 rounded-2xl p-2.5"
            />
          ) : (
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#176951] text-xl font-black text-white">
              {getInitials(teamName)}
            </span>
          )}
          <p className="mt-3 font-black text-[#183F37]">
            {sponsorIdentity?.sponsor.name ?? "Structure amateur"}
          </p>
        </div>
      </div>
    </div>
  );
}

function TeamSeasonHistory({
  history,
}: {
  history: Awaited<ReturnType<typeof getPublicTeamProfileHistory>>["seasons"];
}) {
  return (
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
      <div className="px-6 py-6 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
          Mémoire du club
        </p>
        <h2 className="mt-2 text-xl font-black text-[#183F37]">
          Historique, identité et palmarès
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
          Les identités passées et les principaux résultats de chaque saison, sans surcharger la lecture avec les places secondaires.
        </p>
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto border-t border-[#315B3E]/10">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead className="bg-[#F3F8F5] text-xs font-extrabold uppercase tracking-[0.12em] text-[#60756E]">
              <tr>
                <th className="px-6 py-4">Saison</th>
                <th className="px-5 py-4">Équipe de l’époque</th>
                <th className="px-5 py-4">Palmarès principal</th>
                <th className="px-4 py-4 text-center">Points</th>
                <th className="px-6 py-4 text-center">Classement</th>
                <th className="px-6 py-4 text-center">Division</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={entry.seasonId}
                  className="border-t border-[#315B3E]/10 text-sm"
                >
                  <td className="px-6 py-4 font-black text-[#183F37]">
                    {entry.seasonName}
                    {entry.status === "active" ? (
                      <span className="ml-2 rounded-full bg-[#DDF3E7] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#176951]">
                        Actuelle
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {entry.logo ? (
                        <SponsorLogoMark
                          src={entry.logo.logoPath}
                          alt={`Logo de ${entry.logo.sponsorName}`}
                          sponsorName={entry.logo.sponsorName}
                          primaryColor={entry.logo.primaryColor}
                          backgroundColor={entry.logo.backgroundColor}
                          textColor={entry.logo.textColor}
                          className="h-12 w-20 shrink-0 rounded-xl p-1.5"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#176951] text-xs font-black text-white">
                          {getInitials(entry.displayName)}
                        </span>
                      )}
                      <span className="font-bold text-[#48665F]">
                        {entry.displayName}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <SeasonPalmares
                      highlights={entry.highlights}
                      victoryCount={entry.victoryCount}
                    />
                  </td>
                  <td className="px-4 py-4 text-center font-black text-[#48665F]">
                    {entry.points}
                  </td>
                  <td className="px-6 py-4 text-center font-black text-[#48665F]">
                    {entry.finalRank ? `#${entry.finalRank}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <TeamDivisionBadge division={entry.divisionCode} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-t border-[#315B3E]/10 px-6 py-6 text-sm font-semibold text-[#60756E] sm:px-8">
          Aucun historique de saison n’est encore disponible.
        </p>
      )}
    </section>
  );
}

function RecentTeamResults({
  results,
}: {
  results: Awaited<
    ReturnType<typeof getPublicTeamProfileHistory>
  >["recentResults"];
}) {
  return (
    <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white/80 p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
        Sept derniers jours
      </p>
      <h2 className="mt-2 text-xl font-black text-[#183F37]">
        Résultats récents marquants
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
        Victoires et performances de premier plan enregistrées sur la dernière
        semaine de course.
      </p>

      {results.length > 0 ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {results.map((result) => (
            <Link
              key={result.id}
              href={getTeamResultHref(result)}
              className="group flex items-center gap-4 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-4 transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F2C94C]/20 text-lg font-black text-[#8A6418]">
                {result.rank === 1 ? "1" : result.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black text-[#183F37]">
                  {formatTeamResultTitle(result)}
                </span>
                <span className="mt-1 block truncate text-sm font-semibold text-[#48665F]">
                  {formatTeamResultContext(result)}
                </span>
                <span className="mt-1 block text-xs font-semibold text-[#60756E]">
                  {result.riderName ?? "Classement par équipes"} ·{" "}
                  {formatResultDate(result.calendarDate)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="font-black text-[#278B70] transition group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-[#315B3E]/20 bg-[#EAF5F3]/55 px-4 py-5 text-sm font-bold text-[#60756E]">
          Aucun résultat majeur enregistré sur les sept derniers jours de course.
        </p>
      )}
    </section>
  );
}

function SeasonPalmares({
  highlights,
  victoryCount,
}: {
  highlights: Awaited<
    ReturnType<typeof getPublicTeamProfileHistory>
  >["seasons"][number]["highlights"];
  victoryCount: number;
}) {
  if (highlights.length === 0) {
    return (
      <span className="text-sm font-semibold text-[#7A8C86]">
        Aucun résultat majeur
      </span>
    );
  }

  return (
    <TeamSeasonResultsPopover
      victoryCount={victoryCount}
      items={highlights.map((highlight) => ({
        id: highlight.id,
        href: getTeamResultHref(highlight),
        title: formatTeamResultTitle(highlight),
        raceName: highlight.raceName,
        riderName: highlight.riderName,
      }))}
    />
  );
}
function getTeamResultHref(result: TeamResultCandidate): string {
  return result.kind === "stage" && result.stageNumber
    ? `/jeu/resultats/${result.raceSlug}/${result.stageNumber}`
    : `/jeu/resultats/${result.raceSlug}`;
}

function formatTeamResultTitle(result: TeamResultCandidate): string {
  if (result.kind === "classification" && result.classificationType) {
    const labels: Record<
      NonNullable<TeamResultCandidate["classificationType"]>,
      string
    > = {
      mountain: "Classement de la montagne remporté",
      sprint: "Classement par points remporté",
      youth: "Classement des jeunes remporté",
      team: "Classement par équipes remporté",
    };

    return labels[result.classificationType];
  }

  if (result.kind === "stage") {
    return "Victoire d’étape";
  }

  if (result.rank === 1) return "Victoire";
  return `${result.rank}e place`;
}

function formatTeamResultContext(result: TeamResultCandidate): string {
  if (result.kind !== "stage") return result.raceName;

  const stageLabel = result.stageNumber
    ? `Étape ${result.stageNumber}`
    : "Étape";
  return result.stageName
    ? `${result.raceName} · ${stageLabel} · ${result.stageName}`
    : `${result.raceName} · ${stageLabel}`;
}

function formatResultDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);

  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function InfoCard({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
        {eyebrow}
      </p>
      <p className="mt-3 font-black text-[#183F37]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#60756E]">
        {description}
      </p>
    </div>
  );
}

function CountryFlag({
  countryCode,
  countryName,
  compact = false,
}: {
  countryCode: string;
  countryName: string;
  compact?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
      className={`fi fi-${countryCode.toLowerCase()} ${compact ? "text-base" : "text-4xl shadow-sm"}`}
    />
  );
}

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
