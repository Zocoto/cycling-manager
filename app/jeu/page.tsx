import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GameHeader } from "../../components/game/game-header";
import { SponsorLogoMark } from "../../components/game/sponsor-logo";
import { SportingDirectorAvatar } from "../../components/game/sporting-director-avatar";
import { SportingDirectorProgression } from "../../components/game/sporting-director-progression";
import { SportingDirectorReputation } from "../../components/game/sporting-director-reputation";
import { TeamJerseyPreview } from "../../components/game/team-jersey-preview";
import { DEFAULT_AMATEUR_JERSEY } from "../../lib/amateur-team";
import {
  GAMEPLAY_RULES,
  getSponsoringUnlockProgress,
  isSponsoringUnlocked,
} from "../../lib/gameplay-rules";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  getTeamAmateurIdentityForAuthUser,
  type TeamAmateurIdentity,
} from "../../services/team-amateur-identity";
import {
  getActiveTeamSponsorIdentityForAuthUser,
  type TeamSponsorIdentity,
} from "../../services/team-sponsor-identity";

export const metadata: Metadata = {
  title: "Bureau du Directeur Sportif",
  description:
    "Pilotez votre carrière et votre équipe dans Cyclostratège.",
};

type SportingDirector = {
  id: string;
  username: string;
  display_name: string;
  country_id: string | null;
  avatar_key: string | null;
  reputation_points: number;
  experience_points: number;
  is_email_visible: boolean;
  created_at: string;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type CurrentTeamDashboardSummary = {
  team_id: string;
  team_name: string;
  rider_count: number;
  season_id: string;
  season_name: string;
  season_day_number: number;
};

type ManagementModuleIcon =
  | "riders"
  | "sponsor"
  | "training"
  | "calendar"
  | "result"
  | "academy"
  | "camp"
  | "transfer";

export default async function GamePage() {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [
    profileResult,
    countriesResult,
    teamSummaryResult,
  ] = await Promise.all([
    supabase
      .from("sporting_directors")
      .select(
        `
          id,
          username,
          display_name,
          country_id,
          avatar_key,
          reputation_points,
          experience_points,
          is_email_visible,
          created_at
        `
      )
      .eq("auth_user_id", user.id)
      .maybeSingle<SportingDirector>(),

    supabase
      .from("countries")
      .select(
        `
          id,
          name,
          iso_alpha2
        `
      )
      .eq("is_active", true)
      .order("name", {
        ascending: true,
      }),

    supabase
      .rpc("get_current_team_dashboard_summary")
      .maybeSingle<CurrentTeamDashboardSummary>(),
  ]);

  let teamSponsorIdentity:
    TeamSponsorIdentity | null = null;

  let teamSponsorIdentityError:
    string | null = null;

  try {
    teamSponsorIdentity =
      await getActiveTeamSponsorIdentityForAuthUser(
        user.id
      );
  } catch (error) {
    console.error(
      "Impossible de récupérer l’identité commerciale de l’équipe :",
      error
    );

    teamSponsorIdentityError =
      getErrorMessage(error);
  }

  let teamAmateurIdentity: TeamAmateurIdentity | null = null;

  try {
    teamAmateurIdentity =
      await getTeamAmateurIdentityForAuthUser(user.id);
  } catch (error) {
    console.error(
      "Impossible de récupérer l’identité amateur de l’équipe :",
      error
    );
  }

  const sportingDirector =
    profileResult.data;

  const teamSummary =
    (teamSummaryResult.data ??
      null) as CurrentTeamDashboardSummary | null;

  if (profileResult.error) {
    console.error(
      "Impossible de récupérer le profil du Directeur Sportif :",
      {
        code: profileResult.error.code,
        message: profileResult.error.message,
      }
    );
  }

  if (countriesResult.error) {
    console.error(
      "Impossible de récupérer le référentiel des pays :",
      {
        code: countriesResult.error.code,
        message: countriesResult.error.message,
      }
    );
  }

  if (teamSummaryResult.error) {
    console.error(
      "Impossible de récupérer le résumé de l’équipe :",
      {
        code: teamSummaryResult.error.code,
        message:
          teamSummaryResult.error.message,
      }
    );
  }

  const countries =
    (countriesResult.data ??
      []) as CountryRow[];

  const selectedCountry =
    countries.find(
      (country) =>
        country.id ===
        sportingDirector?.country_id
    ) ?? null;

  const displayName =
    sportingDirector?.display_name ??
    sportingDirector?.username ??
    "Directeur Sportif";

  const isProfileComplete = Boolean(
    sportingDirector?.country_id &&
      sportingDirector?.avatar_key
  );

  const riderCount =
    teamSummary?.rider_count ?? 0;

  const commercialTeamName =
    teamSponsorIdentity?.teamName ??
    teamAmateurIdentity?.amateurName ??
    teamSummary?.team_name ??
    "Votre équipe";

  const reputationPoints = sportingDirector?.reputation_points ?? 0;
  const sponsoringUnlocked = isSponsoringUnlocked(reputationPoints);

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={displayName}
        sponsor={teamSponsorIdentity?.sponsor ?? null}
      />

      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-96 bg-linear-to-b from-[#D7EEE8] to-transparent"
        />

        <MountainDecoration />

        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <header className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
              Bureau du Directeur Sportif
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Bonjour, {displayName}.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#48665F]">
              Suivez l’état de votre équipe,
              votre progression et les principaux
              domaines de votre carrière.
            </p>
          </header>

          {!sportingDirector ? (
            <ProfileErrorMessage />
          ) : null}

          {teamSponsorIdentityError ? (
            <TeamSponsorIdentityWarning
              message={
                teamSponsorIdentityError
              }
            />
          ) : null}

          <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
            <DirectorProfileCard
              sportingDirector={
                sportingDirector
              }
              email={user.email ?? null}
              selectedCountry={
                selectedCountry
              }
              isProfileComplete={
                isProfileComplete
              }
              teamSummary={teamSummary}
              teamSponsorIdentity={
                teamSponsorIdentity
              }
              teamAmateurIdentity={teamAmateurIdentity}
            />

            <ObjectivesCard
              isProfileComplete={
                isProfileComplete
              }
              teamSummary={teamSummary}
              teamAmateurIdentity={teamAmateurIdentity}
            />
          </section>

          <section className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <ManagementModuleCard
              href="/jeu/effectif"
              icon="riders"
              title="Effectif"
              status={
                teamSummary
                  ? formatRiderCount(
                      riderCount
                    )
                  : isProfileComplete
                    ? "Création en attente"
                    : "En attente"
              }
              description={
                teamSummary
                  ? `${commercialTeamName} compte ${formatRiderCount(
                      riderCount
                    )} sous contrat pour ${teamSummary.season_name}.`
                  : isProfileComplete
                    ? "Votre profil est complet, mais votre équipe amateur n’a pas encore pu être récupérée."
                    : "Complétez le profil de votre Directeur Sportif pour constituer votre premier effectif amateur."
              }
            />

            <ManagementModuleCard
              href="/jeu/sponsoring"
              icon="sponsor"
              title="Sponsoring"
              status={
                teamSponsorIdentity
                  ? teamSponsorIdentity.sponsor
                      .shortName
                  : sponsoringUnlocked
                    ? "Marché débloqué"
                    : `${reputationPoints} / ${GAMEPLAY_RULES.sponsoringUnlockReputation} réputation`
              }
              description={
                teamSponsorIdentity
                  ? `${teamSponsorIdentity.sponsor.name} est le sponsor principal de ${commercialTeamName}. Le maillot ${teamSponsorIdentity.selectedJersey.name} est actuellement utilisé.`
                  : sponsoringUnlocked
                    ? "Votre réputation permet désormais de comparer les offres, budgets et objectifs proposés."
                    : `Développez votre réputation pour débloquer le marché du sponsoring. Progression : ${getSponsoringUnlockProgress(reputationPoints)} %.`
              }
            />

            <ManagementModuleCard
              icon="training"
              title="Entraînements"
              status="Aucun compte rendu"
              description="Les programmes, la progression et les derniers comptes rendus de vos coureurs apparaîtront ici."
            />

            <ManagementModuleCard
              href="/jeu/calendrier"
              icon="calendar"
              title="Courses"
              status="Calendrier disponible"
              description="Consultez les 28 jours de la saison, filtrez les catégories et préparez les courses accessibles à votre équipe."
            />

            <ManagementModuleCard
              href="/jeu/resultats"
              icon="result"
              title="Résultats / Live"
              status="Prototype jouable"
              description="Suivez une course tronçon par tronçon, inspectez les écarts et testez les premiers classements produits par le moteur."
            />

            <ManagementModuleCard
              icon="academy"
              title="Centre de formation"
              status="À développer"
              description="Détectez, recrutez et accompagnez les jeunes coureurs destinés à rejoindre votre effectif."
            />

            <ManagementModuleCard
              icon="camp"
              title="Stages"
              status="À développer"
              description="Planifiez des stages pour préparer vos coureurs et développer leurs qualités sportives."
            />

            <ManagementModuleCard
              icon="transfer"
              title="Bureau des transferts"
              status="À développer"
              description="Suivez les coureurs disponibles, vos négociations et les futurs mouvements de votre effectif."
            />
          </section>
        </div>
      </section>
    </main>
  );
}

function DirectorProfileCard({
  sportingDirector,
  email,
  selectedCountry,
  isProfileComplete,
  teamSummary,
  teamSponsorIdentity,
  teamAmateurIdentity,
}: {
  sportingDirector:
    SportingDirector | null;
  email: string | null;
  selectedCountry: CountryRow | null;
  isProfileComplete: boolean;
  teamSummary:
    CurrentTeamDashboardSummary | null;
  teamSponsorIdentity:
    TeamSponsorIdentity | null;
  teamAmateurIdentity:
    TeamAmateurIdentity | null;
}) {
  const profileName =
    sportingDirector?.display_name ??
    sportingDirector?.username ??
    "Directeur Sportif";

  const experiencePoints =
    sportingDirector?.experience_points ??
    0;

  const reputationPoints =
    sportingDirector?.reputation_points ??
    0;

  return (
    <article className="rounded-2xl border border-[#315B3E]/20 bg-[#0B302B] p-6 text-[#FFFDF4] shadow-[0_24px_60px_rgba(7,26,23,0.22)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7CCF9C]">
            Directeur Sportif
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Aperçu du profil
          </h2>
        </div>

        <Link
          href="/jeu/directeur-sportif"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#F2C94C]/45 bg-[#F2C94C]/10 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-[#F2C94C] transition hover:bg-[#F2C94C] hover:text-[#071A17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
        >
          <EditIcon />
          Modifier mon profil
        </Link>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <DirectorIdentity
          sportingDirector={
            sportingDirector
          }
          profileName={profileName}
          email={email}
          selectedCountry={
            selectedCountry
          }
        />

        <div className="flex items-start gap-5 md:justify-self-end">
          <TeamJerseyPreview
            amateurJersey={
              teamAmateurIdentity?.jersey ?? DEFAULT_AMATEUR_JERSEY
            }
            amateurTeamName={teamAmateurIdentity?.amateurName}
            sponsor={teamSponsorIdentity?.sponsor}
            sponsorJersey={teamSponsorIdentity?.selectedJersey}
            className="h-32 w-28 shrink-0 drop-shadow-xl"
          />

          <div className="min-w-44 pt-4">
            <TeamSponsorInformation
              teamSummary={teamSummary}
              teamSponsorIdentity={
                teamSponsorIdentity
              }
              teamAmateurIdentity={teamAmateurIdentity}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <SportingDirectorProgression
          experiencePoints={
            experiencePoints
          }
          compact
        />
      </div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <SportingDirectorReputation
          reputationPoints={
            reputationPoints
          }
          compact
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
        <span
          className={
            isProfileComplete
              ? "rounded-full bg-[#7CCF9C]/15 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-[#9BE0BC]"
              : "rounded-full bg-[#F2C94C]/15 px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-[#F2C94C]"
          }
        >
          {isProfileComplete
            ? "Profil initial complété"
            : "Profil incomplet"}
        </span>

        <span className="text-xs font-semibold text-[#9FB5A8]">
          Début de carrière :{" "}
          {sportingDirector?.created_at
            ? formatCareerStart(
                sportingDirector.created_at
              )
            : "Non disponible"}
        </span>
      </div>
    </article>
  );
}

function DirectorIdentity({
  sportingDirector,
  profileName,
  email,
  selectedCountry,
}: {
  sportingDirector:
    SportingDirector | null;
  profileName: string;
  email: string | null;
  selectedCountry: CountryRow | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-5">
      {sportingDirector?.avatar_key ? (
        <SportingDirectorAvatar
          avatarKey={
            sportingDirector.avatar_key
          }
          size="large"
          label={`Avatar de ${profileName}`}
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#42B99A] text-2xl font-black text-[#07302A]">
          {getInitials(profileName)}
        </div>
      )}

      <div className="min-w-0">
        <h3 className="truncate text-2xl font-black">
          {profileName}
        </h3>

        <p className="mt-1 text-sm font-semibold text-[#BFD1C6]">
          {sportingDirector?.username
            ? `@${sportingDirector.username}`
            : "Identifiant indisponible"}
        </p>

        <div className="mt-3 flex items-center gap-3">
          {selectedCountry ? (
            <>
              <CountryFlag
                isoAlpha2={
                  selectedCountry.iso_alpha2
                }
                countryName={
                  selectedCountry.name
                }
              />

              <span className="font-semibold text-[#FFFDF4]">
                {selectedCountry.name}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-[#BFD1C6]">
              Nationalité à compléter
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#9FB5A8]">
          {sportingDirector?.is_email_visible ? (
            <span className="break-all">
              {email ??
                "Adresse e-mail non disponible"}
            </span>
          ) : (
            <>
              <PrivacyIcon />
              <span>
                Adresse e-mail masquée
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamSponsorInformation({
  teamSummary,
  teamSponsorIdentity,
  teamAmateurIdentity,
}: {
  teamSummary:
    CurrentTeamDashboardSummary | null;
  teamSponsorIdentity:
    TeamSponsorIdentity | null;
  teamAmateurIdentity:
    TeamAmateurIdentity | null;
}) {
  const teamName =
    teamSponsorIdentity?.teamName ??
    teamAmateurIdentity?.amateurName ??
    teamSummary?.team_name ??
    "Équipe amateur à constituer";

  return (
    <div>
      {teamSponsorIdentity ? (
        <SponsorLogoMark
          src={teamSponsorIdentity.sponsor.logoPath}
          alt={`Logo de ${teamSponsorIdentity.sponsor.name}`}
          sponsorName={teamSponsorIdentity.sponsor.name}
          primaryColor={teamSponsorIdentity.sponsor.colors.primary}
          backgroundColor={teamSponsorIdentity.sponsor.colors.background}
          textColor={teamSponsorIdentity.sponsor.colors.text}
          className="mb-4 h-14 w-24 rounded-xl p-1.5"
        />
      ) : null}
      <p className="max-w-56 text-xl font-black text-[#FFFDF4]">
        {teamName}
      </p>

      <p className="mt-2 text-sm font-semibold text-[#9FB5A8]">
        {teamSponsorIdentity
          ? `Sponsor principal : ${teamSponsorIdentity.sponsor.name}`
          : "Aucun sponsor actif"}
      </p>

      {teamSponsorIdentity ? (
        <p className="mt-2 text-xs font-semibold text-[#BFD1C6]">
          Maillot :{" "}
          {
            teamSponsorIdentity
              .selectedJersey.name
          }
        </p>
      ) : null}

      {teamSummary ? (
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[#7CCF9C]">
          {teamSummary.season_name} · Jour{" "}
          {teamSummary.season_day_number} / 28
        </p>
      ) : null}
    </div>
  );
}

function ObjectivesCard({
  isProfileComplete,
  teamSummary,
  teamAmateurIdentity,
}: {
  isProfileComplete: boolean;
  teamSummary:
    CurrentTeamDashboardSummary | null;
  teamAmateurIdentity:
    TeamAmateurIdentity | null;
}) {
  const isTeamComplete = Boolean(
    teamAmateurIdentity?.isConfigured && teamSummary
  );
  const completedSteps =
    (isProfileComplete ? 1 : 0) + (isTeamComplete ? 1 : 0);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#315B3E]/25 bg-[#0B302B] p-6 text-[#FFFDF4] shadow-[0_24px_60px_rgba(7,26,23,0.22)] sm:p-7">
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]" />

      <WheelDecoration />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">
              Objectifs
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Vos priorités
            </h2>
          </div>

          <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#D6DFD2]">
            2 étapes d’onboarding
          </span>
        </div>

        <div className="mt-7 rounded-xl border border-[#F2C94C]/30 bg-[#F2C94C]/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-[#F2C94C] px-3 py-1.5 text-xs font-extrabold uppercase tracking-widest text-[#071A17]">
              Objectif bloquant
            </span>

            <span className="text-sm font-bold text-[#F2C94C]">
              {completedSteps} / 2
            </span>
          </div>

          <h3 className="mt-5 text-xl font-black">
            {!isProfileComplete
              ? "Compléter le profil du Directeur Sportif"
              : !isTeamComplete
                ? "Fonder votre équipe amateur"
                : "Votre carrière amateur est prête"}
          </h3>

          <p className="mt-3 leading-7 text-[#D6DFD2]">
            {!isProfileComplete
              ? "Choisissez votre avatar et votre nationalité personnelle."
              : !isTeamComplete
                ? "Définissez le nom, le pays et le maillot fondateur de votre équipe."
                : "Votre identité est complète et vos sept premiers coureurs sont prêts."}
          </p>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#F2C94C] transition-all"
              style={{
                width: `${completedSteps * 50}%`,
              }}
            />
          </div>

          <div className="mt-5">
            {isTeamComplete ? (
              <p className="text-sm font-bold text-[#9BE0BC]">
                Objectif rempli. Votre équipe compte {formatRiderCount(
                  teamSummary?.rider_count ?? 0
                )}.
              </p>
            ) : (
              <Link
                href={
                  isProfileComplete
                    ? "/jeu/directeur-sportif#equipe-amateur"
                    : "/jeu/directeur-sportif"
                }
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#F2C94C] px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B302B]"
              >
                {isProfileComplete
                  ? "Fonder mon équipe"
                  : "Compléter mon profil"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ManagementModuleCard({
  href,
  icon,
  title,
  status,
  description,
}: {
  href?: string;
  icon: ManagementModuleIcon;
  title: string;
  status: string;
  description: string;
}) {
  const className =
    "group block rounded-2xl border border-[#315B3E]/20 bg-white/90 p-6 shadow-[0_16px_38px_rgba(19,60,46,0.09)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(19,60,46,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EAF5F3]";

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D7EEE8] text-[#176951] transition group-hover:bg-[#42B99A] group-hover:text-[#07302A]">
          <ManagementModuleIcon
            icon={icon}
          />
        </span>

        <span className="rounded-full bg-[#EDF2EF] px-3 py-1 text-xs font-bold text-[#60756E]">
          {status}
        </span>
      </div>

      <h2 className="mt-6 text-xl font-black">
        {title}
      </h2>

      <p className="mt-3 leading-7 text-[#60756E]">
        {description}
      </p>

      {href ? (
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#176951]">
          Ouvrir
          <ArrowRightIcon />
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <article className={className}>
      {content}
    </article>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10h12" />
      <path d="m11 5 5 5-5 5" />
    </svg>
  );
}

function CountryFlag({
  isoAlpha2,
  countryName,
}: {
  isoAlpha2: string;
  countryName: string;
}) {
  const normalizedCode = isoAlpha2
    .trim()
    .toLowerCase();

  if (!/^[a-z]{2}$/.test(normalizedCode)) {
    return (
      <span
        role="img"
        aria-label={`Drapeau : ${countryName}`}
      >
        🏳️
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
      className={[
        "fi",
        `fi-${normalizedCode}`,
        "shrink-0 overflow-hidden rounded-sm text-2xl shadow-sm",
      ].join(" ")}
    />
  );
}

function PrivacyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect
        x="4"
        y="8"
        width="12"
        height="9"
        rx="2"
      />

      <path d="M7 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m13.5 3.5 3 3" />
      <path d="m4 13 9.5-9.5 3 3L7 16H4v-3Z" />
    </svg>
  );
}

function ProfileErrorMessage() {
  return (
    <div className="mt-8 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
      Votre compte est bien connecté, mais
      votre profil de Directeur Sportif n’a pas
      pu être récupéré.
    </div>
  );
}

function TeamSponsorIdentityWarning({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
      Le bureau reste disponible, mais
      l’identité commerciale de l’équipe n’a pas
      pu être chargée.

      <span className="mt-1 block text-xs font-medium">
        {message}
      </span>
    </div>
  );
}

function ManagementModuleIcon({
  icon,
}: {
  icon: ManagementModuleIcon;
}) {
  const paths: Record<
    ManagementModuleIcon,
    React.ReactNode
  > = {
    riders: (
      <>
        <circle
          cx="8"
          cy="8"
          r="3"
        />

        <circle
          cx="17"
          cy="9"
          r="2.5"
        />

        <path d="M2.5 20c.5-4.5 2.5-7 5.5-7s5 2.5 5.5 7" />

        <path d="M14 14c3.5-.3 5.5 1.7 6 5" />
      </>
    ),

    sponsor: (
      <>
        <path d="M4 7h16v12H4z" />
        <path d="M8 7V4h8v3" />
        <path d="M4 12h16" />
      </>
    ),

    training: (
      <>
        <path d="M5 7v10M19 7v10" />
        <path d="M2 9v6M22 9v6" />
        <path d="M5 12h14" />
      </>
    ),

    calendar: (
      <>
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="2"
        />

        <path d="M7 3v4M17 3v4M3 10h18" />

        <path d="M8 14h3M13 14h3M8 17h3" />
      </>
    ),

    result: (
      <>
        <path d="M5 20V10h4v10" />
        <path d="M10 20V4h4v16" />
        <path d="M15 20v-7h4v7" />
      </>
    ),

    academy: (
      <>
        <path d="m3 10 9-5 9 5-9 5-9-5Z" />

        <path d="M7 13v4c3 2 7 2 10 0v-4" />

        <path d="M21 10v6" />
      </>
    ),

    camp: (
      <>
        <path d="m4 20 8-16 8 16" />
        <path d="M7 20h10" />
        <path d="m9 20 3-6 3 6" />
      </>
    ),

    transfer: (
      <>
        <path d="M4 7h13" />
        <path d="m14 4 3 3-3 3" />
        <path d="M20 17H7" />
        <path d="m10 14-3 3 3 3" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon]}
    </svg>
  );
}

function formatRiderCount(
  value: number
): string {
  return `${value} coureur${value === 1 ? "" : "s"}`;
}

function getInitials(
  value: string
): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");

  return initials || "DS";
}

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur inattendue est survenue.";
}

function formatCareerStart(
  value: string
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(new Date(value));
}

function MountainDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 420"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-48 h-80 w-full opacity-20"
    >
      <path
        d="M0 365 L170 215 L310 330 L490 105 L665 340 L835 180 L1005 350 L1190 135 L1440 315 L1440 420 L0 420 Z"
        fill="#78B9A3"
        opacity="0.34"
      />

      <path
        d="M0 390 L220 300 L370 380 L545 235 L720 395 L900 285 L1075 400 L1260 255 L1440 365"
        fill="none"
        stroke="#315B3E"
        strokeDasharray="17 15"
        strokeWidth="3"
        opacity="0.38"
      />
    </svg>
  );
}

function WheelDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10 opacity-55"
      style={{
        background:
          "repeating-conic-gradient(transparent 0deg 13deg, rgba(124,207,156,0.10) 13deg 14deg)",
      }}
    />
  );
}
