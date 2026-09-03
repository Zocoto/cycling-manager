import "server-only";

import { unstable_cache } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationFinanceTeamProfile = {
  teamId: string;
  teamName: string;
  reputationPoints: number;
};

export type FederationFinanceBaseline = {
  source: "season-data" | "unavailable";
  seasonName: string;
  gameYear: number;
  observedThroughDay: number;
  completedRaceDays: number;
  completedRaceEditions: number;
  acceptedTeamEntries: number;
  averageStarters: number;
  teamProfiles: FederationFinanceTeamProfile[];
};

type RaceRow = { id: string };
type EditionRow = { id: string };
type StageRow = { race_edition_id: string };
type RegistrationRow = { id: string };
type AssignmentRow = {
  team_id: string;
  sporting_director_id: string;
};
type DirectorRow = {
  id: string;
  reputation_points: number | string;
};

const getCachedFederationFinanceBaseline = unstable_cache(
  loadFederationFinanceBaseline,
  ["federation-finance-baseline"],
  { revalidate: 60, tags: ["federation-finance-baseline"] },
);

export async function getFederationFinanceBaseline(
  input: Parameters<typeof loadFederationFinanceBaseline>[0],
): Promise<FederationFinanceBaseline> {
  return getCachedFederationFinanceBaseline(input);
}

async function loadFederationFinanceBaseline({
  countryId,
  season,
  teams,
}: {
  countryId: string;
  season: {
    id: string;
    name: string;
    gameYear: number;
    currentDayNumber: number;
  };
  teams: Array<{ id: string; name: string }>;
}): Promise<FederationFinanceBaseline> {
  const fallback = createFallbackBaseline(season, teams);

  try {
    const admin = createSupabaseAdminClient();
    const raceResult = await admin
      .from("races")
      .select("id")
      .eq("country_id", countryId)
      .eq("status", "active")
      .returns<RaceRow[]>();

    if (raceResult.error) throw raceResult.error;
    const raceIds = (raceResult.data ?? []).map((race) => race.id);
    const [teamProfiles, raceActivity] = await Promise.all([
      getFederationTeamProfiles(admin, teams),
      raceIds.length > 0
        ? getFederationRaceActivity(admin, season.id, raceIds)
        : Promise.resolve({
            completedRaceDays: 0,
            completedRaceEditions: 0,
            acceptedTeamEntries: 0,
            averageStarters: 0,
          }),
    ]);

    return {
      source: "season-data",
      seasonName: season.name,
      gameYear: season.gameYear,
      observedThroughDay: season.currentDayNumber,
      ...raceActivity,
      teamProfiles,
    };
  } catch (error) {
    console.error(
      "Impossible de calculer la base financière de la fédération :",
      error,
    );
    return fallback;
  }
}

async function getFederationRaceActivity(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  seasonId: string,
  raceIds: string[],
) {
  const editionsResult = await admin
    .from("race_editions")
    .select("id")
    .eq("season_id", seasonId)
    .in("race_id", raceIds)
    .neq("status", "cancelled")
    .returns<EditionRow[]>();

  if (editionsResult.error) throw editionsResult.error;
  const editionIds = (editionsResult.data ?? []).map((edition) => edition.id);
  if (editionIds.length === 0) {
    return {
      completedRaceDays: 0,
      completedRaceEditions: 0,
      acceptedTeamEntries: 0,
      averageStarters: 0,
    };
  }

  const stagesResult = await admin
    .from("stages")
    .select("race_edition_id")
    .in("race_edition_id", editionIds)
    .eq("status", "completed")
    .returns<StageRow[]>();

  if (stagesResult.error) throw stagesResult.error;
  const stages = stagesResult.data ?? [];
  const completedEditionIds = [...
    new Set(stages.map((stage) => stage.race_edition_id)),
  ];
  if (completedEditionIds.length === 0) {
    return {
      completedRaceDays: 0,
      completedRaceEditions: 0,
      acceptedTeamEntries: 0,
      averageStarters: 0,
    };
  }

  const registrationsResult = await admin
    .from("race_registrations")
    .select("id")
    .in("race_edition_id", completedEditionIds)
    .eq("status", "accepted")
    .returns<RegistrationRow[]>();

  if (registrationsResult.error) throw registrationsResult.error;
  const registrationIds = (registrationsResult.data ?? []).map(
    (registration) => registration.id,
  );
  let rosterCount = 0;

  if (registrationIds.length > 0) {
    const rostersResult = await admin
      .from("race_rosters")
      .select("id", { count: "exact", head: true })
      .in("race_registration_id", registrationIds)
      .in("status", ["selected", "confirmed"]);

    if (rostersResult.error) throw rostersResult.error;
    rosterCount = rostersResult.count ?? 0;
  }

  return {
    completedRaceDays: stages.length,
    completedRaceEditions: completedEditionIds.length,
    acceptedTeamEntries: registrationIds.length,
    averageStarters:
      completedEditionIds.length > 0
        ? Math.round(rosterCount / completedEditionIds.length)
        : 0,
  };
}

async function getFederationTeamProfiles(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  teams: Array<{ id: string; name: string }>,
): Promise<FederationFinanceTeamProfile[]> {
  if (teams.length === 0) return [];

  const assignmentsResult = await admin
    .from("team_manager_assignments")
    .select("team_id, sporting_director_id")
    .in(
      "team_id",
      teams.map((team) => team.id),
    )
    .eq("status", "active")
    .returns<AssignmentRow[]>();

  if (assignmentsResult.error) throw assignmentsResult.error;
  const assignments = assignmentsResult.data ?? [];
  const directorIds = [...
    new Set(assignments.map((assignment) => assignment.sporting_director_id)),
  ];
  const directorsResult =
    directorIds.length > 0
      ? await admin
          .from("sporting_directors")
          .select("id, reputation_points")
          .in("id", directorIds)
          .returns<DirectorRow[]>()
      : { data: [] as DirectorRow[], error: null };

  if (directorsResult.error) throw directorsResult.error;
  const reputationByDirectorId = new Map(
    (directorsResult.data ?? []).map((director) => [
      director.id,
      Number(director.reputation_points ?? 0),
    ]),
  );
  const assignmentByTeamId = new Map(
    assignments.map((assignment) => [assignment.team_id, assignment]),
  );

  return teams.map((team) => {
    const assignment = assignmentByTeamId.get(team.id);
    return {
      teamId: team.id,
      teamName: team.name,
      reputationPoints: assignment
        ? reputationByDirectorId.get(assignment.sporting_director_id) ?? 0
        : 0,
    };
  });
}

function createFallbackBaseline(
  season: {
    name: string;
    gameYear: number;
    currentDayNumber: number;
  },
  teams: Array<{ id: string; name: string }>,
): FederationFinanceBaseline {
  return {
    source: "unavailable",
    seasonName: season.name,
    gameYear: season.gameYear,
    observedThroughDay: season.currentDayNumber,
    completedRaceDays: 0,
    completedRaceEditions: 0,
    acceptedTeamEntries: 0,
    averageStarters: 0,
    teamProfiles: teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      reputationPoints: 0,
    })),
  };
}
