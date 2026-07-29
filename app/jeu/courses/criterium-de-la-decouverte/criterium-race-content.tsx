import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { registerCriteriumDiscoveryRosterAction } from "./actions";
import { GameHeader } from "@/components/game/game-header";
import { RaceRosterSelector } from "@/components/game/race-roster-selector";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import {
  RACE_CATEGORY_STYLE,
  RACE_PROFILE_LABELS,
} from "@/lib/game/race-calendar";
import { RACE_ROLE_LABELS } from "@/lib/game/race-simulation";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
} from "@/lib/rider-jersey";
import {
  CRITERIUM_DISCOVERY_KEY,
  CRITERIUM_DISCOVERY_RACE_ROUTE,
  CRITERIUM_DISCOVERY_REGISTRATION_STEP_KEYS,
  CRITERIUM_DISCOVERY_RESULTS_ROUTE,
  createCriteriumDiscoveryPreviewEdition,
  getCriteriumDiscoveryRunFromMetadata,
} from "@/lib/tutorial/criterium-discovery";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentTeamHealthOverview } from "@/services/team-health";
import { getTeamAmateurIdentityForAuthUser } from "@/services/team-amateur-identity";
import { getActiveTeamSponsorIdentityForAuthUser } from "@/services/team-sponsor-identity";
import type { RaceRosterOption } from "@/services/race-calendar";

export type CriteriumRacePageProps = {
  searchParams: Promise<{
    erreur?: string | string[];
  }>;
};

type TutorialRosterRow = {
  rider_id: string;
  first_name: string;
  last_name: string;
  country_name: string;
  country_iso_alpha2: string;
  avatar_profile_key: string;
  avatar_seed: number | string;
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
};

export async function CriteriumDiscoveryRaceContent({
  searchParams,
}: CriteriumRacePageProps) {
  const resolvedSearchParams = await searchParams;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [
    headerData,
    rosterResult,
    healthOverview,
    sponsorIdentity,
    amateurIdentity,
    progress,
  ] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    supabase.rpc("get_current_team_roster_with_potential"),
    getCurrentTeamHealthOverview(user.id).catch(() => null),
    getActiveTeamSponsorIdentityForAuthUser(user.id).catch(() => null),
    getTeamAmateurIdentityForAuthUser(user.id).catch(() => null),
    getAuthenticatedTutorialProgress(supabase, CRITERIUM_DISCOVERY_KEY),
  ]);

  if (rosterResult.error) {
    console.error(
      "Impossible de charger l’effectif pour le Critérium de la découverte :",
      rosterResult.error,
    );
  }

  const run = getCriteriumDiscoveryRunFromMetadata(progress?.metadata);

  const edition =
    run?.edition ??
    createCriteriumDiscoveryPreviewEdition({
      dayNumber: healthOverview?.currentDayNumber ?? 1,
    });

  const stage = edition.stages[0];

  if (!stage) {
    throw new Error(
      "Le profil du Critérium de la découverte est indisponible.",
    );
  }

  const selectedIds = new Set(run?.roster.map((entry) => entry.riderId) ?? []);

  const healthByRiderId = new Map(
    (healthOverview?.riders ?? []).map((rider) => [rider.id, rider]),
  );

  const rosterRows = (rosterResult.data ?? []) as TutorialRosterRow[];

  const rosterOptions: RaceRosterOption[] = rosterRows.map((rider) => {
    const health = healthByRiderId.get(rider.rider_id);

    const unavailability = health?.injury
      ? {
          type: "injury" as const,
          label: health.injury.label,
          until: health.injury.expectedRecoveryAt,
        }
      : health?.formCamp
        ? {
            type: "form_camp" as const,
            label: health.formCamp.label,
            until: null,
          }
        : null;

    return {
      riderId: rider.rider_id,
      firstName: rider.first_name,
      lastName: rider.last_name,
      countryName: rider.country_name,
      countryCode: rider.country_iso_alpha2,
      avatarProfileKey: rider.avatar_profile_key,
      avatarSeed: rider.avatar_seed,
      age: Number(rider.age),
      mountain: Number(rider.mountain),
      hills: Number(rider.hills),
      flat: Number(rider.flat),
      timeTrial: Number(rider.time_trial),
      cobbles: Number(rider.cobbles),
      sprint: Number(rider.sprint),
      isSelected: selectedIds.has(rider.rider_id),
      isAvailable: unavailability === null,
      unavailability,
      conflict: null,
    };
  });

  const riderJersey = sponsorIdentity
    ? createSponsoredRiderJersey({
        colors: sponsorIdentity.sponsor.colors,
        style: sponsorIdentity.selectedJersey.style,
        imagePath: sponsorIdentity.selectedJersey.imagePath,
      })
    : amateurIdentity
      ? createAmateurRiderJersey(amateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;

  const style = RACE_CATEGORY_STYLE[edition.categoryCode];

  const errorMessage = readSingleSearchParam(resolvedSearchParams.erreur);

  const selectedRiders = run
    ? rosterOptions.filter((rider) => selectedIds.has(rider.riderId))
    : [];

  const tutorialIsOnRegistrationStep =
    progress?.status === "in_progress" &&
    CRITERIUM_DISCOVERY_REGISTRATION_STEP_KEYS.some(
      (stepKey) => stepKey === progress.current_step_key,
    );

  const shouldShowRegistrationForm = !run || tutorialIsOnRegistrationStep;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {progress?.status === "in_progress" &&
      progress.current_route === CRITERIUM_DISCOVERY_RACE_ROUTE &&
      progress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={CRITERIUM_DISCOVERY_KEY}
          currentStepKey={progress.current_step_key}
        />
      ) : null}

      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu/calendrier?formation=criterium"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
        >
          <span aria-hidden="true">←</span>
          Retour au calendrier
        </Link>

        <div className="mt-5 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_24px_70px_rgba(19,60,46,0.12)]">
          <header
            data-tutorial-id="criterium-briefing"
            className="relative overflow-hidden bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white sm:px-9 sm:py-10"
          >
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="rounded px-3 py-1.5 text-[10px] font-black uppercase tracking-wider"
                    style={{
                      backgroundColor: style.background,
                      color: style.foreground,
                    }}
                  >
                    Initiation
                  </span>

                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#D6DFD2]">
                    Sans conséquence officielle
                  </span>
                </div>

                <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                  {edition.name}
                </h1>

                <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-[#C1D3CA] sm:text-lg">
                  Inscrivez votre équipe exactement comme sur une course de la
                  saison, puis retrouvez la simulation dans le véritable espace
                  Résultats / Live sous la forme d’un replay accélérable.
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right backdrop-blur">
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#A8DEC6]">
                  {RACE_PROFILE_LABELS[stage.profileType]}
                </p>
                <p className="mt-1 text-2xl font-black text-[#F2C94C]">
                  {stage.distanceKm} km
                </p>
                <p className="mt-1 text-xs font-bold text-[#D6DFD2]">
                  5 coureurs obligatoires
                </p>
              </div>
            </div>
          </header>

          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(330px,0.7fr)]">
            <div>
              <section
                data-tutorial-id="criterium-course-profile"
                className="rounded-2xl border border-[#315B3E]/15 bg-[#F8FBF9] p-5 sm:p-6"
              >
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#176951]">
                  Profil officiel
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#0B302B]">
                  Une course mixte pour apprendre à composer
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
                  Le parcours mobilise la plaine, les vallons, la montagne et
                  les pavés. Comparez les notes principales de vos coureurs
                  avant de leur attribuer leurs rôles.
                </p>
                <div className="mt-5">
                  <RaceStageProfile segments={stage.segments} />
                </div>
              </section>

              <section className="mt-6 rounded-2xl border border-[#315B3E]/15 bg-white p-5 sm:p-6">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#176951]">
                  Conditions pédagogiques
                </p>
                <ul className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-[#48665F] sm:grid-cols-2">
                  <li className="rounded-xl bg-[#F5F9F7] px-4 py-3">
                    Aucun point ni classement officiel
                  </li>
                  <li className="rounded-xl bg-[#F5F9F7] px-4 py-3">
                    Aucune prime ni dépense enregistrée
                  </li>
                  <li className="rounded-xl bg-[#F5F9F7] px-4 py-3">
                    Aucune fatigue ou blessure persistée
                  </li>
                  <li className="rounded-xl bg-[#F5F9F7] px-4 py-3">
                    Replay identique à l’affichage des vraies courses
                  </li>
                </ul>
              </section>
            </div>

            <aside>
              {errorMessage ? (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-900"
                >
                  {errorMessage.slice(0, 300)}
                </div>
              ) : null}

              {!healthOverview || rosterOptions.length < 5 ? (
                <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm">
                  <h2 className="text-xl font-black">
                    Votre structure doit être prête
                  </h2>
                  <p className="mt-3 text-sm font-semibold leading-6">
                    Finalisez votre profil, fondez votre équipe amateur et
                    générez au moins cinq coureurs avant de vous inscrire.
                  </p>
                  <Link
                    href="/jeu/directeur-sportif"
                    className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-amber-950 px-5 text-sm font-black text-white"
                  >
                    Finaliser ma structure
                  </Link>
                </section>
              ) : run && !shouldShowRegistrationForm ? (
                <section className="rounded-2xl border border-emerald-400/35 bg-[#0B302B] p-6 text-white shadow-[0_18px_45px_rgba(7,26,23,0.2)]">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                    Inscription
                  </p>
                  <h2 className="mt-3 text-xl font-black">Équipe inscrite</h2>
                  <p className="mt-3 text-sm leading-6 text-[#D6DFD2]">
                    Votre participation est acceptée avec cinq coureurs. La
                    simulation est verrouillée et prête dans Résultats / Live.
                  </p>

                  <ul className="mt-5 space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 text-xs font-bold text-[#D6DFD2]">
                    {selectedRiders.map((rider) => {
                      const role =
                        run.roster.find(
                          (entry) => entry.riderId === rider.riderId,
                        )?.role ?? "auto";

                      return (
                        <li
                          key={rider.riderId}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <RiderAvatar
                              profileKey={rider.avatarProfileKey}
                              seed={rider.avatarSeed}
                              riderId={rider.riderId}
                              age={rider.age}
                              jersey={riderJersey}
                              label={`Portrait de ${rider.firstName} ${rider.lastName}`}
                              className="h-9 w-9"
                            />
                            <span className="truncate">
                              {rider.firstName} {rider.lastName}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-[#9BE0BC]">
                            {RACE_ROLE_LABELS[role]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    href={CRITERIUM_DISCOVERY_RESULTS_ROUTE}
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-sm font-black text-[#17261E] transition hover:bg-[#F7D96C]"
                  >
                    Voir le replay et les résultats
                  </Link>
                </section>
              ) : (
                <section className="rounded-2xl border border-[#315B3E]/15 bg-[#0B302B] p-6 text-white shadow-[0_18px_45px_rgba(7,26,23,0.2)]">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                    Inscription
                  </p>
                  <h2 className="mt-3 text-xl font-black">
                    Composer votre équipe
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#D6DFD2]">
                    Utilisez la même sélection et les mêmes rôles que pour une
                    course officielle.
                  </p>

                  <form action={registerCriteriumDiscoveryRosterAction}>
                    <RaceRosterSelector
                      riders={rosterOptions}
                      minimum={5}
                      maximum={5}
                      jersey={riderJersey}
                      isStageRace={false}
                      submitLabel="Valider l’inscription"
                      showRoleGuide
                      tutorialIds={{
                        selection: "criterium-rider-selection",
                        roleGuide: "criterium-role-guide",
                        roleAssignment: "criterium-role-assignment",
                        submit: "criterium-registration-submit",
                      }}
                    />
                  </form>
                </section>
              )}
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function readSingleSearchParam(
  value: string | string[] | undefined,
): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
