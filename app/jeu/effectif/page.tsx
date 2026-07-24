import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "../../../components/game/game-header";
import { AmateurTeamJersey } from "../../../components/game/amateur-team-jersey";
import { SponsorJerseyPreview } from "../../../components/game/sponsor-jersey-preview";
import { SponsorLogo } from "../../../components/game/sponsor-logo";
import { RiderAvatar } from "../../../components/game/rider-avatar";
import { RiderSeasonPlanning } from "../../../components/game/rider-season-planning";
import { PotentialStars } from "../../../components/game/potential-stars";
import { TeamDivisionBadge } from "../../../components/game/team-division-badge";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  type RiderJerseyAppearance,
} from "../../../lib/rider-jersey";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getAuthenticatedUser } from "../../../lib/supabase/authenticated-user";
import {
  getTeamAmateurIdentityForAuthUser,
  type TeamAmateurIdentity,
} from "../../../services/team-amateur-identity";
import {
  getActiveTeamSponsorIdentityForAuthUser,
  type TeamSponsorIdentity,
} from "../../../services/team-sponsor-identity";
import { getCurrentTeamDivisionForAuthUser } from "../../../services/team-divisions";
import {
  getRiderSportingProfile,
  type RiderRatings,
} from "../../../lib/game/rider-profile";
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

export const metadata: Metadata = {
  title: "Effectif",
  description:
    "Consultez les coureurs de votre équipe dans Cyclostratège.",
};

type CurrentTeamDashboardSummary = {
  team_id: string;
  team_name: string;
  rider_count: number;
  season_id: string;
  season_name: string;
  season_day_number: number;
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
  salary_per_season: number | string;
  contract_currency: string;
  contract_end_season_id: string;
  contract_end_season_name: string;
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
}> = [
  {
    key: "mountain",
    label: "MON",
    fullLabel: "Montagne",
  },
  {
    key: "hills",
    label: "VAL",
    fullLabel: "Vallon",
  },
  {
    key: "flat",
    label: "PLA",
    fullLabel: "Plaine",
  },
  {
    key: "time_trial",
    label: "CLM",
    fullLabel: "Contre-la-montre",
  },
  {
    key: "cobbles",
    label: "PAV",
    fullLabel: "Pavés",
  },
  {
    key: "sprint",
    label: "SPR",
    fullLabel: "Sprint",
  },
  {
    key: "acceleration",
    label: "ACC",
    fullLabel: "Accélération",
  },
  {
    key: "downhill",
    label: "DES",
    fullLabel: "Descente",
  },
  {
    key: "endurance",
    label: "END",
    fullLabel: "Endurance",
  },
  {
    key: "resistance",
    label: "RES",
    fullLabel: "Résistance",
  },
  {
    key: "recovery",
    label: "REC",
    fullLabel: "Récupération",
  },
  {
    key: "breakaway",
    label: "BAR",
    fullLabel: "Baroudeur",
  },
  {
    key: "prologue",
    label: "PRO",
    fullLabel: "Prologue",
  },
];

export default async function TeamRosterPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string | string[];
    direction?: string | string[];
    vue?: string | string[];
  }>;
}) {
  const rosterQuery = await searchParams;
  const activeView =
    getFirstSearchParam(rosterQuery.vue) === "planning"
      ? "planning"
      : "statistiques";
  const currentSortKey = parseRosterSortKey(
    getFirstSearchParam(rosterQuery.sort)
  );
  const currentSortDirection = currentSortKey
    ? parseRosterSortDirection(
        getFirstSearchParam(rosterQuery.direction),
        currentSortKey
      )
    : "asc";

  const supabase =
    await createSupabaseServerClient();

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
        "Impossible de récupérer l’identité commerciale de l’équipe :",
        error
      );

      return {
        identity: null,
        error: getErrorMessage(error),
      };
    });

  const [
    teamSummaryResult,
    rosterResult,
    planningOverview,
    sponsorIdentityResult,
    teamAmateurIdentity,
    teamDivision,
    healthOverview,
  ] = await Promise.all([
    supabase
      .rpc("get_current_team_dashboard_summary")
      .maybeSingle<CurrentTeamDashboardSummary>(),
    supabase.rpc("get_current_team_roster_with_potential"),
    activeView === "planning"
      ? getCurrentTeamRiderSeasonPlanning({
          authUserId: user.id,
        }).catch((error: unknown) => {
          console.error(
            "Impossible de récupérer le planning de l’effectif :",
            error
          );
          return null;
        })
      : Promise.resolve(null),
    sponsorIdentityPromise,
    getTeamAmateurIdentityForAuthUser(user.id).catch((error: unknown) => {
      console.error(
        "Impossible de récupérer l’identité amateur de l’équipe :",
        error
      );
      return null;
    }),
    getCurrentTeamDivisionForAuthUser(user.id).catch((error: unknown) => {
      console.error(
        "Impossible de récupérer la division de l’équipe :",
        error
      );
      return null;
    }),
    getCurrentTeamHealthOverview(user.id).catch((error: unknown) => {
      console.error(
        "Impossible de récupérer les indisponibilités médicales :",
        error
      );
      return null;
    }),
  ]);

  const teamSponsorIdentity = sponsorIdentityResult.identity;
  const teamSponsorIdentityError = sponsorIdentityResult.error;
  const healthByRiderId = new Map(
    (healthOverview?.riders ?? []).map((rider) => [
      rider.id,
      { injury: rider.injury, formCamp: rider.formCamp },
    ])
  );

  if (teamSummaryResult.error) {
    console.error(
      "Impossible de récupérer le résumé de l’équipe :",
      {
        code: teamSummaryResult.error.code,
        message:
          teamSummaryResult.error.message,
        details:
          teamSummaryResult.error.details,
        hint: teamSummaryResult.error.hint,
      }
    );
  }

  if (rosterResult.error) {
    console.error(
      "Impossible de récupérer l’effectif :",
      {
        code: rosterResult.error.code,
        message: rosterResult.error.message,
        details: rosterResult.error.details,
        hint: rosterResult.error.hint,
      }
    );
  }

  const teamSummary =
    (teamSummaryResult.data ??
      null) as CurrentTeamDashboardSummary | null;

  const riders = (rosterResult.data ?? []) as RiderRow[];
  const sortedRiders = currentSortKey
    ? sortRosterItems({
        items: riders,
        direction: currentSortDirection,
        getValue: (rider) =>
          getRosterSortValue(
            rider,
            currentSortKey
          ),
        getTieBreaker: getRiderSortName,
      })
    : riders;

  const commercialTeamName =
    teamSponsorIdentity?.teamName ??
    teamAmateurIdentity?.amateurName ??
    teamSummary?.team_name ??
    "Votre équipe";

  const riderJersey = teamSponsorIdentity
    ? createSponsoredRiderJersey({
        colors: teamSponsorIdentity.sponsor.colors,
        style: teamSponsorIdentity.selectedJersey.style,
      })
    : teamAmateurIdentity
      ? createAmateurRiderJersey(teamAmateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;

  const minimumAge =
    riders.length > 0
      ? Math.min(
          ...riders.map(
            (rider) => rider.age
          )
        )
      : 0;

  const maximumAge =
    riders.length > 0
      ? Math.max(
          ...riders.map(
            (rider) => rider.age
          )
        )
      : 0;

  const teamAverage =
    riders.length > 0
      ? Math.round(
          riders.reduce(
            (total, rider) =>
              total +
              getRiderAverage(rider),
            0
          ) / riders.length
        )
      : 0;

  return (
    <main className="min-h-screen text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        sponsor={teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-[1500px] px-5 py-10 sm:px-8 sm:py-14">
          <BackToOfficeLink />

          <header
            data-tutorial-id="roster-overview"
            className="mt-7 flex flex-wrap items-end justify-between gap-6"
          >
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
                Gestion sportive
              </p>

              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Effectif
              </h1>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-[#48665F]">
                Consultez les qualités, les
                contrats et les spécialités de vos
                coureurs pour la saison actuelle.
              </p>
            </div>

            {teamSummary ? (
              <TeamSeasonSummary
                teamName={commercialTeamName}
                seasonName={
                  teamSummary.season_name
                }
                seasonDayNumber={
                  teamSummary.season_day_number
                }
                sponsorIdentity={
                  teamSponsorIdentity
                }
                divisionCode={teamDivision?.code ?? null}
              />
            ) : null}
          </header>

          {teamSponsorIdentityError ? (
            <TeamSponsorIdentityWarning
              message={
                teamSponsorIdentityError
              }
            />
          ) : null}

          {teamSponsorIdentity ? (
            <TeamCommercialIdentityBanner
              identity={
                teamSponsorIdentity
              }
            />
          ) : teamAmateurIdentity?.isConfigured ? (
            <TeamAmateurIdentityBanner identity={teamAmateurIdentity} />
          ) : null}

          {rosterResult.error ? (
            <RosterErrorMessage />
          ) : null}

          <RosterViewTabs activeView={activeView} />

          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Coureurs"
              value={String(riders.length)}
              detail="Sous contrat actif"
            />

            <SummaryCard
              label="Âges"
              value={
                riders.length > 0
                  ? `${minimumAge} – ${maximumAge} ans`
                  : "Non disponible"
              }
              detail="Effectif initial équilibré"
            />

            <SummaryCard
              label="Niveau moyen"
              value={
                riders.length > 0
                  ? String(teamAverage)
                  : "—"
              }
              detail="Moyenne des 13 caractéristiques"
            />

            <SummaryCard
              label="Nationalité"
              value={
                teamAmateurIdentity ? (
                  <Link
                    href={`/jeu/nations/${teamAmateurIdentity.homeCountryCode.toLowerCase()}`}
                    className="inline-flex items-center gap-3 transition hover:text-[#176951] hover:underline"
                  >
                    <span
                      className={`fi fi-${teamAmateurIdentity.homeCountryCode.toLowerCase()} shrink-0 rounded-sm shadow-sm`}
                      role="img"
                      aria-label={`Drapeau ${teamAmateurIdentity.homeCountryName}`}
                    />
                    <span>{teamAmateurIdentity.homeCountryName}</span>
                  </Link>
                ) : (
                  "Non disponible"
                )
              }
              detail="Pays d’affiliation"
            />
          </section>

          {activeView === "planning" ? (
            <div className="mt-6">
              {planningOverview ? (
                <RiderSeasonPlanning
                  planning={planningOverview}
                  jersey={riderJersey}
                />
              ) : (
                <PlanningUnavailable />
              )}
            </div>
          ) : (
            <section
              data-tutorial-id="roster-rating-table"
              className="mt-6 overflow-hidden rounded-2xl border border-[#315B3E]/20 bg-white/95 shadow-[0_22px_55px_rgba(19,60,46,0.12)]"
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

            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#315B3E]/15 bg-[#0B302B] px-5 py-5 text-[#FFFDF4] sm:px-7">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7CCF9C]">
                  Équipe première
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {commercialTeamName}
                </h2>

                <p className="mt-1 text-sm font-semibold text-[#BFD1C6]">
                  {formatRiderCount(
                    riders.length
                  )}
                </p>
              </div>

              <RatingLegend />
            </div>

            {riders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[1450px] w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#315B3E]/15 bg-[#F3F8F6]">
                      <SortableTableHeader
                        sortKey="rider"
                        label="Coureur"
                        fullLabel="nom du coureur"
                        align="left"
                        className="sticky left-0 z-10 min-w-80"
                        linkClassName="px-5"
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
                        className="min-w-40"
                        currentSortKey={currentSortKey}
                        currentDirection={currentSortDirection}
                      />

                      <SortableTableHeader
                        sortKey="potential"
                        label="Potentiel"
                        fullLabel="potentiel"
                        className="min-w-36"
                        currentSortKey={currentSortKey}
                        currentDirection={currentSortDirection}
                      />

                      {ratingColumns.map(
                        (column) => (
                          <SortableTableHeader
                            key={column.key}
                            sortKey={column.key}
                            label={column.label}
                            fullLabel={column.fullLabel}
                            linkClassName="px-2"
                            currentSortKey={currentSortKey}
                            currentDirection={currentSortDirection}
                          />
                        )
                      )}

                      <SortableTableHeader
                        sortKey="average"
                        label="Moy."
                        fullLabel="moyenne"
                        className="min-w-28"
                        currentSortKey={currentSortKey}
                        currentDirection={currentSortDirection}
                      />

                      <SortableTableHeader
                        sortKey="salary"
                        label="Salaire"
                        fullLabel="salaire"
                        align="right"
                        className="min-w-36"
                        linkClassName="px-4"
                        currentSortKey={currentSortKey}
                        currentDirection={currentSortDirection}
                      />

                      <SortableTableHeader
                        sortKey="contract"
                        label="Contrat"
                        fullLabel="échéance du contrat"
                        align="left"
                        className="min-w-36"
                        linkClassName="px-5"
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
                        jersey={riderJersey}
                        health={healthByRiderId.get(rider.rider_id) ?? null}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyRoster />
            )}
            </section>
          )}

          {activeView === "statistiques" ? (
            <p className="mt-5 text-sm leading-6 text-[#60756E]">
              Cliquez sur un coureur pour ouvrir sa fiche détaillée dans un nouvel onglet.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function RosterViewTabs({
  activeView,
}: {
  activeView: "statistiques" | "planning";
}) {
  return (
    <nav
      aria-label="Vues de l’effectif"
      className="mt-8 grid gap-2 rounded-2xl border border-[#315B3E]/15 bg-white p-2 shadow-sm sm:grid-cols-2"
    >
      <Link
        href="/jeu/effectif?vue=statistiques"
        aria-current={activeView === "statistiques" ? "page" : undefined}
        className={`rounded-xl px-5 py-4 transition ${
          activeView === "statistiques"
            ? "bg-[#0B302B] text-white shadow-md"
            : "text-[#315B3E] hover:bg-[#F3F8F6]"
        }`}
      >
        <strong
          className={`block text-sm font-black ${
            activeView === "statistiques"
              ? "text-white"
              : "text-[#183F37]"
          }`}
        >
          Statistiques & contrats
        </strong>
        <span
          className={`mt-1 block text-xs font-semibold ${
            activeView === "statistiques"
              ? "text-[#BFD1C6]"
              : "text-[#60756E]"
          }`}
        >
          Notes, potentiel, salaire et échéance
        </span>
      </Link>
      <Link
        href="/jeu/effectif?vue=planning"
        aria-current={activeView === "planning" ? "page" : undefined}
        className={`rounded-xl px-5 py-4 transition ${
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
          Planning de saison
        </strong>
        <span
          className={`mt-1 block text-xs font-semibold ${
            activeView === "planning"
              ? "text-[#BFD1C6]"
              : "text-[#60756E]"
          }`}
        >
          Courses, stages, reconnaissances et blessures
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
        Les données de l’effectif restent accessibles dans la vue Statistiques
        & contrats.
      </p>
    </section>
  );
}

function TeamSeasonSummary({
  teamName,
  seasonName,
  seasonDayNumber,
  sponsorIdentity,
  divisionCode,
}: {
  teamName: string;
  seasonName: string;
  seasonDayNumber: number;
  sponsorIdentity:
    TeamSponsorIdentity | null;
  divisionCode: string | null;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#315B3E]/20 bg-white/85 px-5 py-4 shadow-[0_14px_34px_rgba(19,60,46,0.08)]">
      {sponsorIdentity ? (
        <div
          className="hidden h-14 w-24 items-center justify-center overflow-hidden rounded-lg border bg-white px-2 py-1 sm:flex"
          style={{
            borderColor: `${sponsorIdentity.sponsor.colors.primary}35`,
            backgroundColor:
              sponsorIdentity.sponsor.colors
                .background,
          }}
        >
          <SponsorLogo
            src={
              sponsorIdentity.sponsor.logoPath
            }
            alt={`Logo de ${sponsorIdentity.sponsor.name}`}
            sponsorName={
              sponsorIdentity.sponsor.name
            }
            primaryColor={
              sponsorIdentity.sponsor.colors
                .primary
            }
            backgroundColor={
              sponsorIdentity.sponsor.colors
                .background
            }
            textColor={
              sponsorIdentity.sponsor.colors
                .text
            }
          />
        </div>
      ) : null}

      <div className="text-right">
        <p className="font-black text-[#082A2A]">
          {teamName}
        </p>

        <p className="mt-1 text-sm font-semibold text-[#60756E]">
          {seasonName} · Jour{" "}
          {seasonDayNumber} / 28
        </p>
        <span className="mt-2 flex justify-end">
          <TeamDivisionBadge division={divisionCode} compact />
        </span>
      </div>
    </div>
  );
}

function TeamAmateurIdentityBanner({
  identity,
}: {
  identity: TeamAmateurIdentity;
}) {
  return (
    <article className="mt-8 overflow-hidden rounded-2xl border border-[#315B3E]/20 bg-white shadow-[0_20px_50px_rgba(19,60,46,0.1)]">
      <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_180px]">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            Identité fondatrice
          </p>
          <h2 className="mt-3 text-3xl font-black text-[#183F37]">
            {identity.amateurName}
          </h2>
          <Link
            href="/jeu/maillot"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#176951] px-5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0F5944] hover:shadow-md"
          >
            Modifier le maillot
            <span className="ml-2" aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="flex justify-center">
          <AmateurTeamJersey
            jersey={identity.jersey}
            teamName={identity.amateurName}
            className="h-44 w-40 drop-shadow-xl"
          />
        </div>
      </div>
    </article>
  );
}

function TeamCommercialIdentityBanner({
  identity,
}: {
  identity: TeamSponsorIdentity;
}) {
  const sponsor = identity.sponsor;

  return (
    <article
      className="relative mt-8 overflow-hidden rounded-2xl border bg-white shadow-[0_20px_50px_rgba(19,60,46,0.1)]"
      style={{
        borderColor: `${sponsor.colors.primary}45`,
        background: `linear-gradient(145deg, ${sponsor.colors.background}, #FFFFFF 36%, #FFFFFF 78%, ${sponsor.colors.secondary}70)`,
      }}
    >
      <div
        aria-hidden="true"
        className="h-2 w-full"
        style={{
          background: `linear-gradient(90deg, ${sponsor.colors.primary}, ${sponsor.colors.accent}, ${sponsor.colors.secondary})`,
        }}
      />

      <div className="grid items-center gap-7 p-6 sm:p-7 lg:grid-cols-[220px_minmax(0,1fr)_180px]">
        <div
          className="flex min-h-28 items-center justify-center overflow-hidden rounded-xl border bg-white/90 px-5 py-4"
          style={{
            borderColor: `${sponsor.colors.primary}30`,
          }}
        >
          <SponsorLogo
            src={sponsor.logoPath}
            alt={`Logo de ${sponsor.name}`}
            sponsorName={sponsor.name}
            primaryColor={
              sponsor.colors.primary
            }
            backgroundColor={
              sponsor.colors.background
            }
            textColor={sponsor.colors.text}
          />
        </div>

        <div>
          <p
            className="text-xs font-extrabold uppercase tracking-[0.17em]"
            style={{
              color: sponsor.colors.primary,
            }}
          >
            Identité de l’équipe
          </p>

          <h2
            className="mt-3 text-3xl font-black tracking-[-0.035em]"
            style={{
              color: sponsor.colors.text,
            }}
          >
            {identity.teamName}
          </h2>

          <p className="mt-2 text-sm font-bold text-[#60756E]">
            Sponsor principal : {sponsor.name}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <CommercialMetric
              label="Budget annuel"
              value={formatMoney(
                identity.budgetPerSeason,
                identity.currencyCode
              )}
              primaryColor={
                sponsor.colors.primary
              }
              backgroundColor={
                sponsor.colors.background
              }
            />

            <CommercialMetric
              label="Durée"
              value={formatDuration(
                identity.contractDurationSeasons
              )}
              primaryColor={
                sponsor.colors.primary
              }
              backgroundColor={
                sponsor.colors.background
              }
            />

            <CommercialMetric
              label="Maillot"
              value={
                identity.selectedJersey.name
              }
              primaryColor={
                sponsor.colors.primary
              }
              backgroundColor={
                sponsor.colors.background
              }
            />
          </div>
        </div>

        <div className="flex justify-center">
          <SponsorJerseyPreview
            sponsor={sponsor}
            jersey={
              identity.selectedJersey
            }
            className="h-44 w-40 drop-shadow-xl"
          />
        </div>
      </div>
    </article>
  );
}

function CommercialMetric({
  label,
  value,
  primaryColor,
  backgroundColor,
}: {
  label: string;
  value: string;
  primaryColor: string;
  backgroundColor: string;
}) {
  return (
    <div
      className="min-w-36 rounded-xl border px-4 py-3"
      style={{
        borderColor: `${primaryColor}25`,
        backgroundColor,
      }}
    >
      <p
        className="text-[0.65rem] font-extrabold uppercase tracking-[0.13em]"
        style={{
          color: primaryColor,
        }}
      >
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-[#082A2A]">
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/20 bg-white/90 p-5 shadow-[0_14px_34px_rgba(19,60,46,0.08)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
        {label}
      </p>

      <p className="mt-3 text-2xl font-black text-[#082A2A]">
        {value}
      </p>

      <p className="mt-2 text-sm font-semibold text-[#60756E]">
        {detail}
      </p>
    </article>
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
}: {
  sortKey: RosterSortKey;
  label: string;
  fullLabel: string;
  currentSortKey: RosterSortKey | null;
  currentDirection: RosterSortDirection;
  align?: "left" | "center" | "right";
  className?: string;
  linkClassName?: string;
}) {
  const isActive =
    currentSortKey === sortKey;
  const nextDirection =
    getNextRosterSortDirection({
      sortKey,
      currentSortKey,
      currentDirection,
    });
  const nextDirectionLabel =
    nextDirection === "asc"
      ? "croissant"
      : "décroissant";
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
        "p-0 text-xs font-extrabold uppercase tracking-wider",
        isActive
          ? "bg-[#E1F0EA] text-[#176951]"
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
            isActive
              ? "text-[#176951]"
              : "text-[#91A69F]",
          ].join(" ")}
        >
          {isActive
            ? currentDirection === "asc"
              ? "↑"
              : "↓"
            : "↕"}
        </span>
      </Link>
    </th>
  );
}

function RiderTableRow({
  rider,
  jersey,
  health,
}: {
  rider: RiderRow;
  jersey: RiderJerseyAppearance;
  health: {
    injury: RiderMedicalInjury | null;
    formCamp: RiderFormCamp | null;
  } | null;
}) {
  const riderName =
    `${rider.first_name} ${rider.last_name}`.trim();

  const riderProfile = getRiderSportingProfile(toRiderRatings(rider));

  const riderAverage =
    getRiderAverage(rider);

  return (
    <tr className="border-b border-[#315B3E]/10 transition last:border-b-0 hover:bg-[#F6FAF8]">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-white px-5 py-4 text-left"
      >
        <Link
          href={`/jeu/coureurs/${rider.rider_id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
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
                  health.injury.expectedRecoveryAt
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
                isoAlpha2={
                  rider.country_iso_alpha2
                }
                countryName={
                  rider.country_name
                }
              />

              <span className="truncate text-xs font-semibold text-[#60756E]">
                {rider.country_name}
              </span>
              <span className="text-xs font-black text-[#278B70]" aria-hidden="true">
                ↗
              </span>
            </div>
            {health?.injury ? (
              <p className="mt-1 truncate text-[10px] font-black text-[#B54242]">
                {health.injury.label} · reprise {formatMedicalDate(health.injury.expectedRecoveryAt)}
              </p>
            ) : health?.formCamp ? (
              <p className="mt-1 truncate text-[10px] font-black text-[#8A6B16]">
                {health.formCamp.label} · J{health.formCamp.startDay}–J{health.formCamp.endDay}
              </p>
            ) : null}
          </div>
        </Link>
      </th>

      <td className="px-3 py-4 text-center font-black text-[#082A2A]">
        {rider.age}
      </td>

      <td className="px-3 py-4">
        <span className="inline-flex rounded-full bg-[#D7EEE8] px-3 py-1.5 text-xs font-extrabold text-[#176951]">
          {riderProfile}
        </span>
      </td>

      <td className="px-3 py-4 text-center">
        <PotentialStars
          potentialSteps={rider.potential_steps}
          compact
          showLabel={false}
        />
      </td>

      {ratingColumns.map((column) => {
        const value = rider[column.key];

        return (
          <td
            key={column.key}
            className="px-2 py-4 text-center"
          >
            <RatingBadge
              value={value}
              label={column.fullLabel}
            />
          </td>
        );
      })}

      <td className="px-3 py-4 text-center">
        <span className="font-black text-[#082A2A]">
          {riderAverage}
        </span>
      </td>

      <td className="px-4 py-4 text-right font-bold text-[#48665F]">
        <p>{formatMoney(
          Number(rider.salary_per_season) / 4,
          rider.contract_currency
        )} / sem.</p>
        <p className="mt-1 text-[10px] font-semibold text-[#82958F]">
          {formatMoney(rider.salary_per_season, rider.contract_currency)} / saison
        </p>
      </td>

      <td className="px-5 py-4">
        <p className="font-bold text-[#082A2A]">
          {
            rider.contract_end_season_name
          }
        </p>

        <p className="mt-1 text-xs font-semibold text-[#60756E]">
          Expire en fin de saison
        </p>
      </td>
    </tr>
  );
}

function RatingBadge({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <span
      title={`${label} : ${value}`}
      className={[
        "inline-flex h-9 min-w-10 items-center justify-center rounded-lg border px-2 text-sm font-black",
        getRiderRatingColorClasses(value),
      ].join(" ")}
    >
      {value}
    </span>
  );
}

function MedicalCrossIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
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
      <span className="text-[#BFD1C6]">
        Échelle :
      </span>

      <span className="rounded-md bg-white px-2 py-1 text-[#48665F]">
        &lt; 50
      </span>

      <span className="rounded-md bg-[#DDF3E3] px-2 py-1 text-[#2C6A3F]">
        50+
      </span>

      <span className="rounded-md bg-[#A9DFB7] px-2 py-1 text-[#174E2A]">
        60+
      </span>

      <span className="rounded-md bg-[#3F8F5A] px-2 py-1 text-white">
        70+
      </span>

      <span className="rounded-md bg-[#F4B04D] px-2 py-1 text-[#5B3100]">
        80+
      </span>

      <span className="rounded-md bg-[#D84B4B] px-2 py-1 text-white">
        90+
      </span>
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

      <h2 className="mt-5 text-xl font-black">
        Aucun coureur récupéré
      </h2>

      <p className="mx-auto mt-3 max-w-xl leading-7 text-[#60756E]">
        L’équipe existe, mais aucun contrat actif
        n’a été trouvé pour la saison actuelle.
      </p>
    </div>
  );
}

function RosterErrorMessage() {
  return (
    <div className="mt-8 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
      L’effectif n’a pas pu être récupéré.
      Consultez les journaux techniques pour
      connaître le détail de l’erreur.
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
      L’effectif reste disponible, mais
      l’identité commerciale de l’équipe n’a pas
      pu être chargée.

      <span className="mt-1 block text-xs font-medium">
        {message}
      </span>
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
    </svg>
  );
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
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function isRatingKey(
  sortKey: RosterSortKey
): sortKey is RatingKey {
  return ratingColumns.some(
    (column) => column.key === sortKey
  );
}

function getRiderSortName(
  rider: RiderRow
): string {
  return `${rider.last_name} ${rider.first_name} ${rider.rider_id}`;
}

function getRosterSortValue(
  rider: RiderRow,
  sortKey: RosterSortKey
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
      return getRiderSportingProfile(
        toRiderRatings(rider)
      );
    case "potential":
      return rider.potential_steps;
    case "average":
      return getRiderAverage(rider);
    case "salary": {
      const salary = Number(
        rider.salary_per_season
      );

      return Number.isFinite(salary)
        ? salary
        : null;
    }
    case "contract":
      return rider.contract_end_season_name;
  }
}

function getRiderAverage(
  rider: RiderRow
): number {
  const total = ratingColumns.reduce(
    (sum, column) =>
      sum + rider[column.key],
    0
  );

  return Math.round(
    total / ratingColumns.length
  );
}

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur inattendue est survenue.";
}

function formatMoney(
  value: number | string,
  currency: string
): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "Non disponible";
  }

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numericValue);
  } catch {
    return `${numericValue.toLocaleString(
      "fr-FR"
    )} ${currency}`;
  }
}

function formatDuration(
  value: number
): string {
  return `${value} saison${value === 1 ? "" : "s"}`;
}

function formatRiderCount(
  value: number
): string {
  return `${value} coureur${value === 1 ? "" : "s"}`;
}
