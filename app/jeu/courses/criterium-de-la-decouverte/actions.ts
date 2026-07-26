"use server";

import {
  revalidatePath,
} from "next/cache";
import { redirect } from "next/navigation";

import {
  CRITERIUM_DISCOVERY_KEY,
  CRITERIUM_DISCOVERY_RACE_ROUTE,
  CRITERIUM_DISCOVERY_REGISTRATION_STEP_KEY,
  CRITERIUM_DISCOVERY_RESULTS_ROUTE,
  CRITERIUM_DISCOVERY_ROSTER_SIZE,
  CRITERIUM_DISCOVERY_VERSION,
  createCriteriumDiscoveryRun,
  isValidCriteriumDiscoveryRoster,
  type CriteriumDiscoveryRosterEntry,
} from "@/lib/tutorial/criterium-discovery";
import {
  RACE_ROLES,
  RIDER_SPECIAL_ABILITIES,
  type RaceRole,
  type RiderSimulationInput,
  type RiderSpecialAbility,
} from "@/lib/game/race-simulation";
import {
  getAuthenticatedTutorialProgress,
  requireAuthenticatedSportingDirectorId,
} from "@/lib/tutorial/progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCurrentTeamHealthOverview,
} from "@/services/team-health";
import {
  getTeamAmateurIdentityForAuthUser,
} from "@/services/team-amateur-identity";
import {
  getActiveTeamSponsorIdentityForAuthUser,
} from "@/services/team-sponsor-identity";
type TutorialRosterRow = {
  rider_id: string;
  first_name: string;
  last_name: string;
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

type RiderSpecialAbilityRow = {
  rider_id: string;
  ability_code: string;
};

export async function registerCriteriumDiscoveryRosterAction(
  formData: FormData,
): Promise<never> {
  const riderIds = formData
    .getAll("riderIds")
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        isUuid(value),
    );

  const submittedRoles =
    readSubmittedRoles(formData);

  const roster: CriteriumDiscoveryRosterEntry[] =
    riderIds.map((riderId) => ({
      riderId,
      role:
        submittedRoles.get(riderId) ??
        "auto",
    }));

  if (
    !isValidCriteriumDiscoveryRoster(
      roster,
    )
  ) {
    redirectWithError(
      `Sélectionnez exactement ${CRITERIUM_DISCOVERY_ROSTER_SIZE} coureurs différents, avec au maximum un leader et un sprinteur.`,
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const sportingDirectorId =
    await requireAuthenticatedSportingDirectorId(
      supabase,
    );

  const [
    rosterResult,
    healthOverview,
    sponsorIdentity,
    amateurIdentity,
  ] = await Promise.all([
    supabase.rpc(
      "get_current_team_roster_with_potential",
    ),
    getCurrentTeamHealthOverview(
      user.id,
    ),
    getActiveTeamSponsorIdentityForAuthUser(
      user.id,
    ).catch(() => null),
    getTeamAmateurIdentityForAuthUser(
      user.id,
    ).catch(() => null),
  ]);

  if (rosterResult.error) {
    redirectWithError(
      `Votre effectif n’a pas pu être chargé : ${rosterResult.error.message}`,
    );
  }

  if (!healthOverview) {
    redirectWithError(
      "Fondez votre équipe amateur avant de vous inscrire au Critérium de la découverte.",
    );
  }

  const rosterRows =
    (rosterResult.data ??
      []) as TutorialRosterRow[];

  const rowById = new Map(
    rosterRows.map((rider) => [
      rider.rider_id,
      rider,
    ]),
  );

  const healthById = new Map(
    healthOverview.riders.map(
      (rider) => [rider.id, rider],
    ),
  );

  const selectedRows =
    roster.map((entry) => {
      const rider =
        rowById.get(entry.riderId);

      if (!rider) {
        redirectWithError(
          "La sélection contient un coureur qui n’appartient plus à votre effectif.",
        );
      }

      const health =
        healthById.get(entry.riderId);

      if (
        health?.injury ||
        health?.formCamp
      ) {
        redirectWithError(
          `${rider.first_name} ${rider.last_name} est indisponible et ne peut pas être inscrit.`,
        );
      }

      return {
        entry,
        rider,
        form: health?.form ?? 75,
      };
    });

  const abilitiesResult =
    await supabase
      .from("rider_special_abilities")
      .select(
        "rider_id, ability_code",
      )
      .in("rider_id", riderIds)
      .returns<RiderSpecialAbilityRow[]>();

  if (abilitiesResult.error) {
    redirectWithError(
      `Les capacités spéciales de votre sélection n’ont pas pu être chargées : ${abilitiesResult.error.message}`,
    );
  }

  const abilitiesByRiderId =
    groupSpecialAbilities(
      abilitiesResult.data ?? [],
    );

  const teamPrimaryColor =
    sponsorIdentity?.sponsor.colors
      .primary ??
    amateurIdentity?.jersey
      .primaryColor ??
    "#176951";

  const teamSecondaryColor =
    sponsorIdentity?.sponsor.colors
      .secondary ??
    amateurIdentity?.jersey
      .secondaryColor ??
    "#F2C94C";

  const playerRiders: RiderSimulationInput[] =
    selectedRows.map(
      ({
        entry,
        rider,
        form,
      }) => {
        const specialAbilities =
          abilitiesByRiderId.get(
            rider.rider_id,
          ) ?? [];

        return {
          id: rider.rider_id,
          name: `${rider.first_name} ${rider.last_name}`.trim(),
          teamId:
            healthOverview.teamId,
          teamName:
            healthOverview.teamName,
          teamPrimaryColor,
          teamSecondaryColor,
          countryCode:
            rider.country_iso_alpha2,
          age: Number(rider.age),
          form: Number(form),
          role: entry.role,
          specialAbility:
            specialAbilities[0] ??
            null,
          specialAbilities,
          ratings: {
            mountain: Number(
              rider.mountain,
            ),
            hills: Number(
              rider.hills,
            ),
            flat: Number(
              rider.flat,
            ),
            timeTrial: Number(
              rider.time_trial,
            ),
            cobbles: Number(
              rider.cobbles,
            ),
            sprint: Number(
              rider.sprint,
            ),
            acceleration: Number(
              rider.acceleration,
            ),
            downhill: Number(
              rider.downhill,
            ),
            endurance: Number(
              rider.endurance,
            ),
            resistance: Number(
              rider.resistance,
            ),
            recovery: Number(
              rider.recovery,
            ),
            breakaway: Number(
              rider.breakaway,
            ),
            prologue: Number(
              rider.prologue,
            ),
          },
        };
      },
    );

  const registeredAt =
    new Date().toISOString();

  const run =
    createCriteriumDiscoveryRun({
      dayNumber:
        healthOverview.currentDayNumber,
      roster,
      playerRiders,
      registeredAt,
    });

  const existingProgress =
    await getAuthenticatedTutorialProgress(
      supabase,
      CRITERIUM_DISCOVERY_KEY,
    );

  const remainsCompleted =
    existingProgress?.status ===
    "completed";

  if (remainsCompleted) {
    run.completedAt =
      existingProgress.completed_at ??
      registeredAt;
  }

  const metadata = {
    ...(existingProgress?.metadata ??
      {}),
    criteriumDiscoveryRun: run,
  };

  if (!existingProgress) {
    const { error } = await supabase
      .from("tutorial_progress")
      .insert({
        sporting_director_id:
          sportingDirectorId,
        tutorial_key:
          CRITERIUM_DISCOVERY_KEY,
        tutorial_type:
          "race_scenario",
        tutorial_version:
          CRITERIUM_DISCOVERY_VERSION,
        status: "in_progress",
        current_step_key:
          CRITERIUM_DISCOVERY_REGISTRATION_STEP_KEY,
        current_route:
          "/jeu/calendrier",
        started_at: registeredAt,
        metadata,
      });

    if (error) {
      redirectWithError(
        `L’inscription n’a pas pu être enregistrée : ${error.message}`,
      );
    }
  } else {
    const { error } = await supabase
      .from("tutorial_progress")
      .update({
        tutorial_type:
          "race_scenario",
        tutorial_version:
          CRITERIUM_DISCOVERY_VERSION,
        status: remainsCompleted
          ? "completed"
          : "in_progress",
        current_step_key:
          CRITERIUM_DISCOVERY_REGISTRATION_STEP_KEY,
        current_route:
          "/jeu/calendrier",
        started_at:
          existingProgress.started_at ??
          registeredAt,
        completed_at:
          remainsCompleted
            ? existingProgress.completed_at ??
              registeredAt
            : null,
        skipped_at: null,
        metadata,
      })
      .eq("id", existingProgress.id);

    if (error) {
      redirectWithError(
        `La nouvelle sélection n’a pas pu être enregistrée : ${error.message}`,
      );
    }
  }

  revalidateCriteriumPaths();

  redirect(
    `/jeu/calendrier?inscription=confirmee&course=${encodeURIComponent(
      "criterium-de-la-decouverte",
    )}`,
  );
}

function readSubmittedRoles(
  formData: FormData,
): Map<string, RaceRole> {
  const roles = new Map<
    string,
    RaceRole
  >();

  for (const value of formData.getAll(
    "riderRoles",
  )) {
    if (typeof value !== "string") {
      continue;
    }

    const separatorIndex =
      value.indexOf(":");

    if (separatorIndex < 1) {
      continue;
    }

    const riderId = value.slice(
      0,
      separatorIndex,
    );

    const role = value.slice(
      separatorIndex + 1,
    );

    if (
      isUuid(riderId) &&
      RACE_ROLES.includes(
        role as RaceRole,
      )
    ) {
      roles.set(
        riderId,
        role as RaceRole,
      );
    }
  }

  return roles;
}

function groupSpecialAbilities(
  rows: RiderSpecialAbilityRow[],
): Map<
  string,
  RiderSpecialAbility[]
> {
  const result = new Map<
    string,
    RiderSpecialAbility[]
  >();

  for (const row of rows) {
    if (
      !RIDER_SPECIAL_ABILITIES.includes(
        row.ability_code as RiderSpecialAbility,
      )
    ) {
      continue;
    }

    const abilities =
      result.get(row.rider_id) ??
      [];

    const ability =
      row.ability_code as RiderSpecialAbility;

    if (
      !abilities.includes(ability)
    ) {
      abilities.push(ability);
    }

    result.set(
      row.rider_id,
      abilities,
    );
  }

  return result;
}

function revalidateCriteriumPaths(): void {
  revalidatePath(
    CRITERIUM_DISCOVERY_RACE_ROUTE,
  );
  revalidatePath(
    CRITERIUM_DISCOVERY_RESULTS_ROUTE,
  );
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/resultats");
}

function redirectWithError(
  message: string,
): never {
  redirect(
    `${CRITERIUM_DISCOVERY_RACE_ROUTE}?erreur=${encodeURIComponent(
      message.slice(0, 300),
    )}`,
  );
}

function isUuid(
  value: string,
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
