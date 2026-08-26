import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { CollapsibleMobileRiderRatings } from "@/components/game/collapsible-mobile-rider-ratings";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import { EquipmentRatingBonus } from "@/components/game/equipment-rating-bonus";
import { GameHeader } from "../../../components/game/game-header";
import { RiderAvatar } from "../../../components/game/rider-avatar";
import { RiderSeasonPlanning } from "../../../components/game/rider-season-planning";
import { TeamContractManagement } from "@/components/game/team-contract-management";
import { PotentialStars } from "../../../components/game/potential-stars";
import {
  createAmateurRiderJersey,
  createNationalChampionRiderJersey,
  createContinentalChampionRiderJersey,
  createWorldChampionRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "../../../lib/rider-jersey";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getAuthenticatedUser } from "../../../lib/supabase/authenticated-user";
import { getTeamAmateurIdentityForAuthUser } from "../../../services/team-amateur-identity";
import {
  getActiveTeamSponsorIdentityForAuthUser,
  type TeamSponsorIdentity,
} from "../../../services/team-sponsor-identity";
import {
  getRiderSportingProfile,
  type RiderRatingImportance,
  type RiderRatingKey,
  type RiderRatings,
} from "../../../lib/game/rider-profile";
import { getEquipmentRatingBonusTotals } from "@/lib/game/equipment";
import { getRiderRatingColorClasses } from "../../../lib/game/rider-rating-colors";
import {
  getNextRosterSortDirection,
  parseRosterSortDirection,
  parseRosterSortKey,
  sortRosterItems,
  type RosterSortDirection,
  type RosterSortKey,
  type RosterSortValue,
} from "../../../lib/game/roster-sort";
import {
  getCurrentTeamHealthOverview,
  type RiderFormCamp,
  type RiderMedicalInjury,
} from "../../../services/team-health";
import { getCurrentTeamRiderSeasonPlanning } from "../../../services/rider-season-planning";
import { getTeamContractManagementOverview } from "@/services/team-contract-management";
import { getActiveChampionshipTitlesForRiders } from "@/services/rider-championship-titles";
import { getRiderEquipmentEffectsByRiderId } from "@/services/rider-equipment-effects";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import {
  ROSTER_TUTORIAL_KEY,
  ROSTER_TUTORIAL_ROUTE,
} from "@/lib/tutorial/roster";

export const metadata: Metadata = {
  title: "Effectif",
  description: "Consultez les coureurs de votre équipe dans Cyclostratège.",
};

type RiderRow = {
  rider_id: string;
  first_name: string;
  last_name: string;
  country_id: string;
  country_name: string;
  country_iso_alpha2: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
  potential_steps: number;
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

type RiderRosterHealth = {
  form: number;
  injury: RiderMedicalInjury | null;
  formCamp: RiderFormCamp | null;
};

type RatingKey =
  | "mountain"
  | "hills"
  | "flat"
  | "time_trial"
  | "cobbles"
  | "sprint"
  | "acceleration"
  | "downhill"
  | "endurance"
  | "resistance"
  | "recovery"
  | "breakaway"
  | "prologue";

const ratingColumns: Array<{
  key: RatingKey;
  label: string;
  fullLabel: string;
  importance: RiderRatingImportance;
}> = [
  {
    key: "mountain",
    label: "MO",
    fullLabel: "Montagne",
    importance: "primary",
  },
  {
    key: "hills",
    label: "VAL",
    fullLabel: "Vallon",
    importance: "primary",
  },
  {
    key: "flat",
    label: "PLA",
    fullLabel: "Plaine",
    importance: "primary",
  },
  {
    key: "time_trial",
    label: "CLM",
    fullLabel: "Contre-la-montre",
    importance: "primary",
  },
  {
    key: "cobbles",
    label: "PAV",
    fullLabel: "Pavés",
    importance: "primary",
  },
  {
    key: "sprint",
    label: "SPR",
    fullLabel: "Sprint",
    importance: "primary",
  },
  {
    key: "acceleration",
    label: "ACC",
    fullLabel: "Accélération",
    importance: "secondary",
  },
  {
    key: "downhill",
    label: "DES",
    fullLabel: "Descente",
    importance: "secondary",
  },
  {
    key: "endurance",
    label: "END",
    fullLabel: "Endurance",
    importance: "secondary",
  },
  {
    key: "resistance",
    label: "RES",
    fullLabel: "Résistance",
    importance: "secondary",
  },
  {
    key: "recovery",
    label: "REC",
    fullLabel: "Récupération",
    importance: "secondary",
  },
  {
    key: "breakaway",
    label: "BAR",
    fullLabel: "Baroudeur",
    importance: "secondary",
  },
  {
    key: "prologue",
    label: "PRO",
    fullLabel: "Prologue",
    importance: "secondary",
  },
];

export default async function TeamRosterPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string | string[];
    direction?: string | string[];
    vue?: string | string[];
    succes?: string | string[];
    erreur?: string | string[];
  }>;
}) {
  const rosterQuery = await searchParams;
  const requestedView = getFirstSearchParam(rosterQuery.vue);
  const activeView =
    requestedView === "planning" || requestedView === "contrats"
      ? requestedView
      : "statistiques";
  const currentSortKey = parseRosterSortKey(
    getFirstSearchParam(rosterQuery.sort),
  );
  const currentSortDirection = currentSortKey
    ? parseRosterSortDirection(
        getFirstSearchParam(rosterQuery.direction),
        currentSortKey,
      )
    : "asc";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const sponsorIdentityPromise: Promise<{
    identity: TeamSponsorIdentity | null;
    error: string | null;
  }> = getActiveTeamSponsorIdentityForAuthUser(user.id)
    .then((identity) => ({ identity, error: null }))
    .catch((error: unknown) => {
      console.error(
        "Impossible de récupérer l’identité commerciale de l’équipe :",
        error,
      );

      return {
        identity: null,
        error: getErrorMessage(error),
      };
    });

  const [
    rosterResult,
    planningOverview,
    contractOverview,
    sponsorIdentityResult,
    teamAmateurIdentity,
    healthOverview,
    rosterTutorialProgress,
  ] = await Promise.all([
    supabase.rpc("get_current_team_roster_with_potential"),
    activeView === "planning"
      ? getCurrentTeamRiderSeasonPlanning({
          authUserId: user.id,
        }).catch((error: unknown) => {
          console.error(
            "Impossible de récupérer le planning de l’effectif :",
            error,
          );
          return null;
        })
      : Promise.resolve(null),
    activeView === "contrats"
      ? getTeamContractManagementOverview(user.id).catch((error: unknown) => {
          console.error(
            "Impossible de récupérer la gestion contractuelle de l’effectif :",
            error,
          );
          return null;
        })
      : Promise.resolve(null),
    sponsorIdentityPromise,
    getTeamAmateurIdentityForAuthUser(user.id).catch((error: unknown) => {
      console.error(
        "Impossible de récupérer l’identité amateur de l’équipe :",
        error,
      );
      return null;
    }),
    getCurrentTeamHealthOverview(user.id).catch((error: unknown) => {
      console.error(
        "Impossible de récupérer les indisponibilités médicales :",
        error,
      );
      return null;
    }),
    getAuthenticatedTutorialProgress(supabase, ROSTER_TUTORIAL_KEY).catch(
      (error: unknown) => {
        console.error(
          "Impossible de reprendre le didacticiel de l’effectif :",
          error,
        );
        return null;
      },
    ),
  ]);

  const teamSponsorIdentity = sponsorIdentityResult.identity;
  const teamSponsorIdentityError = sponsorIdentityResult.error;
  const healthByRiderId = new Map(
    (healthOverview?.riders ?? []).map((rider) => [
      rider.id,
      {
        form: rider.form,
        injury: rider.injury,
        formCamp: rider.formCamp,
      },
    ]),
  );

  if (rosterResult.error) {
    console.error("Impossible de récupérer l’effectif :", {
      code: rosterResult.error.code,
      message: rosterResult.error.message,
      details: rosterResult.error.details,
      hint: rosterResult.error.hint,
    });
  }

  const riders = (rosterResult.data ?? []) as RiderRow[];
  const riderIds = riders.map((rider) => rider.rider_id);
  const [activeChampionshipTitles, riderEquipmentEffectsByRiderId] =
    await Promise.all([
      getActiveChampionshipTitlesForRiders(supabase, riderIds).catch(
        (error: unknown) => {
          console.error(
            "Impossible de récupérer les maillots de champions de l’effectif :",
            error,
          );
          return {
            national: new Map(),
            continental: new Map(),
            world: new Map(),
          };
        },
      ),
    getRiderEquipmentEffectsByRiderId(riderIds).catch((error: unknown) => {
      console.error(
        "Impossible de récupérer les bonus d’équipement de l’effectif :",
        error,
      );
      return new Map();
    }),
    ]);
  const activeNationalTitlesByRiderId = activeChampionshipTitles.national;
  const activeContinentalTitlesByRiderId =
    activeChampionshipTitles.continental;
  const activeWorldTitlesByRiderId = activeChampionshipTitles.world;
  const equipmentRatingBonusesByRiderId = new Map(
    [...riderEquipmentEffectsByRiderId].map(([riderId, effects]) => [
      riderId,
      getEquipmentRatingBonusTotals(effects),
    ]),
  );
  const nationalChampionJerseyByRiderId = new Map(
    [...activeNationalTitlesByRiderId].map(([riderId, title]) => [
      riderId,
      createNationalChampionRiderJersey({
        countryCode: title.countryCode,
        championshipType: title.championshipType,
      }),
    ]),
  );
  for (const [riderId, title] of activeContinentalTitlesByRiderId) {
    nationalChampionJerseyByRiderId.set(
      riderId,
      createContinentalChampionRiderJersey({
        continentCode: title.continentCode,
        championshipType: title.championshipType,
      }),
    );
  }
  for (const [riderId, title] of activeWorldTitlesByRiderId) {
    nationalChampionJerseyByRiderId.set(
      riderId,
      createWorldChampionRiderJersey({
        championshipType: title.championshipType,
      }),
    );
  }
  const sortedRiders = currentSortKey
    ? sortRosterItems({
        items: riders,
        direction: currentSortDirection,
        getValue: (rider) =>
          getRosterSortValue(
            rider,
            currentSortKey,
            healthByRiderId.get(rider.rider_id)?.form ?? 75,
          ),
        getTieBreaker: getRiderSortName,
      })
    : riders;

  const commercialTeamName =
    teamSponsorIdentity?.teamName ??
    teamAmateurIdentity?.amateurName ??
    "Votre équipe";
  const riderJersey = teamSponsorIdentity
    ? createSponsoredRiderJersey({
        colors: teamSponsorIdentity.sponsor.colors,
        style: teamSponsorIdentity.selectedJersey.style,
        imagePath: teamSponsorIdentity.selectedJersey.imagePath,
      })
    : teamAmateurIdentity
      ? createAmateurRiderJersey(teamAmateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;

  return (
    <main className="min-h-screen text-[#082A2A]">
      {rosterTutorialProgress?.status === "in_progress" &&
      rosterTutorialProgress.current_route === ROSTER_TUTORIAL_ROUTE &&
      rosterTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={ROSTER_TUTORIAL_KEY}
          currentStepKey={rosterTutorialProgress.current_step_key}
        />
      ) : null}

      <GameHeader
        simulatorEmail={user.email}
        sponsor={teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-[1500px] px-4 py-4 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <BackToOfficeLink />

            <header
              data-tutorial-id="roster-overview"
              className="min-w-0 flex-1"
            >
              <div
                data-tutorial-id="roster-mobile-overview"
                className="flex min-w-0 items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#278B70] sm:text-xs">
                    Gestion sportive
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <h1 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                      Effectif
                    </h1>
                    <TutorialLaunchButton
                      tutorialKey={ROSTER_TUTORIAL_KEY}
                      iconOnly
                    />
                  </div>
                </div>
                <p className="hidden max-w-xl text-sm font-semibold leading-6 text-[#48665F] lg:block">
                  Comparez les qualités, la forme et les spécialités de vos
                  coureurs pour composer votre équipe.
                </p>
              </div>
            </header>
          </div>

          {teamSponsorIdentityError ? (
            <TeamSponsorIdentityWarning message={teamSponsorIdentityError} />
          ) : null}

          {rosterResult.error ? <RosterErrorMessage /> : null}

          <RosterViewTabs activeView={activeView} />

          {getFirstSearchParam(rosterQuery.succes) ? (
            <p className="mt-5 rounded-2xl border border-[#42B99A]/25 bg-[#DFF5EA] px-5 py-4 text-sm font-bold text-[#176951]">
              {getFirstSearchParam(rosterQuery.succes)}
            </p>
          ) : null}
          {getFirstSearchParam(rosterQuery.erreur) ? (
            <p className="mt-5 rounded-2xl border border-[#C94F4F]/25 bg-[#FFF0EE] px-5 py-4 text-sm font-bold text-[#8A2F2F]">
              {getFirstSearchParam(rosterQuery.erreur)}
            </p>
          ) : null}

          {activeView === "planning" ? (
            <div className="mt-6" data-tutorial-id="roster-rating-table">
              {planningOverview ? (
                <RiderSeasonPlanning
                  planning={planningOverview}
                  jersey={riderJersey}
                  jerseyByRiderId={nationalChampionJerseyByRiderId}
                />
              ) : (
                <PlanningUnavailable />
              )}
            </div>
          ) : activeView === "contrats" ? (
            <div className="mt-6">
              {contractOverview ? (
                <TeamContractManagement
                  overview={contractOverview}
                  jersey={riderJersey}
                  jerseyByRiderId={nationalChampionJerseyByRiderId}
                />
              ) : (
                <ContractManagementUnavailable />
              )}
            </div>
          ) : (
            <section
              className="mt-4 overflow-hidden rounded-2xl border border-[#315B3E]/20 bg-white/95 shadow-[0_22px_55px_rgba(19,60,46,0.12)]"
              data-tutorial-id="roster-rating-table"
              data-tutorial-route={
                sortedRiders[0]
                  ? `/jeu/coureurs/${sortedRiders[0].rider_id}`
                  : undefined
              }
            >
              {teamSponsorIdentity ? (
                <div
                  aria-hidden="true"
                  className="h-1.5 w-full"
                  style={{
                    background: `linear-gradient(90deg, ${teamSponsorIdentity.sponsor.colors.primary}, ${teamSponsorIdentity.sponsor.colors.accent}, ${teamSponsorIdentity.sponsor.colors.secondary})`,
                  }}
                />
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#315B3E]/15 bg-[#0B302B] px-4 py-3 text-[#FFFDF4] sm:px-6">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#7CCF9C]">
                    Équipe première
                  </p>

                  <h2 className="mt-1 text-base font-black sm:text-xl">
                    {commercialTeamName}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-[#BFD1C6]">
                    {formatRiderCount(riders.length)}
                  </span>
                  <span className="hidden lg:block">
                    <RatingLegend />
                  </span>
                </div>
              </div>

              {riders.length > 0 ? (
                <>
                  <div className="xl:hidden">
                    <MobileRatingCategoryGuide />
                    <MobileRosterSortMenu
                      currentSortKey={currentSortKey}
                      currentDirection={currentSortDirection}
                    />
                    <div
                      data-tutorial-id="roster-mobile-list"
                      className="space-y-3 bg-[#F3F8F5] p-2 sm:p-3"
                    >
                      {sortedRiders.map((rider) => (
                        <RiderMobileCard
                          key={rider.rider_id}
                          rider={rider}
                          jersey={
                            nationalChampionJerseyByRiderId.get(
                              rider.rider_id,
                            ) ?? riderJersey
                          }
                          health={healthByRiderId.get(rider.rider_id) ?? null}
                          equipmentBonuses={
                            equipmentRatingBonusesByRiderId.get(
                              rider.rider_id,
                            ) ?? {}
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="hidden h-[calc(100dvh-20rem)] min-h-[30rem] max-h-[52rem] overflow-auto overscroll-contain [scrollbar-gutter:stable] xl:block">
                    <table className="min-w-[1140px] w-full border-collapse">
                      <thead>
                        <tr className="border-b border-[#315B3E]/15 bg-[#F3F8F6]">
                          <SortableTableHeader
                            sortKey="rider"
                            label="Coureur"
                            fullLabel="nom du coureur"
                            align="left"
                            className="left-0 z-30 min-w-64 shadow-[8px_0_16px_-14px_rgba(8,42,42,0.45)]"
                            linkClassName="px-4"
                            currentSortKey={currentSortKey}
                            currentDirection={currentSortDirection}
                          />

                          <SortableTableHeader
                            sortKey="age"
                            label="Âge"
                            fullLabel="âge"
                            currentSortKey={currentSortKey}
                            currentDirection={currentSortDirection}
                          />

                          <SortableTableHeader
                            sortKey="profile"
                            label="Profil"
                            fullLabel="profil"
                            align="left"
                            className="min-w-28"
                            currentSortKey={currentSortKey}
                            currentDirection={currentSortDirection}
                          />

                          <SortableTableHeader
                            sortKey="potential"
                            label="Potentiel"
                            fullLabel="potentiel"
                            className="min-w-24"
                            linkClassName="px-2"
                            currentSortKey={currentSortKey}
                            currentDirection={currentSortDirection}
                          />

                          <SortableTableHeader
                            sortKey="form"
                            label="Forme"
                            fullLabel="forme actuelle"
                            className="min-w-20"
                            linkClassName="px-2"
                            currentSortKey={currentSortKey}
                            currentDirection={currentSortDirection}
                          />

                          {ratingColumns.map((column) => (
                            <SortableTableHeader
                              key={column.key}
                              sortKey={column.key}
                              label={column.label}
                              fullLabel={column.fullLabel}
                              importance={column.importance}
                              linkClassName="px-1"
                              currentSortKey={currentSortKey}
                              currentDirection={currentSortDirection}
                            />
                          ))}

                          <SortableTableHeader
                            sortKey="average"
                            label="Moy."
                            fullLabel="moyenne"
                            className="min-w-20"
                            linkClassName="px-2"
                            currentSortKey={currentSortKey}
                            currentDirection={currentSortDirection}
                          />

                        </tr>
                      </thead>

                      <tbody>
                        {sortedRiders.map((rider) => (
                          <RiderTableRow
                            key={rider.rider_id}
                            rider={rider}
                            jersey={
                              nationalChampionJerseyByRiderId.get(
                                rider.rider_id,
                              ) ?? riderJersey
                            }
                            health={healthByRiderId.get(rider.rider_id) ?? null}
                            equipmentBonuses={
                              equipmentRatingBonusesByRiderId.get(
                                rider.rider_id,
                              ) ?? {}
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyRoster />
              )}
            </section>
          )}

        </div>
      </section>
    </main>
  );
}

function RosterViewTabs({
  activeView,
}: {
  activeView: "statistiques" | "planning" | "contrats";
}) {
  return (
    <nav
      aria-label="Vues de l’effectif"
      data-tutorial-id="roster-view-tabs"
      className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-[#315B3E]/15 bg-white p-1 shadow-sm sm:gap-2"
    >
      <Link
        href="/jeu/effectif?vue=statistiques"
        prefetchOnIntent
        title="Notes, profils, forme et potentiel"
        aria-current={activeView === "statistiques" ? "page" : undefined}
        className={`min-w-0 rounded-lg px-2 py-2.5 text-center transition sm:px-4 ${
          activeView === "statistiques"
            ? "bg-[#0B302B] text-white shadow-md"
            : "text-[#315B3E] hover:bg-[#F3F8F6]"
        }`}
      >
        <strong
          className={`block text-sm font-black ${
            activeView === "statistiques" ? "text-white" : "text-[#183F37]"
          }`}
        >
          Effectif
        </strong>
        <span
          className={`sr-only ${
            activeView === "statistiques" ? "text-[#BFD1C6]" : "text-[#60756E]"
          }`}
        >
          Notes, profils, forme et potentiel
        </span>
      </Link>
      <Link
        href="/jeu/effectif?vue=planning"
        prefetchOnIntent
        title="Courses, stages, reconnaissances et blessures"
        aria-current={activeView === "planning" ? "page" : undefined}
        className={`min-w-0 rounded-lg px-2 py-2.5 text-center transition sm:px-4 ${
          activeView === "planning"
            ? "bg-[#0B302B] text-white shadow-md"
            : "text-[#315B3E] hover:bg-[#F3F8F6]"
        }`}
      >
        <strong
          className={`block text-sm font-black ${
            activeView === "planning" ? "text-white" : "text-[#183F37]"
          }`}
        >
          <span className="sm:hidden">Planning</span>
          <span className="hidden sm:inline">Planning de saison</span>
        </strong>
        <span
          className={`sr-only ${
            activeView === "planning" ? "text-[#BFD1C6]" : "text-[#60756E]"
          }`}
        >
          Courses, stages, reconnaissances et blessures
        </span>
      </Link>
      <Link
        href="/jeu/effectif?vue=contrats"
        prefetchOnIntent
        title="Échéances et prolongation groupée"
        aria-current={activeView === "contrats" ? "page" : undefined}
        className={`min-w-0 rounded-lg px-2 py-2.5 text-center transition sm:px-4 ${
          activeView === "contrats"
            ? "bg-[#0B302B] text-white shadow-md"
            : "text-[#315B3E] hover:bg-[#F3F8F6]"
        }`}
      >
        <strong
          className={`block text-sm font-black ${
            activeView === "contrats" ? "text-white" : "text-[#183F37]"
          }`}
        >
          Contrats
        </strong>
        <span
          className={`sr-only ${
            activeView === "contrats" ? "text-[#BFD1C6]" : "text-[#60756E]"
          }`}
        >
          Échéances et prolongation groupée
        </span>
      </Link>
    </nav>
  );
}

function PlanningUnavailable() {
  return (
    <section className="rounded-[2rem] border border-[#C94F4F]/20 bg-[#FFF0EE] p-7">
      <p className="text-lg font-black text-[#8A2F2F]">
        Le planning est momentanément indisponible
      </p>
      <p className="mt-2 text-sm font-semibold text-[#7A5555]">
        Les données de l’effectif restent accessibles dans la vue Effectif.
      </p>
    </section>
  );
}

function ContractManagementUnavailable() {
  return (
    <section className="rounded-[2rem] border border-[#C94F4F]/20 bg-[#FFF0EE] p-7">
      <p className="text-lg font-black text-[#8A2F2F]">
        La gestion contractuelle est momentanément indisponible
      </p>
      <p className="mt-2 text-sm font-semibold text-[#7A5555]">
        Réessayez dans quelques instants. Aucun contrat n’a été modifié.
      </p>
    </section>
  );
}

function MobileRatingCategoryGuide() {
  const categories = [
    {
      tutorialId: "roster-primary-ratings",
      label: "Notes principales",
      ratings: ["MO", "VAL", "PLA", "PAV", "SPR", "CLM"],
      className: "border-[#278B70]/20 bg-[#EAF5F3] text-[#176951]",
    },
    {
      tutorialId: "roster-secondary-ratings",
      label: "Notes secondaires",
      ratings: ["ACC", "DES", "END", "RES", "REC", "BAR", "PRO"],
      className: "border-[#315B3E]/15 bg-white text-[#60756E]",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 border-b border-[#315B3E]/10 bg-[#F3F8F5] p-2 sm:p-3">
      {categories.map((category) => (
        <section
          key={category.tutorialId}
          data-tutorial-id={category.tutorialId}
          className={`min-w-0 rounded-xl border p-2.5 ${category.className}`}
        >
          <p className="truncate text-[9px] font-black uppercase tracking-[0.08em]">
            {category.label}
          </p>
          <p className="mt-1.5 text-[10px] font-extrabold leading-4">
            {category.ratings.join(" · ")}
          </p>
        </section>
      ))}
    </div>
  );
}

function SortableTableHeader({
  sortKey,
  label,
  fullLabel,
  currentSortKey,
  currentDirection,
  align = "center",
  className,
  linkClassName,
  importance,
}: {
  sortKey: RosterSortKey;
  label: string;
  fullLabel: string;
  currentSortKey: RosterSortKey | null;
  currentDirection: RosterSortDirection;
  align?: "left" | "center" | "right";
  className?: string;
  linkClassName?: string;
  importance?: RiderRatingImportance;
}) {
  const isActive = currentSortKey === sortKey;
  const nextDirection = getNextRosterSortDirection({
    sortKey,
    currentSortKey,
    currentDirection,
  });
  const nextDirectionLabel =
    nextDirection === "asc" ? "croissant" : "décroissant";
  const alignmentClass =
    align === "left"
      ? "justify-start text-left"
      : align === "right"
        ? "justify-end text-right"
        : "justify-center text-center";

  return (
    <th
      scope="col"
      aria-sort={
        isActive
          ? currentDirection === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      className={[
        "sticky top-0 z-20 p-0 text-xs font-extrabold uppercase tracking-wider",
        isActive
          ? "bg-[#E1F0EA] text-[#176951]"
          : importance === "primary"
            ? "bg-[#EAF4EF] text-[#234E45]"
            : importance === "secondary"
              ? "bg-[#F7F9F8] text-[#82928F]"
              : "bg-[#F3F8F6] text-[#48665F]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Link
        href={{
          pathname: "/jeu/effectif",
          query: {
            sort: sortKey,
            direction: nextDirection,
          },
        }}
        prefetchOnIntent
        scroll={false}
        title={`Trier par ${fullLabel} (${nextDirectionLabel})`}
        aria-label={`Trier par ${fullLabel}, ordre ${nextDirectionLabel}`}
        className={[
          "flex w-full items-center gap-1.5 px-3 py-4 transition hover:bg-[#DCEBE5] hover:text-[#0F5944] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#278B70]",
          alignmentClass,
          linkClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span>{label}</span>
        <span
          aria-hidden="true"
          className={[
            "text-[0.7rem] leading-none",
            isActive ? "text-[#176951]" : "text-[#91A69F]",
          ].join(" ")}
        >
          {isActive ? (currentDirection === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </Link>
    </th>
  );
}

function MobileRosterSortMenu({
  currentSortKey,
  currentDirection,
}: {
  currentSortKey: RosterSortKey | null;
  currentDirection: RosterSortDirection;
}) {
  const sortOptions: Array<{
    key: RosterSortKey;
    label: string;
    fullLabel: string;
  }> = [
    { key: "rider", label: "Nom", fullLabel: "nom du coureur" },
    { key: "age", label: "\u00c2ge", fullLabel: "\u00e2ge" },
    { key: "profile", label: "Profil", fullLabel: "profil" },
    { key: "potential", label: "Potentiel", fullLabel: "potentiel" },
    { key: "form", label: "Forme", fullLabel: "forme actuelle" },
    ...ratingColumns.map((column) => ({
      key: column.key,
      label: column.label,
      fullLabel: column.fullLabel,
    })),
    { key: "average", label: "Moyenne", fullLabel: "moyenne" },
  ];
  const activeOption = sortOptions.find(
    (option) => option.key === currentSortKey,
  );

  return (
    <details className="border-b border-[#315B3E]/12 bg-[#F3F8F6] px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-black text-[#183F37] marker:hidden">
        <span>Trier l&apos;effectif</span>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] text-[#176951] shadow-sm">
          {activeOption?.label ?? "Par d\u00e9faut"}
          {activeOption
            ? currentDirection === "asc"
              ? "  \u2191"
              : "  \u2193"
            : ""}
        </span>
      </summary>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sortOptions.map((option) => {
          const isActive = option.key === currentSortKey;
          const nextDirection = getNextRosterSortDirection({
            sortKey: option.key,
            currentSortKey,
            currentDirection,
          });

          return (
            <Link
              key={option.key}
              href={{
                pathname: "/jeu/effectif",
                query: {
                  vue: "statistiques",
                  sort: option.key,
                  direction: nextDirection,
                },
              }}
              prefetchOnIntent
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              aria-label={`Trier par ${option.fullLabel}`}
              className={[
                "flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-extrabold transition",
                isActive
                  ? "border-[#278B70] bg-[#D7EEE8] text-[#0F5944]"
                  : "border-[#315B3E]/12 bg-white text-[#48665F] hover:border-[#278B70]/40 hover:bg-[#EAF5F3]",
              ].join(" ")}
            >
              <span>{option.label}</span>
              <span aria-hidden="true">
                {isActive
                  ? currentDirection === "asc"
                    ? "\u2191"
                    : "\u2193"
                  : "\u2195"}
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}

function RiderMobileCard({
  rider,
  jersey,
  health,
  equipmentBonuses,
}: {
  rider: RiderRow;
  jersey: RiderJerseyAppearance;
  health: RiderRosterHealth | null;
  equipmentBonuses: Partial<Record<RiderRatingKey, number>>;
}) {
  const riderName = `${rider.first_name} ${rider.last_name}`.trim();
  const riderProfile = getRiderSportingProfile(toRiderRatings(rider));
  const riderAverage = getRiderAverage(rider);

  return (
    <article className="rounded-2xl border border-[#315B3E]/15 bg-white p-4 shadow-[0_8px_20px_rgba(19,60,46,0.08)] sm:p-5">
      <div className="flex items-start gap-3">
        <Link
          href={`/jeu/coureurs/${rider.rider_id}`}
          prefetchOnIntent
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
          aria-label={`Ouvrir la fiche de ${riderName} dans un nouvel onglet`}
        >
          <span className="relative shrink-0">
            <RiderAvatar
              profileKey={rider.avatar_profile_key}
              seed={rider.avatar_seed}
              riderId={rider.rider_id}
              age={rider.age}
              jersey={jersey}
              label={`Portrait de ${riderName}`}
            />
            {health?.injury ? (
              <span
                title={`${health.injury.label} - retour le ${formatMedicalDate(
                  health.injury.expectedRecoveryAt,
                )}`}
                className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-[#D94F4F] text-white shadow-md"
              >
                <MedicalCrossIcon />
              </span>
            ) : null}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-black text-[#082A2A]">
              {riderName}
            </span>
            <span className="mt-1 flex items-center gap-2">
              <CountryFlag
                isoAlpha2={rider.country_iso_alpha2}
                countryName={rider.country_name}
              />
              <span className="truncate text-xs font-semibold text-[#60756E]">
                {rider.country_name}
              </span>
              <span
                className="text-xs font-black text-[#278B70]"
                aria-hidden="true"
              >
                {"\u2197"}
              </span>
            </span>
            <span className="mt-2 inline-flex max-w-full rounded-full bg-[#D7EEE8] px-2.5 py-1 text-[11px] font-extrabold leading-4 text-[#176951]">
              {riderProfile}
            </span>
          </span>
        </Link>

        <span className="shrink-0 rounded-xl bg-[#EAF5F3] px-2.5 py-2 text-center">
          <span className="block text-[9px] font-extrabold uppercase tracking-wide text-[#60756E]">
            Moy.
          </span>
          <span className="mt-0.5 block text-lg font-black text-[#183F37]">
            {riderAverage}
          </span>
        </span>
      </div>

      {health?.injury ? (
        <p className="mt-3 rounded-lg bg-[#FFF0F0] px-3 py-2 text-[10px] font-black text-[#B54242]">
          {health.injury.label} {"\u00b7"} reprise{" "}
          {formatMedicalDate(health.injury.expectedRecoveryAt)}
        </p>
      ) : health?.formCamp ? (
        <p className="mt-3 rounded-lg bg-[#FFF8DD] px-3 py-2 text-[10px] font-black text-[#8A6B16]">
          {health.formCamp.label} {"\u00b7"} J{health.formCamp.startDay}
          {"\u2013"}J{health.formCamp.endDay}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MobileRiderMetric label={"\u00c2ge"} value={`${rider.age} ans`} />
        <MobileRiderMetric
          label="Potentiel"
          value={
            <PotentialStars
              potentialSteps={rider.potential_steps}
              compact
              showLabel={false}
            />
          }
        />
        <MobileRiderMetric
          label="Forme"
          value={<RiderFormBadge value={health?.form ?? 75} />}
        />
      </div>

      <CollapsibleMobileRiderRatings
        riderName={riderName}
        ratings={ratingColumns.map((column) => ({
          key: column.key,
          label: column.label,
          fullLabel: column.fullLabel,
          importance: column.importance,
          value: rider[column.key],
          bonus: equipmentBonuses[toRiderRatingKey(column.key)],
        }))}
      />

    </article>
  );
}

function MobileRiderMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#315B3E]/10 bg-[#F7FAF9] px-2 py-2.5 text-center">
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-[#60756E]">
        {label}
      </p>
      <div className="mt-1.5 flex min-h-8 items-center justify-center text-sm font-black text-[#183F37]">
        {value}
      </div>
    </div>
  );
}

function RiderTableRow({
  rider,
  jersey,
  health,
  equipmentBonuses,
}: {
  rider: RiderRow;
  jersey: RiderJerseyAppearance;
  health: RiderRosterHealth | null;
  equipmentBonuses: Partial<Record<RiderRatingKey, number>>;
}) {
  const riderName = `${rider.first_name} ${rider.last_name}`.trim();

  const riderProfile = getRiderSportingProfile(toRiderRatings(rider));

  const riderAverage = getRiderAverage(rider);

  return (
    <tr className="border-b border-[#315B3E]/10 transition last:border-b-0 hover:bg-[#F6FAF8]">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-white px-4 py-3 text-left shadow-[8px_0_16px_-14px_rgba(8,42,42,0.45)]"
      >
        <Link
          href={`/jeu/coureurs/${rider.rider_id}`}
          prefetchOnIntent
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
          aria-label={`Ouvrir la fiche de ${riderName} dans un nouvel onglet`}
        >
          <span className="relative shrink-0">
            <RiderAvatar
              profileKey={rider.avatar_profile_key}
              seed={rider.avatar_seed}
              riderId={rider.rider_id}
              age={rider.age}
              jersey={jersey}
              label={`Portrait généré de ${riderName}`}
            />
            {health?.injury ? (
              <span
                title={`${health.injury.label} · retour le ${formatMedicalDate(
                  health.injury.expectedRecoveryAt,
                )}`}
                className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-[#D94F4F] text-white shadow-md"
              >
                <MedicalCrossIcon />
              </span>
            ) : null}
          </span>

          <div className="min-w-0">
            <p className="truncate text-base font-black text-[#082A2A]">
              {riderName}
            </p>

            <div className="mt-1 flex items-center gap-2">
              <CountryFlag
                isoAlpha2={rider.country_iso_alpha2}
                countryName={rider.country_name}
              />

              <span className="truncate text-xs font-semibold text-[#60756E]">
                {rider.country_name}
              </span>
              <span
                className="text-xs font-black text-[#278B70]"
                aria-hidden="true"
              >
                ↗
              </span>
            </div>
            {health?.injury ? (
              <p className="mt-1 truncate text-[10px] font-black text-[#B54242]">
                {health.injury.label} · reprise{" "}
                {formatMedicalDate(health.injury.expectedRecoveryAt)}
              </p>
            ) : health?.formCamp ? (
              <p className="mt-1 truncate text-[10px] font-black text-[#8A6B16]">
                {health.formCamp.label} · J{health.formCamp.startDay}–J
                {health.formCamp.endDay}
              </p>
            ) : null}
          </div>
        </Link>
      </th>

      <td className="px-2 py-3 text-center font-black text-[#082A2A]">
        {rider.age}
      </td>

      <td className="px-2 py-3">
        <span className="inline-flex max-w-28 rounded-full bg-[#D7EEE8] px-2.5 py-1.5 text-xs font-extrabold leading-4 text-[#176951]">
          {riderProfile}
        </span>
      </td>

      <td className="px-2 py-3 text-center">
        <PotentialStars
          potentialSteps={rider.potential_steps}
          compact
          showLabel={false}
        />
      </td>

      <td className="px-2 py-3 text-center">
        <RiderFormBadge value={health?.form ?? 75} />
      </td>

      {ratingColumns.map((column) => {
        const value = rider[column.key];

        return (
          <td
            key={column.key}
            data-rating-importance={column.importance}
            className={
              column.importance === "primary"
                ? "px-1 py-3 text-center"
                : "bg-[#FAFBFA] px-1 py-3 text-center"
            }
          >
            <RatingBadge
              value={value}
              label={column.fullLabel}
              importance={column.importance}
              bonus={equipmentBonuses[toRiderRatingKey(column.key)]}
            />
          </td>
        );
      })}

      <td className="px-2 py-3 text-center">
        <span className="font-black text-[#082A2A]">{riderAverage}</span>
      </td>

    </tr>
  );
}

function RiderFormBadge({ value }: { value: number }) {
  const normalizedValue = Math.min(Math.max(Math.round(value), 0), 100);
  const colorClass =
    normalizedValue >= 80
      ? "bg-[#176951]"
      : normalizedValue >= 60
        ? "bg-[#2FA982]"
        : normalizedValue >= 40
          ? "bg-[#D39B2F]"
          : "bg-[#D94F4F]";

  return (
    <div
      title={`Forme actuelle : ${normalizedValue} %`}
      className="mx-auto w-14"
    >
      <span
        aria-hidden="true"
        className="block text-sm font-black tabular-nums text-[#183F37]"
      >
        {normalizedValue}
        <span className="ml-0.5 text-[9px] text-[#60756E]">%</span>
      </span>
      <span
        role="progressbar"
        aria-label={`Forme actuelle : ${normalizedValue} %`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalizedValue}
        className="mx-auto mt-1 block h-1.5 w-12 overflow-hidden rounded-full bg-[#D7EEE8]"
      >
        <span
          className={`block h-full rounded-full ${colorClass}`}
          style={{ width: `${normalizedValue}%` }}
        />
      </span>
    </div>
  );
}

function RatingBadge({
  value,
  label,
  importance,
  bonus,
}: {
  value: number;
  label: string;
  importance: RiderRatingImportance;
  bonus?: number;
}) {
  return (
    <span
      title={`${label} : ${value}${Number(bonus ?? 0) > 0 ? ` +${bonus} équipement` : ""}`}
      data-rating-importance={importance}
      className={[
        "inline-flex h-8 min-w-9 items-center justify-center rounded-md border px-1.5 text-xs font-black",
        getRiderRatingColorClasses(value, importance),
      ].join(" ")}
    >
      {value}
      <EquipmentRatingBonus bonus={bonus} className="text-[9px]" />
    </span>
  );
}

function MedicalCrossIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-3 w-3"
      fill="currentColor"
    >
      <path d="M7.5 2.5h5v5h5v5h-5v5h-5v-5h-5v-5h5v-5Z" />
    </svg>
  );
}

function formatMedicalDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function RatingLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
      <span className="text-[#BFD1C6]">Échelle :</span>

      <span className="rounded-md bg-white px-2 py-1 text-[#48665F]">
        &lt; 50
      </span>

      <span className="rounded-md bg-[#DDF3E3] px-2 py-1 text-[#2C6A3F]">
        50+
      </span>

      <span className="rounded-md bg-[#A9DFB7] px-2 py-1 text-[#174E2A]">
        60+
      </span>

      <span className="rounded-md bg-[#3F8F5A] px-2 py-1 text-white">70+</span>

      <span className="rounded-md bg-[#F4B04D] px-2 py-1 text-[#5B3100]">
        80+
      </span>

      <span className="rounded-md bg-[#D84B4B] px-2 py-1 text-white">90+</span>
    </div>
  );
}

function CountryFlag({
  isoAlpha2,
  countryName,
}: {
  isoAlpha2: string;
  countryName: string;
}) {
  const normalizedCode = isoAlpha2.trim().toLowerCase();

  if (!/^[a-z]{2}$/.test(normalizedCode)) {
    return (
      <span role="img" aria-label={`Drapeau : ${countryName}`}>
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
        "shrink-0 overflow-hidden rounded-sm text-lg shadow-sm",
      ].join(" ")}
    />
  );
}

function EmptyRoster() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D7EEE8] text-[#176951]">
        <RosterIcon />
      </div>

      <h2 className="mt-5 text-xl font-black">Aucun coureur récupéré</h2>

      <p className="mx-auto mt-3 max-w-xl leading-7 text-[#60756E]">
        L’équipe existe, mais aucun contrat actif n’a été trouvé pour la saison
        actuelle.
      </p>
    </div>
  );
}

function RosterErrorMessage() {
  return (
    <div className="mt-8 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
      L’effectif n’a pas pu être récupéré. Consultez les journaux techniques
      pour connaître le détail de l’erreur.
    </div>
  );
}

function TeamSponsorIdentityWarning({ message }: { message: string }) {
  return (
    <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
      L’effectif reste disponible, mais l’identité commerciale de l’équipe n’a
      pas pu être chargée.
      <span className="mt-1 block text-xs font-medium">{message}</span>
    </div>
  );
}

function RosterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-8 w-8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="3" />

      <circle cx="17" cy="9" r="2.5" />

      <path d="M2.5 20c.5-4.5 2.5-7 5.5-7s5 2.5 5.5 7" />

      <path d="M14 14c3.5-.3 5.5 1.7 6 5" />
    </svg>
  );
}

function toRiderRatingKey(key: RatingKey): RiderRatingKey {
  return key === "time_trial" ? "timeTrial" : key;
}

function toRiderRatings(rider: RiderRow): RiderRatings {
  return {
    mountain: rider.mountain,
    hills: rider.hills,
    flat: rider.flat,
    timeTrial: rider.time_trial,
    cobbles: rider.cobbles,
    sprint: rider.sprint,
    acceleration: rider.acceleration,
    downhill: rider.downhill,
    endurance: rider.endurance,
    resistance: rider.resistance,
    recovery: rider.recovery,
    breakaway: rider.breakaway,
    prologue: rider.prologue,
  };
}

function getFirstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isRatingKey(sortKey: RosterSortKey): sortKey is RatingKey {
  return ratingColumns.some((column) => column.key === sortKey);
}

function getRiderSortName(rider: RiderRow): string {
  return `${rider.last_name} ${rider.first_name} ${rider.rider_id}`;
}

function getRosterSortValue(
  rider: RiderRow,
  sortKey: RosterSortKey,
  form: number,
): RosterSortValue {
  if (isRatingKey(sortKey)) {
    return rider[sortKey];
  }

  switch (sortKey) {
    case "rider":
      return getRiderSortName(rider);
    case "age":
      return rider.age;
    case "profile":
      return getRiderSportingProfile(toRiderRatings(rider));
    case "potential":
      return rider.potential_steps;
    case "form":
      return form;
    case "average":
      return getRiderAverage(rider);
  }
}

function getRiderAverage(rider: RiderRow): number {
  const total = ratingColumns.reduce(
    (sum, column) => sum + rider[column.key],
    0,
  );

  return Math.round(total / ratingColumns.length);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur inattendue est survenue.";
}

function formatRiderCount(value: number): string {
  return `${value} coureur${value === 1 ? "" : "s"}`;
}
