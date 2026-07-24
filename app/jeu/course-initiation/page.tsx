import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { TutorialRaceExperience } from "@/components/tutorial/tutorial-race-experience";
import {
  getTutorialRaceRunFromMetadata,
  getTutorialRaceSelectionFromMetadata,
  TUTORIAL_RACE_KEY,
  type TutorialRaceRider,
} from "@/lib/tutorial/tutorial-race";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Course d’initiation",
  description:
    "Sélectionnez vos coureurs et découvrez le véritable moteur de course de Cyclostratège sans conséquence officielle.",
};

type CurrentTeamDashboardSummary = {
  team_id: string;
  team_name: string;
  rider_count: number;
  season_id: string;
  season_name: string;
  season_day_number: number;
};

type TutorialRosterRow = {
  rider_id: string;
  first_name: string;
  last_name: string;
  country_name: string;
  country_iso_alpha2: string;
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

export default async function TutorialRacePage() {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [
    headerData,
    teamResult,
    rosterResult,
    progress,
  ] = await Promise.all([
    getGameHeaderData(
      supabase,
      user.id,
    ),
    supabase
      .rpc(
        "get_current_team_dashboard_summary",
      )
      .maybeSingle<CurrentTeamDashboardSummary>(),
    supabase.rpc(
      "get_current_team_roster_with_potential",
    ),
    getAuthenticatedTutorialProgress(
      supabase,
      TUTORIAL_RACE_KEY,
    ),
  ]);

  if (
    teamResult.error ||
    rosterResult.error
  ) {
    console.error(
      "Impossible de préparer la course d’initiation :",
      teamResult.error ??
        rosterResult.error,
    );
  }

  const roster =
    (rosterResult.data ??
      []) as TutorialRosterRow[];

  const riders: TutorialRaceRider[] =
    roster.map((rider) => ({
      id: rider.rider_id,
      firstName: rider.first_name,
      lastName: rider.last_name,
      countryCode:
        rider.country_iso_alpha2,
      countryName: rider.country_name,
      age: rider.age,
      ratings: {
        flat: rider.flat,
        mountain: rider.mountain,
        hills: rider.hills,
        cobbles: rider.cobbles,
        downhill: rider.downhill,
        sprint: rider.sprint,
        acceleration: rider.acceleration,
        timeTrial: rider.time_trial,
        prologue: rider.prologue,
        endurance: rider.endurance,
        resistance: rider.resistance,
        recovery: rider.recovery,
        breakaway: rider.breakaway,
      },
    }));

  const initialRun =
    getTutorialRaceRunFromMetadata(
      progress?.metadata,
    );

  const initialSelectedRiderIds =
    getTutorialRaceSelectionFromMetadata(
      progress?.metadata,
    );

  const canStart =
    Boolean(teamResult.data) &&
    riders.length >= 5;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={
          headerData.displayName
        }
        sponsor={
          headerData.teamSponsorIdentity
            ?.sponsor ?? null
        }
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <header className="max-w-4xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#278B70]">
              Formation essentielle · sans conséquence officielle
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Critérium de découverte
            </h1>

            <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-[#48665F]">
              Composez une sélection de cinq coureurs, lancez le véritable
              moteur de course puis suivez son replay accéléré. Aucun point,
              aucune prime, aucune fatigue, aucune blessure et aucun objectif
              sportif officiel ne seront enregistrés.
            </p>
          </header>

          <BackToOfficeLink />
        </div>

        {canStart && teamResult.data ? (
          <div className="mt-8">
            <TutorialRaceExperience
              riders={riders}
              teamName={
                teamResult.data.team_name
              }
              initialRun={initialRun}
              initialSelectedRiderIds={
                initialSelectedRiderIds
              }
              initiallyCompleted={
                progress?.status ===
                "completed"
              }
            />
          </div>
        ) : (
          <section className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 px-6 py-8 text-amber-950">
            <h2 className="text-xl font-black">
              Votre équipe doit être prête
            </h2>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7">
              Finalisez le profil du Directeur Sportif, fondez votre structure
              amateur et générez au moins cinq coureurs avant de participer à
              la course d’initiation.
            </p>

            <Link
              href="/jeu/directeur-sportif"
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-amber-950 px-5 text-sm font-black text-white transition hover:bg-amber-900"
            >
              Finaliser ma structure
            </Link>
          </section>
        )}
      </section>
    </main>
  );
}
