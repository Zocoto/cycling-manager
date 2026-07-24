"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  buildTutorialRaceRun,
  createTutorialRaceSeed,
  createTutorialRaceSimulationInput,
  isTutorialRaceSelectionValid,
  TUTORIAL_RACE_KEY,
  TUTORIAL_RACE_ROUTE,
  TUTORIAL_RACE_SELECTION_SIZE,
  TUTORIAL_RACE_VERSION,
  type TutorialRaceRider,
} from "@/lib/tutorial/tutorial-race";
import { simulateRaceStage } from "@/lib/game/race-simulation";
import {
  getActiveTutorialSession,
  getAuthenticatedTutorialProgress,
  requireAuthenticatedSportingDirectorId,
} from "@/lib/tutorial/progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RaceSimulatorRun } from "@/lib/game/race-simulator";
import type {
  TutorialProgressRow,
  TutorialSessionRow,
} from "@/types/tutorial";

const runTutorialRaceSchema = z.object({
  riderIds: z
    .array(z.string().uuid())
    .length(TUTORIAL_RACE_SELECTION_SIZE),
});

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

type TutorialRaceActionSuccess = {
  ok: true;
  progress: TutorialProgressRow;
  run: RaceSimulatorRun;
};

type TutorialRaceActionFailure = {
  ok: false;
  error: string;
};

export type TutorialRaceActionResult =
  | TutorialRaceActionSuccess
  | TutorialRaceActionFailure;

export async function runTutorialRaceAction(
  input: unknown,
): Promise<TutorialRaceActionResult> {
  try {
    const parsed =
      runTutorialRaceSchema.parse(input) as {
        riderIds: string[];
      };

    if (
      !isTutorialRaceSelectionValid(
        parsed.riderIds,
      )
    ) {
      throw new Error(
        `Sélectionnez exactement ${TUTORIAL_RACE_SELECTION_SIZE} coureurs différents.`,
      );
    }

    const supabase =
      await createSupabaseServerClient();

    const sportingDirectorId =
      await requireAuthenticatedSportingDirectorId(
        supabase,
      );

    const [teamResult, rosterResult] =
      await Promise.all([
        supabase
          .rpc(
            "get_current_team_dashboard_summary",
          )
          .maybeSingle<CurrentTeamDashboardSummary>(),
        supabase.rpc(
          "get_current_team_roster_with_potential",
        ),
      ]);

    if (
      teamResult.error ||
      !teamResult.data
    ) {
      throw new Error(
        "Fondez votre équipe amateur avant de lancer la course d’initiation.",
      );
    }

    if (rosterResult.error) {
      throw new Error(
        `Impossible de charger votre effectif : ${rosterResult.error.message}`,
      );
    }

    const roster =
      (rosterResult.data ??
        []) as TutorialRosterRow[];

    const rosterById = new Map(
      roster.map((rider) => [
        rider.rider_id,
        rider,
      ]),
    );

    const selectedRows =
      parsed.riderIds.map((riderId) => {
        const rider =
          rosterById.get(riderId);

        if (!rider) {
          throw new Error(
            "La sélection contient un coureur qui n’appartient plus à votre effectif.",
          );
        }

        return rider;
      });

    const selectedRiders: TutorialRaceRider[] =
      selectedRows.map((rider) => ({
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

    const seed =
      createTutorialRaceSeed(
        sportingDirectorId,
      );

    const simulationInput =
      createTutorialRaceSimulationInput({
        selectedRiders,
        teamId: teamResult.data.team_id,
        teamName:
          teamResult.data.team_name,
        teamPrimaryColor: "#176951",
        teamSecondaryColor: "#F2C94C",
        seed,
      });

    const simulation =
      simulateRaceStage(simulationInput);

    const run = buildTutorialRaceRun(
      simulationInput,
      simulation,
    );

    const progress =
      await persistTutorialRaceRun({
        supabase,
        sportingDirectorId,
        selectedRiderIds:
          parsed.riderIds,
        seed,
        run,
      });

    return {
      ok: true,
      progress,
      run,
    };
  } catch (error) {
    console.error(
      "Échec de la course d’initiation :",
      error,
    );

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "La course d’initiation n’a pas pu être simulée.",
    };
  }
}

export async function completeTutorialRaceAction(): Promise<
  | {
      ok: true;
      progress: TutorialProgressRow;
    }
  | {
      ok: false;
      error: string;
    }
> {
  try {
    const supabase =
      await createSupabaseServerClient();

    const progress =
      await getAuthenticatedTutorialProgress(
        supabase,
        TUTORIAL_RACE_KEY,
      );

    if (!progress) {
      throw new Error(
        "Aucune course d’initiation n’a été commencée.",
      );
    }

    const raceRun =
      progress.metadata.raceRun;

    if (
      !raceRun ||
      typeof raceRun !== "object"
    ) {
      throw new Error(
        "Terminez d’abord la simulation et consultez son classement.",
      );
    }

    const now = new Date().toISOString();

    const {
      data: completedProgress,
      error: progressError,
    } = await supabase
      .from("tutorial_progress")
      .update({
        tutorial_type: "race_scenario",
        tutorial_version:
          TUTORIAL_RACE_VERSION,
        status: "completed",
        current_step_key: "experience",
        current_route:
          TUTORIAL_RACE_ROUTE,
        started_at:
          progress.started_at ?? now,
        completed_at: now,
        skipped_at: null,
        metadata: {
          ...progress.metadata,
          completedAt: now,
        },
      })
      .eq("id", progress.id)
      .select("*")
      .single();

    if (progressError) {
      throw new Error(
        `Impossible de terminer la course d’initiation : ${progressError.message}`,
      );
    }

    const activeSession =
      await getActiveTutorialSession(
        supabase,
        progress.id,
      );

    if (activeSession) {
      await completeTutorialRaceSession({
        supabase,
        session: activeSession,
      });
    }

    revalidatePath(
      TUTORIAL_RACE_ROUTE,
    );
    revalidatePath("/jeu/objectifs");
    revalidatePath("/jeu");

    return {
      ok: true,
      progress:
        completedProgress as TutorialProgressRow,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "La course d’initiation n’a pas pu être validée.",
    };
  }
}

async function persistTutorialRaceRun({
  supabase,
  sportingDirectorId,
  selectedRiderIds,
  seed,
  run,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createSupabaseServerClient
    >
  >;
  sportingDirectorId: string;
  selectedRiderIds: string[];
  seed: string;
  run: RaceSimulatorRun;
}): Promise<TutorialProgressRow> {
  const existing =
    await getAuthenticatedTutorialProgress(
      supabase,
      TUTORIAL_RACE_KEY,
    );

  const now = new Date().toISOString();

  const metadata = {
    ...(existing?.metadata ?? {}),
    selectedRiderIds,
    seed,
    raceRun: run,
    simulatedAt: now,
  };

  if (!existing) {
    const { data, error } =
      await supabase
        .from("tutorial_progress")
        .insert({
          sporting_director_id:
            sportingDirectorId,
          tutorial_key:
            TUTORIAL_RACE_KEY,
          tutorial_type:
            "race_scenario",
          tutorial_version:
            TUTORIAL_RACE_VERSION,
          status: "in_progress",
          current_step_key:
            "experience",
          current_route:
            TUTORIAL_RACE_ROUTE,
          started_at: now,
          metadata,
        })
        .select("*")
        .single();

    if (error) {
      throw new Error(
        `Impossible d’enregistrer la course d’initiation : ${error.message}`,
      );
    }

    return data as TutorialProgressRow;
  }

  const remainsCompleted =
    existing.status === "completed";

  const { data, error } =
    await supabase
      .from("tutorial_progress")
      .update({
        tutorial_type:
          "race_scenario",
        tutorial_version:
          TUTORIAL_RACE_VERSION,
        status: remainsCompleted
          ? "completed"
          : "in_progress",
        current_step_key:
          "experience",
        current_route:
          TUTORIAL_RACE_ROUTE,
        started_at:
          existing.started_at ?? now,
        completed_at: remainsCompleted
          ? existing.completed_at ?? now
          : null,
        skipped_at: null,
        metadata,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

  if (error) {
    throw new Error(
      `Impossible de sauvegarder le replay d’initiation : ${error.message}`,
    );
  }

  return data as TutorialProgressRow;
}

async function completeTutorialRaceSession({
  supabase,
  session,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createSupabaseServerClient
    >
  >;
  session: TutorialSessionRow;
}): Promise<void> {
  const { error } = await supabase
    .from("tutorial_sessions")
    .update({
      status: "completed",
      last_step_key: "experience",
      ended_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (error) {
    throw new Error(
      `Impossible de terminer la session d’initiation : ${error.message}`,
    );
  }
}
