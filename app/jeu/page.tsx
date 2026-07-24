import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { DashboardEventsCard } from "../../components/game/dashboard-events-card";
import { GameHeader } from "../../components/game/game-header";
import { RankingBadge } from "../../components/game/ranking-badge";
import { RiderAvatar } from "../../components/game/rider-avatar";
import { SponsorLogoMark } from "../../components/game/sponsor-logo";
import { SportingDirectorAvatar } from "../../components/game/sporting-director-avatar";
import { SportingDirectorProgression } from "../../components/game/sporting-director-progression";
import { SportingDirectorReputation } from "../../components/game/sporting-director-reputation";
import { TeamJerseyPreview } from "../../components/game/team-jersey-preview";
import { TeamDivisionBadge } from "../../components/game/team-division-badge";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { ONBOARDING_TUTORIAL_KEY } from "@/lib/tutorial/onboarding";
import { DEFAULT_AMATEUR_JERSEY } from "../../lib/amateur-team";
import {
  GAMEPLAY_RULES,
  getSponsoringUnlockProgress,
  isSponsoringUnlocked,
} from "../../lib/gameplay-rules";
import { buildDashboardEventFeed } from "../../lib/game/dashboard-events";
import type { GameObjective } from "../../lib/game/objectives";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "../../lib/rider-jersey";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getAuthenticatedUser } from "../../lib/supabase/authenticated-user";
import {
  getTeamAmateurIdentity,
  type TeamAmateurIdentity,
} from "../../services/team-amateur-identity";
import {
  getActiveTeamSponsorIdentity,
  type TeamSponsorIdentity,
} from "../../services/team-sponsor-identity";
import {
  getCurrentTeamFinanceOverview,
  type TeamFinanceOverview,
} from "../../services/team-finances";
import {
  getCurrentTeamInventoryOverview,
  type TeamInventoryOverview,
} from "../../services/team-inventory";
import {
  getCurrentDashboardOperationalEvents,
  type DashboardOperationalEvents,
} from "../../services/dashboard-events";
import { getCurrentGameObjectives } from "../../services/game-objectives";

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

type DashboardRider = {
  rider_id: string;
  first_name: string;
  last_name: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};

const dashboardRatingKeys = [
  "mountain",
  "hills",
  "flat",
  "time_trial",
  "cobbles",
  "sprint",
  "acceleration",
  "downhill",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
  "prologue",
] as const satisfies ReadonlyArray<keyof DashboardRider>;

type ManagementModuleIcon =
  | "riders"
  | "sponsor"
  | "training"
  | "calendar"
  | "result"
  | "academy"
  | "camp"
  | "transfer"
  | "finance"
  | "ranking"
  | "equipment"
  | "jersey"
  | "staff"
  | "infrastructure";

const UNSPLASH_RENDER_PARAMS =
  "auto=format&fit=crop&w=600&q=38";

function unsplashWatermark(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?${UNSPLASH_RENDER_PARAMS}`;
}

/**
 * Photographies Unsplash (licence libre, usage commercial autorisé) utilisées
 * en filigrane sur les cartes. Chaque visuel illustre le SENS de la rubrique,
 * pas nécessairement le cyclisme. Pour changer l’ambiance d’une carte, il
 * suffit de remplacer l’identifiant de la photo ci-dessous.
 */
const MODULE_WATERMARKS: Partial<
  Record<ManagementModuleIcon, string>
> = {
  // Transmission et pignons : le matériel au sens propre.
  equipment: unsplashWatermark("1562615193-cbeef074a501"),
  // Lecture de la presse économique : budget et trésorerie.
  finance: unsplashWatermark("1444653614773-995cb1ef9efa"),
  // Trophées alignés : hiérarchie et palmarès.
  ranking: unsplashWatermark("1514820720301-4c4790309f46"),
  // Poignée de main au-dessus d’un contrat : signature d’un sponsor.
  sponsor: unsplashWatermark("1681505531034-8d67054e07f6"),
  // Haltères : le travail physique et la préparation.
  training: unsplashWatermark("1586401100295-7a8096fd231a"),
  // Mécanicien au travail : le personnel technique de l’équipe.
  staff: unsplashWatermark("1675798227643-da319f8ee8f7"),
  // Bâtiments en contre-plongée : les infrastructures à bâtir.
  infrastructure: unsplashWatermark("1508385082359-f38ae991e8f2"),
  // Salle de formation : transmission et apprentissage.
  academy: unsplashWatermark("1431540015161-0bf868a2d407"),
  // Séance de kinésithérapie : soins et remise en forme.
  camp: unsplashWatermark("1540205895360-4ad4cffb3aa8"),
  // Poignée de main : négociation et signature d’un transfert.
  transfer: unsplashWatermark("1521791136064-7986c2920216"),
};

/** Filigrane de la carte Effectif : le groupe de coureurs réuni. */
const ROSTER_WATERMARK = unsplashWatermark(
  "1713937071114-e94d5f8053a0"
);

/** Filigrane du Centre de course : le peloton lancé en course. */
const RACE_HUB_WATERMARK = unsplashWatermark(
  "1517649763962-0c623066013b"
);

/**
 * Calque photo fondu dans le vert foncé de la carte : désaturé, éclairci puis
 * mélangé en « screen », avec un masque radial qui le fait émerger d’un coin
 * et disparaître avant le texte.
 */
function CardWatermark({
  url,
  origin = "100% 100%",
}: {
  url: string;
  origin?: string;
}) {
  const mask = `radial-gradient(120% 110% at ${origin}, rgba(0,0,0,1) 0%, rgba(0,0,0,0.65) 42%, rgba(0,0,0,0) 78%)`;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-[0.14] mix-blend-screen transition-opacity duration-300 group-hover:opacity-[0.22]"
      style={{
        backgroundImage: `url("${url}")`,
        filter:
          "grayscale(1) brightness(1.35) contrast(1.1)",
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}

export default async function GamePage() {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const financeOverviewPromise = loadDashboardValue(
    getCurrentTeamFinanceOverview(supabase, user.id),
    null as TeamFinanceOverview | null,
    "Impossible de récupérer la situation financière de l’équipe :"
  );
  const inventoryOverviewPromise = loadDashboardValue(
    getCurrentTeamInventoryOverview(user.id),
    null as TeamInventoryOverview | null,
    "Impossible de récupérer l’inventaire de l’équipe :"
  );
  const gameObjectivesPromise = loadDashboardValue(
    getCurrentGameObjectives(supabase),
    [] as GameObjective[],
    "Impossible de récupérer les objectifs de carrière :"
  );

  const [
    profileResult,
    countriesResult,
    teamSummaryResult,
    rosterResult,
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

    supabase.rpc("get_current_team_roster"),
  ]);

  const dashboardTeamSummary =
    (teamSummaryResult.data as CurrentTeamDashboardSummary | null) ?? null;
  const dashboardTeamId = dashboardTeamSummary?.team_id ?? null;
  const dashboardRiderIds = ((rosterResult.data ?? []) as DashboardRider[]).map(
    (rider) => rider.rider_id
  );

  const sponsorIdentityPromise: Promise<{
    identity: TeamSponsorIdentity | null;
    error: string | null;
  }> = (dashboardTeamId
    ? getActiveTeamSponsorIdentity(dashboardTeamId)
    : Promise.resolve(null)
  )
    .then((identity) => ({ identity, error: null }))
    .catch((error: unknown) => {
      console.error(
        "Impossible de récupérer l’identité commerciale de l’équipe :",
        error
      );

      return {
        identity: null,
        error: getErrorMessage(error),
      };
    });

  const [
    sponsorIdentityResult,
    teamAmateurIdentity,
    financeOverview,
    inventoryOverview,
    gameObjectives,
    dashboardOperationalEvents,
  ] = await Promise.all([
    sponsorIdentityPromise,
    loadDashboardValue(
      dashboardTeamId
        ? getTeamAmateurIdentity(dashboardTeamId)
        : Promise.resolve(null),
      null as TeamAmateurIdentity | null,
      "Impossible de récupérer l’identité amateur de l’équipe :"
    ),
    financeOverviewPromise,
    inventoryOverviewPromise,
    gameObjectivesPromise,
    loadDashboardValue(
      dashboardTeamSummary
        ? getCurrentDashboardOperationalEvents({
            authUserId: user.id,
            teamId: dashboardTeamSummary.team_id,
            seasonId: dashboardTeamSummary.season_id,
            currentDayNumber: dashboardTeamSummary.season_day_number,
            riderIds: dashboardRiderIds,
          })
        : Promise.resolve({
            events: [],
            youthDevelopmentAlertCount: 0,
          } satisfies DashboardOperationalEvents),
      {
        events: [],
        youthDevelopmentAlertCount: 0,
      } satisfies DashboardOperationalEvents,
      "Impossible de récupérer les événements du bureau :"
    ),
  ]);

  const teamSponsorIdentity = sponsorIdentityResult.identity;
  const teamSponsorIdentityError = sponsorIdentityResult.error;

  let raceRosterAlertCount = 0;

  try {
    const alertResult = await supabase
      .from("race_roster_notifications")
      .select("id", { count: "exact", head: true })
      .eq("requires_action", true)
      .is("read_at", null);

    if (alertResult.error) throw alertResult.error;
    raceRosterAlertCount = alertResult.count ?? 0;
  } catch (error) {
    console.error(
      "Impossible de récupérer les remplacements médicaux en attente :",
      error
    );
  }

  const sportingDirector =
    profileResult.data;

  const teamSummary = dashboardTeamSummary;

  if (profileResult.error) {
    console.error(
      "Impossible de récupérer le profil du Directeur Sportif :",
      {
        code: profileResult.error.code,
        message: profileResult.error.message,
      }
    );
  }

  if (countriesResult.error) {
    console.error(
      "Impossible de récupérer le référentiel des pays :",
      {
        code: countriesResult.error.code,
        message: countriesResult.error.message,
      }
    );
  }

  if (teamSummaryResult.error) {
    console.error(
      "Impossible de récupérer le résumé de l’équipe :",
      {
        code: teamSummaryResult.error.code,
        message:
          teamSummaryResult.error.message,
      }
    );
  }

  if (rosterResult.error) {
    console.error(
      "Impossible de récupérer l’effectif pour le bureau du Directeur Sportif :",
      {
        code: rosterResult.error.code,
        message: rosterResult.error.message,
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

  const featuredRiders = [
    ...((rosterResult.data ?? []) as DashboardRider[]),
  ]
    .sort(
      (left, right) =>
        getDashboardRiderAverage(right) -
        getDashboardRiderAverage(left)
    )
    .slice(0, 6);

  const riderJersey = teamSponsorIdentity
    ? createSponsoredRiderJersey({
        colors: teamSponsorIdentity.sponsor.colors,
        style: teamSponsorIdentity.selectedJersey.style,
      })
    : teamAmateurIdentity
      ? createAmateurRiderJersey(teamAmateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;

  const reputationPoints = sportingDirector?.reputation_points ?? 0;
  const sponsoringUnlocked = isSponsoringUnlocked(reputationPoints);
  const readyObjectiveCount = gameObjectives.filter(
    (objective) => objective.completed && !objective.claimedAt
  ).length;
  const youthDevelopmentAlertCount =
    dashboardOperationalEvents.youthDevelopmentAlertCount;
  const dashboardEvents = buildDashboardEventFeed({
    currentDayNumber: teamSummary?.season_day_number ?? 1,
    currency: financeOverview?.currency ?? "EUR",
    operationalEvents: dashboardOperationalEvents.events,
    transactions: financeOverview?.transactions ?? [],
    objectives: gameObjectives,
  });

  return (
    <main className="min-h-screen text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={displayName}
        sponsor={teamSponsorIdentity?.sponsor ?? null}
      />

      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <header
            data-tutorial-id="dashboard-overview"
            className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start"
          >
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
                Bureau du Directeur Sportif
              </p>

              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Bonjour, {displayName}.
              </h1>
            </div>

            <div className="flex w-full flex-wrap items-stretch gap-3 xl:w-auto xl:justify-self-end">
              <TutorialLaunchButton
                tutorialKey={ONBOARDING_TUTORIAL_KEY}
              />
              <InventoryShortcut
                totalUnits={inventoryOverview?.summary.totalUnits ?? 0}
                availableUnits={inventoryOverview?.summary.availableUnits ?? 0}
              />
              <ObjectivesShortcut
                totalCount={gameObjectives.length}
                readyCount={readyObjectiveCount}
              />
              <JerseyShortcut />
            </div>
          </header>

          <div
            className="mt-10"
            data-tutorial-id="dashboard-news-feed"
          >
            <DashboardEventsCard events={dashboardEvents} />
          </div>

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

          <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.38fr)_minmax(300px,0.62fr)]">
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
              financeOverview={financeOverview}
            />

            <div className="grid content-start gap-6">
              <ManagementModuleCard
                href="/jeu/sponsoring"
                icon="sponsor"
                tutorialId="dashboard-sponsoring"
                title="Sponsoring"
                status={
                  teamSponsorIdentity
                    ? teamSponsorIdentity.sponsor.shortName
                    : sponsoringUnlocked
                      ? "Marché débloqué"
                      : `${reputationPoints} / ${GAMEPLAY_RULES.sponsoringUnlockReputation} réputation`
                }
                description={
                  teamSponsorIdentity
                    ? `${teamSponsorIdentity.sponsor.name} est le sponsor principal de ${commercialTeamName}. Le maillot ${teamSponsorIdentity.selectedJersey.name} est actuellement utilisé.`
                    : sponsoringUnlocked
                      ? "Votre réputation permet désormais de comparer les offres, budgets et objectifs proposés."
                      : `Développez votre réputation pour débloquer le marché du sponsoring. Progression : ${getSponsoringUnlockProgress(reputationPoints)} %.`
                }
              />

              <TeamRosterCard
                status={
                  teamSummary
                    ? formatRiderCount(riderCount)
                    : isProfileComplete
                      ? "Création en attente"
                      : "En attente"
                }
                description={
                  teamSummary
                    ? `${commercialTeamName} compte ${formatRiderCount(riderCount)} sous contrat pour ${teamSummary.season_name}.`
                    : isProfileComplete
                      ? "Votre profil est complet, mais votre équipe amateur n’a pas encore pu être récupérée."
                      : "Complétez le profil de votre Directeur Sportif pour constituer votre premier effectif amateur."
                }
                riders={featuredRiders}
                jersey={riderJersey}
              />
            </div>
          </section>

          <RaceOperationsCard alertCount={raceRosterAlertCount} />

          <section className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <ManagementModuleCard
              href="/jeu/entrainement"
              icon="training"
              title="Entraînements"
              status="Séance quotidienne · 8 h"
              description="Réglez l’intensité, le domaine et l’entraîneur de chaque coureur, puis consultez les gains de caractéristiques."
            />

            <ManagementModuleCard
              href="/jeu/staff"
              icon="staff"
              title="Staff"
              status="Marché ouvert"
              description="Recrutez entraîneurs, scouts, personnel médical et spécialistes, puis maîtrisez leur masse salariale."
            />

            <ManagementModuleCard
              href="/jeu/transferts"
              icon="transfer"
              title="Bureau des transferts"
              status="Marché ouvert"
              description="Enchérissez sur les talents du jour, négociez avec les autres DS et signez les agents libres."
            />

            <ManagementModuleCard
              href="/jeu/finances"
              icon="finance"
              title="Finances"
              status={
                financeOverview
                  ? formatDashboardCurrency(
                      financeOverview.balance,
                      financeOverview.currency
                    )
                  : "À initialiser"
              }
              description="Suivez le solde réel, les quatre échéances sponsor et la projection de trésorerie jusqu’à la fin de saison."
            />

            <ManagementModuleCard
              href="/jeu/classements"
              icon="ranking"
              title="Classements UCI"
              status={
                financeOverview?.teamRank
                  ? `#${financeOverview.teamRank}`
                  : "Non classée"
              }
              description="Comparez toutes les équipes, les coureurs et les nations, avec les frontières de divisions clairement identifiées."
            />

            <ManagementModuleCard
              href="/jeu/materiel"
              icon="equipment"
              title="Matériel"
              status="Catalogue ouvert"
              description="Achetez casques, textiles, lunettes, chaussures, roues et cadres, puis attribuez-les à vos coureurs."
            />

            <ManagementModuleCard
              href="/jeu/centre-de-soin"
              icon="camp"
              title="Centre de soin"
              status="Infirmerie & forme"
              description="Suivez les blessures, appliquez des protocoles médicaux et programmez les stages de remise en forme."
            />

            <ManagementModuleCard
              href="/jeu/centre-de-formation"
              icon="academy"
              title="Centre de formation"
              status="Scouting mondial"
              alertCount={youthDevelopmentAlertCount}
              description="Envoyez vos scouts, signez les jeunes talents et accompagnez leur progression quotidienne jusqu’aux professionnels."
            />

            <ManagementModuleCard
              href="/jeu/infrastructures"
              icon="infrastructure"
              title="Infrastructures"
              status="Débloquées au niveau 10"
              description="Investissez des fonds très importants dans des bâtiments capables de soutenir durablement les entraînements, les soins et la gestion de l’équipe."
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
  financeOverview,
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
  financeOverview:
    TeamFinanceOverview | null;
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
    <article
      data-tutorial-id="dashboard-director-profile"
      className="rounded-2xl border border-[#315B3E]/20 bg-[#0B302B] p-6 text-[#FFFDF4] shadow-[0_24px_60px_rgba(7,26,23,0.22)] sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7CCF9C]">
            Directeur Sportif
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
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
            {financeOverview ? (
              <span className="mt-3 block">
                <TeamDivisionBadge
                  division={financeOverview.divisionCode}
                  dark
                  compact
                />
              </span>
            ) : null}
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

      <div
        data-tutorial-id="dashboard-reputation"
        className="mt-5 border-t border-white/10 pt-5"
      >
        <SportingDirectorReputation
          reputationPoints={
            reputationPoints
          }
          compact
        />
      </div>

      {financeOverview ? (
        <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
          <Link
            href="/jeu/finances"
            className="rounded-xl border border-white/12 bg-white/7 px-4 py-3 transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
          >
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9BE0BC]">
              Budget disponible
            </span>
            <span
              className={`mt-1 block text-xl font-black ${
                financeOverview.balance < 0 ? "text-[#FF9D8F]" : "text-[#F2C94C]"
              }`}
            >
              {formatDashboardCurrency(
                financeOverview.balance,
                financeOverview.currency
              )}
            </span>
          </Link>

          <RankingBadge
            rank={financeOverview.teamRank}
            points={financeOverview.teamPoints}
            label="Classement en cours"
            dark
          />
        </div>
      ) : null}

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
          Début de carrière :{" "}
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
          ? `Sponsor principal : ${teamSponsorIdentity.sponsor.name}`
          : "Aucun sponsor actif"}
      </p>

      {teamSponsorIdentity ? (
        <p className="mt-2 text-xs font-semibold text-[#BFD1C6]">
          Maillot :{" "}
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

function TeamRosterCard({
  status,
  description,
  riders,
  jersey,
}: {
  status: string;
  description: string;
  riders: DashboardRider[];
  jersey: RiderJerseyAppearance;
}) {
  const leadingRider = riders[0] ?? null;

  return (
    <Link
      href="/jeu/effectif"
      data-tutorial-id="dashboard-roster"
      className="group relative isolate flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0B302B] p-6 text-[#FFFDF4] shadow-[0_24px_60px_rgba(7,26,23,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_66px_rgba(7,26,23,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EAF5F3]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center opacity-[0.4] transition-opacity duration-300 group-hover:opacity-[0.52]"
        style={{
          backgroundImage: `url("${ROSTER_WATERMARK}")`,
          filter:
            "grayscale(0.35) brightness(0.95) contrast(1.05)",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,48,43,0.55)_0%,rgba(11,48,43,0.78)_55%,rgba(11,48,43,0.95)_100%)]"
      />

      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#42B99A]/15 text-[#9BE0BC] transition group-hover:bg-[#42B99A] group-hover:text-[#07302A]">
          <ManagementModuleIcon icon="riders" />
        </span>

        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#BFD1C6]">
          {status}
        </span>
      </div>

      <h2 className="mt-5 text-xl font-black text-white">
        Effectif
      </h2>

      <div
        className="relative mt-6"
        aria-label={
          leadingRider
            ? `Photo d’équipe des ${riders.length} coureurs les mieux notés`
            : "Emplacement de la future photo d’équipe"
        }
      >
        {leadingRider ? (
          <div className="flex flex-col items-center">
            <span
              title={`${leadingRider.first_name} ${leadingRider.last_name} · Moyenne ${getDashboardRiderAverage(leadingRider)}`}
            >
              <RiderAvatar
                profileKey={leadingRider.avatar_profile_key}
                seed={leadingRider.avatar_seed}
                riderId={leadingRider.rider_id}
                age={leadingRider.age}
                jersey={jersey}
                label={`Portrait de ${leadingRider.first_name} ${leadingRider.last_name}`}
                className="h-24 w-24 border-[3px] border-[#F2C94C]/80 shadow-2xl"
              />
            </span>

            <span className="mt-3 max-w-full truncate text-center text-xs font-extrabold uppercase tracking-[0.12em] text-[#F2C94C]">
              {leadingRider.first_name} {leadingRider.last_name} · MOY {getDashboardRiderAverage(leadingRider)}
            </span>

            {riders.length > 1 ? (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {riders.slice(1).map((rider) => {
                  const riderName = `${rider.first_name} ${rider.last_name}`;

                  return (
                    <span
                      key={rider.rider_id}
                      title={`${riderName} · Moyenne ${getDashboardRiderAverage(rider)}`}
                    >
                      <RiderAvatar
                        profileKey={rider.avatar_profile_key}
                        seed={rider.avatar_seed}
                        riderId={rider.rider_id}
                        age={rider.age}
                        jersey={jersey}
                        label={`Portrait de ${riderName}`}
                        className="h-12 w-12 border-2 border-[#9BE0BC]/40 shadow-lg"
                      />
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[#9BE0BC]/40 bg-white/5 text-[#9BE0BC]">
              <ManagementModuleIcon icon="riders" />
            </span>
            <span className="mt-3 text-xs font-bold uppercase tracking-wider text-[#9FB5A8]">
              Équipe à constituer
            </span>
          </div>
        )}
      </div>

      <p className="mt-4 leading-7 text-[#BFD1C6]">
        {description}
      </p>

      <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-extrabold text-[#9BE0BC]">
        Ouvrir
        <ArrowRightIcon />
      </span>
    </Link>
  );
}

function getDashboardRiderAverage(
  rider: DashboardRider
): number {
  const ratingsTotal = dashboardRatingKeys.reduce(
    (total, ratingKey) => total + rider[ratingKey],
    0
  );

  return Math.round(
    ratingsTotal / dashboardRatingKeys.length
  );
}

function RaceOperationsCard({ alertCount }: { alertCount: number }) {
  const entries = [
    {
      href: "/jeu/calendrier",
      icon: "calendar" as const,
      eyebrow: "Préparer",
      title: "Inscriptions & calendrier",
      description: "Choisissez vos courses, filtrez les catégories et composez les équipes engagées.",
      status:
        alertCount > 0
          ? `${alertCount} remplacement${alertCount > 1 ? "s" : ""} requis`
          : "Saison ouverte",
    },
    {
      href: "/jeu/resultats",
      icon: "result" as const,
      eyebrow: "Vivre",
      title: "Résultats & Live",
      description: "Rejoignez les directs de 14 h et 18 h, suivez les écarts et consultez les replays.",
      status: "Directs à 14 h / 18 h",
    },
  ];

  return (
    <section className="group relative isolate mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0B302B] text-[#FFFDF4] shadow-[0_24px_60px_rgba(7,26,23,0.22)]" aria-labelledby="race-hub-title">
      <CardWatermark
        url={RACE_HUB_WATERMARK}
        origin="100% 50%"
      />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-5 py-4 sm:px-7">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">Centre de course</p>
          <h2 id="race-hub-title" className="mt-1 text-xl font-black text-[#FFFDF4]">Planifier puis vibrer</h2>
        </div>
        <span className="rounded-full bg-[#F2C94C]/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#F2C94C]">
          Accès prioritaire
        </span>
      </header>

      <div className="grid md:grid-cols-2">
        {entries.map((entry, index) => (
          <Link
            key={entry.href}
            href={entry.href}
            className={`group relative grid min-h-48 grid-cols-[auto_minmax(0,1fr)] gap-4 p-6 transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#42B99A] sm:p-7 ${
              index === 1 ? "border-t border-white/10 md:border-l md:border-t-0" : ""
            }`}
          >
            {index === 1 ? (
              <span aria-hidden="true" className="absolute left-1/2 top-0 h-px w-20 -translate-x-1/2 bg-linear-to-r from-transparent via-[#F2C94C] to-transparent md:left-0 md:top-1/2 md:h-20 md:w-px md:-translate-y-1/2 md:translate-x-0 md:bg-linear-to-b" />
            ) : null}
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#42B99A]/15 text-[#9BE0BC] transition group-hover:bg-[#42B99A] group-hover:text-[#07302A]">
              <ManagementModuleIcon icon={entry.icon} />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7CCF9C]">{entry.eyebrow}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    index === 0 && alertCount > 0
                      ? "bg-[#EF5B65]/20 text-[#FFB0B6] ring-1 ring-[#EF5B65]/40"
                      : "bg-white/10 text-[#BFD1C6]"
                  }`}
                >
                  {entry.status}
                </span>
              </span>
              <span className="mt-3 block text-xl font-black text-[#FFFDF4]">{entry.title}</span>
              <span className="mt-2 block text-sm font-medium leading-6 text-[#BFD1C6]">{entry.description}</span>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[#9BE0BC]">
                Ouvrir <ArrowRightIcon />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function InventoryShortcut({
  totalUnits,
  availableUnits,
}: {
  totalUnits: number;
  availableUnits: number;
}) {
  return (
    <Link
      href="/jeu/inventaire"
      className="group min-w-0 flex-1 rounded-2xl border border-[#315B3E]/15 bg-white/75 p-3.5 shadow-[0_12px_30px_rgba(19,60,46,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#278B70]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] sm:min-w-64 sm:flex-none"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0B302B] text-[#9BE0BC]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-6 w-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8 12 4l8 4-8 4-8-4Z" />
            <path d="m4 8 1 9 7 3 7-3 1-9M12 12v8" />
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-4">
            <span className="text-sm font-black text-[#183F37]">Inventaire</span>
            <span className="text-[#176951] transition-transform group-hover:translate-x-0.5">→</span>
          </span>
          <span className="mt-1 block text-xs font-bold text-[#60756E]">
            {formatInventoryUnits(totalUnits)} · {availableUnits} disponible{availableUnits > 1 ? "s" : ""}
          </span>
        </span>
      </span>
    </Link>
  );
}

function ObjectivesShortcut({
  totalCount,
  readyCount,
}: {
  totalCount: number;
  readyCount: number;
}) {
  return (
    <Link
      href="/jeu/objectifs"
      title={
        readyCount > 0
          ? `${readyCount} récompense${readyCount > 1 ? "s" : ""} à récupérer`
          : "Consulter les objectifs de carrière"
      }
      className="group relative flex min-w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-[#A67C00]/55 bg-[#F2C94C] px-3 py-2.5 text-[#183F37] shadow-[0_12px_30px_rgba(122,91,9,0.2)] transition hover:-translate-y-0.5 hover:bg-[#FFDB63] hover:shadow-[0_16px_34px_rgba(122,91,9,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#183F37] sm:min-w-28"
    >
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-[#183F37] text-[#F2C94C] transition group-hover:bg-[#0B302B]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="m15 9 5-5M17 4h3v3" />
        </svg>
        {readyCount > 0 ? (
          <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[#F2C94C] bg-[#C72F5E] px-1 text-[9px] font-black leading-none text-white">
            {readyCount > 9 ? "9+" : readyCount}
          </span>
        ) : null}
      </span>
      <span className="text-xs font-black text-[#183F37]">Objectifs</span>
      <span className="text-[9px] font-extrabold leading-none text-[#594408]">
        {readyCount > 0 ? "À récupérer" : `${totalCount} suivis`}
      </span>
    </Link>
  );
}

function JerseyShortcut() {
  return (
    <Link
      href="/jeu/maillot"
      title="Modifier le maillot amateur"
      className="group flex min-w-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#315B3E]/15 bg-white/75 px-3 py-2.5 text-[#176951] shadow-[0_12px_30px_rgba(19,60,46,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#278B70]/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] sm:min-w-24"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#DDF3E7] transition group-hover:bg-[#176951] group-hover:text-white">
        <ManagementModuleIcon icon="jersey" />
      </span>
      <span className="text-xs font-black text-[#183F37]">Maillot</span>
    </Link>
  );
}

function ManagementModuleCard({
  href,
  icon,
  title,
  status,
  alertCount = 0,
  description,
  tutorialId,
}: {
  href?: string;
  icon: ManagementModuleIcon;
  title: string;
  status: string;
  alertCount?: number;
  description: string;
  tutorialId?: string;
}) {
  const className =
    `group relative isolate block overflow-hidden rounded-2xl border bg-[#0B302B] p-6 text-[#FFFDF4] shadow-[0_20px_48px_rgba(7,26,23,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(7,26,23,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42B99A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EAF5F3] ${
      alertCount > 0 ? "border-[#F06A62]/70" : "border-white/10"
    }`;

  const watermarkUrl = MODULE_WATERMARKS[icon];

  const content = (
    <>
      {watermarkUrl ? (
        <CardWatermark url={watermarkUrl} />
      ) : null}
      {alertCount > 0 ? (
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[#F06A62]" />
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#42B99A]/15 text-[#9BE0BC] transition group-hover:bg-[#42B99A] group-hover:text-[#07302A]">
          <ManagementModuleIcon
            icon={icon}
          />
        </span>

        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
          alertCount > 0
            ? "bg-[#F06A62]/20 text-[#FFB1AA]"
            : "bg-white/10 text-[#BFD1C6]"
        }`}>
          {alertCount > 0
            ? `${alertCount > 9 ? "9+" : alertCount} rapport${alertCount > 1 ? "s" : ""}`
            : status}
        </span>
      </div>

      <h2 className="mt-6 text-xl font-black text-white">
        {title}
      </h2>

      <p className="mt-3 leading-7 text-[#BFD1C6]">
        {description}
      </p>

      {href ? (
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#9BE0BC]">
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
        data-tutorial-id={tutorialId}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <article
      data-tutorial-id={tutorialId}
      className={className}
    >
      {content}
    </article>
  );
}

function formatInventoryUnits(value: number) {
  return `${value} objet${value > 1 ? "s" : ""}`;
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
        aria-label={`Drapeau : ${countryName}`}
      >
        🏳️
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={`Drapeau : ${countryName}`}
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

    finance: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <path d="M8 4v16M16 4v16" />
      </>
    ),

    ranking: (
      <>
        <path d="M5 20V10h4v10" />
        <path d="M10 20V4h4v16" />
        <path d="M15 20v-7h4v7" />
        <path d="M3 20h18" />
      </>
    ),

    equipment: (
      <>
        <circle cx="7" cy="17" r="3" />
        <circle cx="17" cy="17" r="3" />
        <path d="M7 17 11 8h4l2 9M9 13h7M11 8 9 5h4" />
      </>
    ),

    jersey: (
      <>
        <path d="m8 4-5 3 2 5 3-2v10h8V10l3 2 2-5-5-3-2 3h-4L8 4Z" />
        <path d="M10 7v13M14 7v13M8 13h8" />
      </>
    ),

    staff: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c.5-4.5 2.5-7 6-7s5.5 2.5 6 7" />
        <path d="M14 14c4-.3 6.5 1.7 7 5" />
        <path d="M19 3v4M17 5h4" />
      </>
    ),

    infrastructure: (
      <>
        <path d="M3 21h18M5 21V9l7-5 7 5v12" />
        <path d="M9 21v-6h6v6M8 11h2M14 11h2" />
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

async function loadDashboardValue<T>(
  promise: Promise<T>,
  fallback: T,
  errorMessage: string
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error(errorMessage, error);
    return fallback;
  }
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

function formatDashboardCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
