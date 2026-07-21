import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { RankingBadge } from "@/components/game/ranking-badge";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import { TeamDivisionBadge } from "@/components/game/team-division-badge";
import type { GlobalSearchResult } from "@/lib/game/global-search";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import { findSponsorByName } from "@/lib/sponsor-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getNationRiderOverview,
  type NationRiderSummary,
} from "@/services/nation-riders";
import { getPublicCountryDirectory } from "@/services/public-directory";
import { getTeamAmateurIdentity } from "@/services/team-amateur-identity";
import { getActiveTeamSponsorIdentity } from "@/services/team-sponsor-identity";
import { getNationRankingEntry } from "@/services/uci-rankings";

export const metadata: Metadata = {
  title: "Fiche nation",
  description:
    "Consultez la fiche publique d’une nation dans Cyclostratège.",
};

type PublicCountryPageProps = {
  params: Promise<{
    codePays: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat("fr-FR");

export default async function PublicCountryPage({
  params,
}: PublicCountryPageProps) {
  const { codePays } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [directory, headerData, nationRanking] = await Promise.all([
    getPublicCountryDirectory(supabase, codePays),
    getGameHeaderData(supabase, user.id),
    getNationRankingEntry(codePays),
  ]);

  if (!directory) {
    notFound();
  }

  const { country, members } = directory;
  const { topRiders, totalCount: riderCount } =
    await getNationRiderOverview(country.entity_id);
  const riderJerseysByTeamId = await getNationRiderJerseys(topRiders);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={`/jeu/recherche?q=${encodeURIComponent(country.display_name)}`}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#176951] transition hover:text-[#278B70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
        >
          <span aria-hidden="true">←</span>
          Retour à la recherche
        </Link>

        <div className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.12)]">
          <div className="bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-9 text-[#FFFDF4] sm:px-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <span className="flex h-24 w-32 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-xl">
                <CountryFlag
                  countryCode={country.country_code}
                  countryName={country.country_name}
                  hero
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#A8DEC6]">
                  Nation
                </p>
                <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                  {country.display_name}
                </h1>
                <p className="mt-3 font-semibold uppercase tracking-[0.18em] text-[#F2C94C]">
                  {country.country_code}
                </p>
              </div>

              <div className="space-y-3">
                <RankingBadge
                  rank={nationRanking?.rank ?? null}
                  points={nationRanking?.points ?? 0}
                  label="Classement des nations"
                  href="/jeu/classements?vue=nations"
                  dark
                />
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <Statistic
                    label="Directeurs Sportifs"
                    value={country.sporting_director_count ?? 0}
                  />
                  <Statistic
                    label="Équipes"
                    value={country.team_count ?? 0}
                  />
                  <Statistic label="Coureurs" value={riderCount} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-2">
            <DirectorySection
              eyebrow="Personnes"
              title="Directeurs Sportifs"
              shownCount={members.sportingDirectors.length}
              totalCount={country.sporting_director_count ?? 0}
              emptyLabel="Aucun Directeur Sportif actif pour cette nation."
            >
              {members.sportingDirectors.map((director) => (
                <CountryDirectorLink
                  key={director.entity_id}
                  director={director}
                />
              ))}
            </DirectorySection>

            <DirectorySection
              eyebrow="Structures"
              title="Équipes"
              shownCount={members.teams.length}
              totalCount={country.team_count ?? 0}
              emptyLabel="Aucune équipe active pour cette nation."
            >
              {members.teams.map((team) => (
                <CountryTeamLink key={team.entity_id} team={team} />
              ))}
            </DirectorySection>
          </div>

          <NationTopRidersSection
            riders={topRiders}
            riderJerseysByTeamId={riderJerseysByTeamId}
          />
        </div>

        <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white/75 p-6 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Rayonnement international
          </p>
          <h2 className="mt-2 text-xl font-black text-[#183F37]">
            Bilan de la nation
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              nationRanking ? `Rang mondial #${nationRanking.rank}` : "Rang mondial à établir",
              `${numberFormatter.format(nationRanking?.points ?? 0)} points UCI`,
              `${numberFormatter.format(nationRanking?.riderCount ?? 0)} coureurs classés`,
              "Résultats aux championnats · prochainement",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-dashed border-[#315B3E]/20 bg-[#EAF5F3]/55 px-4 py-5 text-sm font-bold text-[#60756E]"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function NationTopRidersSection({
  riders,
  riderJerseysByTeamId,
}: {
  riders: NationRiderSummary[];
  riderJerseysByTeamId: Map<string, RiderJerseyAppearance>;
}) {
  return (
    <section className="border-t border-[#315B3E]/12 px-6 py-8 sm:px-10 sm:py-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
        Coureurs
      </p>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-black text-[#183F37]">
          Les 5 meilleurs coureurs
        </h2>
        <p className="text-xs font-bold text-[#60756E]">
          Moyenne générale de la saison active · avec ou sans équipe
        </p>
      </div>

      {riders.length > 0 ? (
        <ol className="mt-5 grid gap-3 lg:grid-cols-2">
          {riders.map((rider, index) => {
            const riderName = `${rider.firstName} ${rider.lastName}`.trim();
            const jersey = rider.teamId
              ? (riderJerseysByTeamId.get(rider.teamId) ??
                FREE_AGENT_RIDER_JERSEY)
              : FREE_AGENT_RIDER_JERSEY;

            return (
              <li key={rider.id}>
                <Link
                  href={`/jeu/coureurs/${rider.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-4 transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_12px_26px_rgba(19,60,46,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
                  aria-label={`Consulter la fiche de ${riderName}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#176951] text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <RiderAvatar
                    profileKey={rider.avatarProfileKey}
                    seed={rider.avatarSeed}
                    riderId={rider.id}
                    age={rider.age}
                    jersey={jersey}
                    label={`Portrait de ${riderName}`}
                    className="h-14 w-14"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-[#183F37]">
                      {riderName}
                    </span>
                    <span className="mt-1 block truncate text-xs font-semibold text-[#60756E]">
                      {rider.age} ans · {rider.teamName ?? "Sans équipe"}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-xl bg-[#DDF3E7] px-3 py-2 text-xs font-black text-[#176951]">
                    MOY {Math.round(rider.overall)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-[#315B3E]/20 px-4 py-8 text-center text-sm text-[#60756E]">
          Aucun coureur actif enregistré pour cette nation.
        </p>
      )}
    </section>
  );
}

async function getNationRiderJerseys(
  riders: NationRiderSummary[],
): Promise<Map<string, RiderJerseyAppearance>> {
  const teamIds = [
    ...new Set(
      riders
        .map((rider) => rider.teamId)
        .filter((teamId): teamId is string => Boolean(teamId)),
    ),
  ];
  const entries = await Promise.all(
    teamIds.map(async (teamId) => {
      const [sponsorIdentity, amateurIdentity] = await Promise.all([
        getActiveTeamSponsorIdentity(teamId).catch(() => null),
        getTeamAmateurIdentity(teamId).catch(() => null),
      ]);
      const jersey = sponsorIdentity
        ? createSponsoredRiderJersey({
            colors: sponsorIdentity.sponsor.colors,
            style: sponsorIdentity.selectedJersey.style,
          })
        : amateurIdentity
          ? createAmateurRiderJersey(amateurIdentity.jersey)
          : FREE_AGENT_RIDER_JERSEY;

      return [teamId, jersey] as const;
    }),
  );

  return new Map(entries);
}

function Statistic({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-2 py-4 text-center sm:min-w-28 sm:px-4">
      <p className="text-2xl font-black">{numberFormatter.format(value)}</p>
      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#A8DEC6]">
        {label}
      </p>
    </div>
  );
}

function DirectorySection({
  eyebrow,
  title,
  shownCount,
  totalCount,
  emptyLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  shownCount: number;
  totalCount: number;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
        {eyebrow}
      </p>
      <div className="mt-1 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-black text-[#183F37]">{title}</h2>
        <span className="text-xs font-bold text-[#60756E]">
          {shownCount < totalCount
            ? `${shownCount} affichés sur ${numberFormatter.format(totalCount)}`
            : numberFormatter.format(totalCount)}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {shownCount > 0 ? (
          children
        ) : (
          <p className="rounded-xl border border-dashed border-[#315B3E]/20 px-4 py-8 text-center text-sm text-[#60756E]">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}

function CountryDirectorLink({
  director,
}: {
  director: GlobalSearchResult;
}) {
  return (
    <Link
      href={`/jeu/directeurs-sportifs/${encodeURIComponent(
        director.public_identifier
      )}`}
      className="flex items-center gap-3 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-4 transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_12px_26px_rgba(19,60,46,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
    >
      <SportingDirectorAvatar
        avatarKey={director.avatar_key}
        size="small"
        label={`Avatar de ${director.display_name}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-black text-[#183F37]">
          {director.display_name}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-[#278B70]">
          @{director.public_identifier}
        </span>
        <span className="mt-1 block truncate text-xs text-[#60756E]">
          {director.team_name ?? "Sans équipe actuelle"}
        </span>
        {director.team_id ? (
          <span className="mt-2 block">
            <TeamDivisionBadge division={director.division_code} compact />
          </span>
        ) : null}
      </span>
      <span className="text-sm font-black text-[#60756E]">
        {numberFormatter.format(director.reputation_points ?? 0)} pts
      </span>
    </Link>
  );
}

function CountryTeamLink({
  team,
}: {
  team: GlobalSearchResult;
}) {
  const sponsor = findSponsorByName(team.sponsor_name);

  return (
    <Link
      href={`/jeu/equipes/${team.public_identifier}`}
      className="flex items-center gap-3 rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-4 transition hover:-translate-y-0.5 hover:border-[#278B70]/40 hover:shadow-[0_12px_26px_rgba(19,60,46,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
    >
      {sponsor ? (
        <SponsorLogoMark
          src={sponsor.logoPath}
          alt={`Logo de ${sponsor.name}`}
          sponsorName={sponsor.name}
          primaryColor={sponsor.colors.primary}
          backgroundColor={sponsor.colors.background}
          textColor={sponsor.colors.text}
          className="h-11 w-16 rounded-xl p-1.5"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#176951] text-sm font-black text-white">
          {getInitials(team.display_name)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-black text-[#183F37]">
          {team.display_name}
        </span>
        <span className="mt-1 block truncate text-xs text-[#60756E]">
          {team.sponsor_name
            ? `Sponsor : ${team.sponsor_name}`
            : "Sans sponsor principal"}
        </span>
        <span className="mt-1 block truncate text-xs font-semibold text-[#278B70]">
          {team.sporting_director_name ?? "DS non attribué"}
        </span>
        <span className="mt-2 block">
          <TeamDivisionBadge division={team.division_code} compact />
        </span>
      </span>
      <span className="text-xl font-black text-[#278B70]" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

function CountryFlag({
  countryCode,
  countryName,
  hero = false,
}: {
  countryCode: string;
  countryName: string;
  hero?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
      className={`fi fi-${countryCode.toLowerCase()} shadow-sm ${
        hero ? "text-6xl" : "text-3xl"
      }`}
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
