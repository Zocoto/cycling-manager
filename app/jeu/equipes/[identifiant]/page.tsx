import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { GameHeader } from "@/components/game/game-header";
import { ProfileBackButton } from "@/components/game/profile-back-button";
import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { RankingBadge } from "@/components/game/ranking-badge";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { TeamJerseyPreview } from "@/components/game/team-jersey-preview";
import { TeamDivisionBadge } from "@/components/game/team-division-badge";
import { TeamRiderGlossary } from "@/components/game/team-rider-glossary";
import { TeamSeasonResultsPopover } from "@/components/game/team-season-results-popover";
import { DEFAULT_AMATEUR_JERSEY } from "@/lib/amateur-team";
import type { TeamResultCandidate } from "@/lib/game/team-result-highlights";
import { createTeamProfileTheme } from "@/lib/game/team-profile-theme";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
} from "@/lib/rider-jersey";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
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
  } = await getAuthenticatedUser(supabase);

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

  const teamTheme = createTeamProfileTheme(
    sponsorIdentity?.sponsor.colors ?? {
      primary:
        amateurIdentity?.jersey.primaryColor ??
        DEFAULT_AMATEUR_JERSEY.primaryColor,
      secondary:
        amateurIdentity?.jersey.secondaryColor ??
        DEFAULT_AMATEUR_JERSEY.secondaryColor,
      accent:
        amateurIdentity?.jersey.accentColor ??
        DEFAULT_AMATEUR_JERSEY.accentColor,
    },
  );
  const currentGameYear =
    seasonHistory.seasons.find((season) => season.status === "active")
      ?.gameYear ?? seasonHistory.seasons[0]?.gameYear ?? 1;
  const teamThemeStyle = {
    "--team-primary": teamTheme.primary,
    "--team-secondary": teamTheme.secondary,
    "--team-accent": teamTheme.accent,
    "--team-surface": teamTheme.surface,
    "--team-soft": teamTheme.soft,
    "--team-ink": teamTheme.ink,
    "--team-muted": teamTheme.muted,
    "--team-line": teamTheme.line,
    "--team-shadow": teamTheme.shadow,
    background: `radial-gradient(circle at 12% 0%, ${teamTheme.soft} 0, transparent 34rem), ${teamTheme.surface}`,
  } as CSSProperties;

  const countryHref = `/jeu/nations/${team.country_code.toLowerCase()}`;
  const directorHref = team.sporting_director_username
    ? `/jeu/directeurs-sportifs/${encodeURIComponent(
        team.sporting_director_username
      )}`
    : null;

  return (
    <main
      className="min-h-screen text-[var(--team-ink)]"
      style={teamThemeStyle}
    >
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <ProfileBackButton fallbackHref="/jeu/recherche" tone="team" />

        <div className="mt-5 overflow-hidden rounded-[2rem] border border-[var(--team-line)] bg-white shadow-[0_24px_70px_var(--team-shadow)]">
          <div
            className="px-6 py-9 text-[#FFFDF4] sm:px-10"
            style={{
              background: "linear-gradient(135deg, var(--team-primary), var(--team-secondary))",
            }}
          >
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
                <TeamDivisionBadge division={team.division_code} isProfessional={Boolean(sponsorIdentity)} dark />
                <RankingBadge
                  rank={teamRanking?.rank ?? null}
                  points={teamRanking?.points ?? 0}
                  label="Classement en cours"
                  href="/jeu/classements?vue=equipes"
                  dark
                />
                <Link
                  href={countryHref}
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--team-accent)]"
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
                className="rounded-2xl border border-[var(--team-line)] bg-[var(--team-surface)] p-5 shadow-[0_8px_24px_var(--team-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--team-secondary)] hover:shadow-[0_14px_30px_var(--team-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--team-primary)]"
              >
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--team-secondary)]">
                  Directeur Sportif
                </p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-black text-[var(--team-ink)]">
                      {team.sporting_director_name}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--team-secondary)]">
                      @{team.sporting_director_username}
                    </p>
                  </div>
                  <span className="text-xl font-black text-[var(--team-secondary)]" aria-hidden="true">
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
              <div className="rounded-2xl border border-[var(--team-line)] bg-[var(--team-surface)] p-5 lg:col-span-2">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <AmateurTeamJersey
                    jersey={amateurIdentity.jersey}
                    teamName={amateurIdentity.amateurName}
                    className="h-28 w-24 shrink-0 drop-shadow-lg"
                  />
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--team-secondary)]">
                      Origine de l’équipe
                    </p>
                    <p className="mt-2 font-black text-[var(--team-ink)]">
                      Équipe fondée sous le nom {amateurIdentity.amateurName}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <section className="mt-7 rounded-[2rem] border border-[var(--team-line)] bg-white/75 p-6 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--team-secondary)]">
            Effectif public
          </p>
          <h2 className="mt-2 text-xl font-black text-[var(--team-ink)]">
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
                    className="flex items-center gap-4 rounded-2xl border border-[var(--team-line)] bg-white p-4 shadow-[0_8px_24px_var(--team-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--team-secondary)] hover:shadow-[0_14px_30px_var(--team-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--team-primary)]"
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
                      <span className="block truncate font-black text-[var(--team-ink)]">
                        {riderName}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs font-semibold text-[var(--team-muted)]">
                        <CountryFlag
                          countryCode={rider.countryCode}
                          countryName={rider.countryName}
                          compact
                        />
                        {rider.countryName}
                        {rider.age ? ` · ${rider.age} ans` : ""}
                      </span>
                    </span>
                    <span className="text-sm font-black text-[var(--team-secondary)]" aria-hidden="true">
                      ↗
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-[var(--team-line)] bg-[var(--team-soft)] px-4 py-5 text-sm font-bold text-[var(--team-muted)]">
              Aucun coureur n’est actuellement sous contrat avec cette équipe.
            </p>
          )}
        </section>

        <TeamRiderGlossary
          riders={riderHistory}
          currentGameYear={currentGameYear}
        />
        <RecentTeamResults results={seasonHistory.recentResults} />
        <TeamSeasonHistory history={seasonHistory.seasons} />
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
    <div className="rounded-2xl border border-[var(--team-line)] bg-[var(--team-surface)] p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--team-secondary)]">
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
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--team-primary)] text-xl font-black text-white">
              {getInitials(teamName)}
            </span>
          )}
          <p className="mt-3 font-black text-[var(--team-ink)]">
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
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-[var(--team-line)] bg-white shadow-[0_16px_45px_var(--team-shadow)]">
      <div className="px-6 py-6 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--team-secondary)]">
          Mémoire du club
        </p>
        <h2 className="mt-2 text-xl font-black text-[var(--team-ink)]">
          Historique, identité et palmarès
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--team-muted)]">
          Les identités passées et les principaux résultats de chaque saison, sans surcharger la lecture avec les places secondaires.
        </p>
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto border-t border-[var(--team-line)]">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead className="bg-[#F3F8F5] text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--team-muted)]">
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
                  className="border-t border-[var(--team-line)] text-sm"
                >
                  <td className="px-6 py-4 font-black text-[var(--team-ink)]">
                    {entry.seasonName}
                    {entry.status === "active" ? (
                      <span className="ml-2 rounded-full bg-[var(--team-soft)] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--team-primary)]">
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
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--team-primary)] text-xs font-black text-white">
                          {getInitials(entry.displayName)}
                        </span>
                      )}
                      <span className="font-bold text-[var(--team-muted)]">
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
                  <td className="px-4 py-4 text-center font-black text-[var(--team-muted)]">
                    {entry.points}
                  </td>
                  <td className="px-6 py-4 text-center font-black text-[var(--team-muted)]">
                    {entry.finalRank ? `#${entry.finalRank}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <TeamDivisionBadge division={entry.divisionCode} isProfessional={Boolean(entry.logo)} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-t border-[var(--team-line)] px-6 py-6 text-sm font-semibold text-[var(--team-muted)] sm:px-8">
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
    <section className="mt-7 rounded-[2rem] border border-[var(--team-line)] bg-white/80 p-6 shadow-[0_16px_45px_var(--team-shadow)] sm:p-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--team-secondary)]">
        Sept derniers jours
      </p>
      <h2 className="mt-2 text-xl font-black text-[var(--team-ink)]">
        Résultats récents marquants
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--team-muted)]">
        Victoires et performances de premier plan enregistrées sur la dernière
        semaine de course.
      </p>

      {results.length > 0 ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {results.map((result) => (
            <Link
              key={result.id}
              href={getTeamResultHref(result)}
              className="group flex items-center gap-4 rounded-2xl border border-[var(--team-line)] bg-[var(--team-surface)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--team-secondary)] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--team-primary)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--team-soft)] text-lg font-black text-[var(--team-primary)]">
                {result.rank === 1 ? "1" : result.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black text-[var(--team-ink)]">
                  {result.raceName}
                </span>
                <span className="mt-1 block truncate text-sm font-semibold text-[var(--team-muted)]">
                  {formatTeamResultDetail(result)}
                </span>
                <span className="mt-1 block text-xs font-semibold text-[var(--team-muted)]">
                  {result.riderName ?? "Classement par équipes"} ·{" "}
                  {formatResultDate(result.calendarDate)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="font-black text-[var(--team-secondary)] transition group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-[var(--team-line)] bg-[var(--team-soft)] px-4 py-5 text-sm font-bold text-[var(--team-muted)]">
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
        raceName: highlight.raceName,
        resultLabel: formatTeamResultDetail(highlight),
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

function formatTeamResultDetail(result: TeamResultCandidate): string {
  const place = formatTeamResultPlace(result.rank);

  if (result.kind === "classification" && result.classificationType) {
    const labels: Record<
      NonNullable<TeamResultCandidate["classificationType"]>,
      string
    > = {
      mountain: "classement de la montagne",
      sprint: "classement par points",
      youth: "classement des jeunes",
      team: "classement par équipes",
    };

    return `${place} · ${labels[result.classificationType]}`;
  }

  if (result.kind === "stage") {
    const stageLabel = result.stageNumber
      ? `Étape ${result.stageNumber}`
      : "Étape";
    return result.stageName
      ? `${place} · ${stageLabel} · ${result.stageName}`
      : `${place} · ${stageLabel}`;
  }

  return result.raceFormat === "stage_race"
    ? `${place} au général`
    : place;
}

function formatTeamResultPlace(rank: number): string {
  return rank === 1 ? "1re place" : `${rank}e place`;
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
    <div className="rounded-2xl border border-[var(--team-line)] bg-[var(--team-surface)] p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--team-secondary)]">
        {eyebrow}
      </p>
      <p className="mt-3 font-black text-[var(--team-ink)]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--team-muted)]">
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
