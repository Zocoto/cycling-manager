"use server";

import { z } from "zod";

import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { getRaceSimulatorTeams } from "@/services/race-simulator";
import { canAccessRaceSimulator } from "@/lib/game/race-simulator-access";
import {
  buildRaceSimulatorLogs,
  getRaceSimulationOverallNote,
  getRaceSimulationProfileNote,
  type RaceSimulatorActionState,
  type RaceSimulatorRun,
} from "@/lib/game/race-simulator";
import {
  simulateRaceStage,
  type RiderSimulationInput,
  type StageSimulationInput,
} from "@/lib/game/race-simulation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const simulationRequestSchema = z.object({
  stageId: z.string().uuid(),
  seed: z.string().trim().min(1).max(80),
  riderIds: z.array(z.string().uuid()).min(2).max(200),
});

export async function runRaceSimulatorAction(
  _previousState: RaceSimulatorActionState,
  formData: FormData
): Promise<RaceSimulatorActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (
    authenticationError ||
    !user ||
    !canAccessRaceSimulator(user.email)
  ) {
    return {
      status: "forbidden",
      message: "Ce laboratoire de simulation est réservé au compte autorisé.",
      run: null,
    };
  }

  const parsed = simulationRequestSchema.safeParse({
    stageId: readFormValue(formData, "stageId"),
    seed: readFormValue(formData, "seed"),
    riderIds: unique(
      formData
        .getAll("riderIds")
        .filter((value): value is string => typeof value === "string")
    ),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Sélection invalide : choisissez un profil et au moins deux coureurs présents en base.",
      run: null,
    };
  }

  try {
    const [calendar, teams] = await Promise.all([
      getActiveSeasonRaceCalendar(supabase, new Date()),
      getRaceSimulatorTeams(),
    ]);
    if (!calendar) {
      return {
        status: "error",
        message: "Aucune saison active ne fournit de profil de course.",
        run: null,
      };
    }
    const stageContext = calendar.editions
      .flatMap((edition) =>
        edition.stages.map((stage) => ({ edition, stage }))
      )
      .find(({ stage }) => stage.id === parsed.data.stageId);

    if (!stageContext) {
      return {
        status: "error",
        message: "Le profil de course sélectionné n’existe plus dans la saison active.",
        run: null,
      };
    }

    const selectedIds = new Set(parsed.data.riderIds);
    const selectedRiders: RiderSimulationInput[] = teams.flatMap((team) =>
      team.riders
        .filter((rider) => selectedIds.has(rider.id))
        .map((rider) => ({
          id: rider.id,
          name: `${rider.firstName} ${rider.lastName}`,
          teamId: team.id,
          teamName: team.name,
          teamPrimaryColor: team.primaryColor,
          teamSecondaryColor: team.secondaryColor,
          age: rider.age,
          form: rider.form,
          countryCode: rider.countryCode,
          role: "auto" as const,
          specialAbilities: rider.specialAbilities,
          ratings: rider.ratings,
        }))
    );

    if (selectedRiders.length !== parsed.data.riderIds.length) {
      return {
        status: "error",
        message:
          "La start-list contient un coureur qui n’est plus disponible dans les équipes ou parmi les agents libres. Rechargez la page.",
        run: null,
      };
    }

    const { edition, stage } = stageContext;
    const input: StageSimulationInput = {
      id: `race-simulator:${stage.id}`,
      name:
        edition.raceFormat === "stage_race"
          ? `${edition.name} — ${stage.name}`
          : edition.name,
      stageType: stage.stageType,
      profileType: stage.profileType,
      raceCountryCode: edition.countryCode,
      isStageRace: edition.raceFormat === "stage_race",
      seed: parsed.data.seed,
      segments: stage.segments,
      riders: selectedRiders,
    };
    const simulation = simulateRaceStage(input);
    const riderById = new Map(
      simulation.resolvedRiders.map((rider) => [rider.id, rider])
    );
    const run: RaceSimulatorRun = {
      simulationId: `${stage.id}:${simulation.seed}`,
      stageId: stage.id,
      stageName: input.name,
      stageType: input.stageType,
      seed: simulation.seed,
      distanceKm: input.segments.reduce(
        (total, segment) => total + segment.distanceKm,
        0
      ),
      segmentCount: input.segments.length,
      riderCount: simulation.resolvedRiders.length,
      teamCount: new Set(
        simulation.resolvedRiders.map((rider) => rider.teamId)
      ).size,
      results: simulation.results.map((result) => {
        const rider = riderById.get(result.riderId);
        if (!rider) {
          throw new Error(
            `Le moteur a renvoyé un coureur inconnu : ${result.riderId}.`
          );
        }

        return {
          riderId: rider.id,
          riderName: rider.name,
          teamId: rider.teamId,
          teamName: rider.teamName,
          teamPrimaryColor: rider.teamPrimaryColor,
          teamSecondaryColor: rider.teamSecondaryColor,
          role: rider.role,
          rank: result.rank,
          status: result.status,
          elapsedTimeSeconds: result.elapsedTimeSeconds,
          gapToWinnerSeconds: result.gapToWinnerSeconds,
          energyAfter: result.energyAfter,
          form: rider.form,
          overallNote: getRaceSimulationOverallNote(rider.ratings),
          profileNote: getRaceSimulationProfileNote({
            rider,
            segments: input.segments,
            stageType: input.stageType,
            profileType: input.profileType,
          }),
          ratings: rider.ratings,
          injuryLabel: result.injury?.label ?? null,
        };
      }),
      logs: buildRaceSimulatorLogs(input, simulation),
    };

    return {
      status: "success",
      message: `Simulation terminée : ${run.riderCount} coureurs et ${run.logs.length} entrées de journal générées.`,
      run,
    };
  } catch (error) {
    console.error("Échec du laboratoire de simulation de course :", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Le moteur n’a pas pu terminer cette simulation.",
      run: null,
    };
  }
}

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: string[]) {
  return [...new Set(values)];
}
