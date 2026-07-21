import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { RankingBadge } from "@/components/game/ranking-badge";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { TeamJerseyPreview } from "@/components/game/team-jersey-preview";
import { TeamDivisionBadge } from "@/components/game/team-division-badge";
import { DEFAULT_AMATEUR_JERSEY } from "@/lib/amateur-team";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
} from "@/lib/rider-jersey";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPublicTeam } from "@/services/public-directory";
import { getPublicTeamRiders } from "@/services/public-rider-profile";
import { getPublicTeamSeasonHistory } from "@/services/public-team-history";
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

  const [amateurIdentity, sponsorIdentity, riders, seasonHistory, teamRanking] = await Promise.all([
    getTeamAmateurIdentity(team.public_identifier),
    getActiveTeamSponsorIdentity(team.public_identifier),
    getPublicTeamRiders(team.public_identifier),
    getPublicTeamSeasonHistory(team.public_identifier),
    getTeamRankingEntry(team.public_identifier),
  ]);
  const riderJersey = sponsorIdentity
    ? createSponsoredRiderJersey({
        colors: sponsorIdentity.sponsor.colors,
        style: sponsorIdentity.selectedJersey.style,
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
                <p className="mt-3 text-sm font-semibold text-[#D6DFD2]">
                  Identifiant : {team.public_identifier}
                </p>
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
                    <p className="mt-1 text-sm leading-6 text-[#60756E]">
                      Identité amateur permanente · {amateurIdentity.homeCountryName}
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {["Résultats récents", "Sponsors historiques"].map(
              (item) => (
                <div
                  key={item}
                  className="rounded-xl border border-dashed border-[#315B3E]/20 bg-[#EAF5F3]/55 px-4 py-5 text-sm font-bold text-[#60756E]"
                >
                  {item} · prochainement
                </div>
              )
            )}
          </div>
        </section>

        <TeamSeasonHistory history={seasonHistory} />
      </section>
    </main>
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
          <p className="mt-1 text-sm leading-6 text-[#60756E]">
            {sponsorIdentity
              ? `Maillot « ${sponsorIdentity.selectedJersey.name} » actuellement utilisé.`
              : "Maillot amateur actuellement utilisé par l’équipe."}
          </p>
        </div>
      </div>
    </div>
  );
}

function TeamSeasonHistory({
  history,
}: {
  history: Awaited<ReturnType<typeof getPublicTeamSeasonHistory>>;
}) {
  return (
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
      <div className="px-6 py-6 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
          Identité permanente
        </p>
        <h2 className="mt-2 text-xl font-black text-[#183F37]">
          Historique des noms et classements
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
          Chaque ancien nom renvoie toujours vers cette fiche et affiche l’identité de la saison actuelle.
        </p>
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto border-t border-[#315B3E]/10">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="bg-[#F3F8F5] text-xs font-extrabold uppercase tracking-[0.12em] text-[#60756E]">
              <tr>
                <th className="px-6 py-4">Saison</th>
                <th className="px-5 py-4">Nom de l’équipe</th>
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
                  <td className="px-5 py-4 font-bold text-[#48665F]">
                    {entry.displayName}
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
      aria-label={`Drapeau : ${countryName}`}
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
