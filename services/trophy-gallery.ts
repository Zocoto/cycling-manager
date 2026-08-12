import "server-only";

import {
  getUnlockedReferralTrophies,
  type ReferralTrophyMilestone,
} from "@/lib/game/referrals";

import {
  ALPHA_TESTER_TROPHY_DEFINITION,
  ALPHA_TESTER_TROPHY_KEY,
  buildTrophyGallery,
  type ClaimableTrophyReward,
  type TrophyGallery,
  type TrophyRaceWin,
  type TrophyRiderUciTitle,
  type TrophyAttendance,
  type TrophySpecialAward,
  type TrophyTeamUciTitle,
} from "@/lib/game/trophy-gallery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  collectChunkedPaginatedRows,
  collectPaginatedRows,
} from "@/lib/supabase/pagination";

type QueryError = { message: string };

type SportingDirectorRow = {
  id: string;
};

type TrophyEntitlementRow = {
  id: string;
  trophy_key: string;
  available_at: string;
  claimed_at: string | null;
};

export type SportingDirectorTrophyRewardStatus = {
  availableCount: number;
  alphaTesterAvailable: boolean;
};

type AssignmentRow = {
  team_id: string;
  start_season_id: string;
  end_season_id: string | null;
};

type SeasonRow = {
  id: string;
  game_year: number;
  name: string;
  status: string;
};

type TeamSeasonRow = {
  id: string;
  team_id: string;
  season_id: string;
  display_name: string;
  final_rank: number | null;
  status: string;
};

type RaceRegistrationRow = {
  id: string;
  team_season_id: string | null;
};

type RaceRosterRow = {
  id: string;
  race_registration_id: string;
  rider_id: string;
};

type RaceResultRow = {
  id: string;
  race_edition_id: string;
  race_roster_id: string;
  created_at: string;
};

type RaceEditionRow = {
  id: string;
  race_id: string;
  season_id: string;
  display_name: string;
  status: string;
};

type RaceRow = {
  id: string;
  slug: string;
  is_monument: boolean;
  is_grand_tour: boolean;
  competition_type: string;
};

type RiderSummaryRow = {
  id: string;
  rider_id: string;
  season_id: string;
};

type RiderContractRow = {
  rider_id: string;
  team_id: string;
  start_season_id: string;
  end_season_id: string;
};

type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type AttendanceTrophyRow = {
  id: string;
  season_id: string;
  awarded_at: string;
};

const EMPTY_GALLERY = buildTrophyGallery({
  raceWins: [],
  teamUciTitles: [],
  riderUciTitles: [],
});

export async function getSportingDirectorTrophyGallery(
  authUserId: string
): Promise<TrophyGallery> {
  const normalizedAuthUserId = authUserId.trim();

  if (!normalizedAuthUserId) {
    return EMPTY_GALLERY;
  }

  const admin = createSupabaseAdminClient();
  const directorResult = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", normalizedAuthUserId)
    .maybeSingle<SportingDirectorRow>();

  assertQuery(directorResult.error, "le Directeur Sportif");

  if (!directorResult.data) {
    return EMPTY_GALLERY;
  }

  return loadSportingDirectorTrophyGallery({
    directorId: directorResult.data.id,
    includeClaimable: true,
  });
}

export async function getPublicSportingDirectorTrophyGallery(
  sportingDirectorId: string
): Promise<TrophyGallery> {
  const normalizedDirectorId = sportingDirectorId.trim();

  if (!isUuid(normalizedDirectorId)) {
    return EMPTY_GALLERY;
  }

  return loadSportingDirectorTrophyGallery({
    directorId: normalizedDirectorId,
    includeClaimable: false,
  });
}

export async function getSportingDirectorTrophyRewardStatus(
  authUserId: string
): Promise<SportingDirectorTrophyRewardStatus> {
  const normalizedAuthUserId = authUserId.trim();

  if (!normalizedAuthUserId) {
    return { availableCount: 0, alphaTesterAvailable: false };
  }

  const admin = createSupabaseAdminClient();
  const directorResult = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", normalizedAuthUserId)
    .eq("status", "active")
    .maybeSingle<SportingDirectorRow>();

  assertQuery(directorResult.error, "le Directeur Sportif");

  if (!directorResult.data) {
    return { availableCount: 0, alphaTesterAvailable: false };
  }

  const rewardsResult = await admin
    .from("sporting_director_trophies")
    .select("trophy_key")
    .eq("sporting_director_id", directorResult.data.id)
    .is("claimed_at", null)
    .returns<Array<{ trophy_key: string }>>();

  assertQuery(rewardsResult.error, "les trophées à récupérer");

  const rewards = rewardsResult.data ?? [];

  return {
    availableCount: rewards.length,
    alphaTesterAvailable: rewards.some(
      (reward) => reward.trophy_key === ALPHA_TESTER_TROPHY_KEY
    ),
  };
}

async function loadSportingDirectorTrophyGallery({
  directorId,
  includeClaimable,
}: {
  directorId: string;
  includeClaimable: boolean;
}): Promise<TrophyGallery> {
  const admin = createSupabaseAdminClient();
  const [entitlementsResult, assignmentsResult, seasonsResult] =
    await Promise.all([
      admin
        .from("sporting_director_trophies")
        .select("id, trophy_key, available_at, claimed_at")
        .eq("sporting_director_id", directorId)
        .order("available_at", { ascending: true })
        .returns<TrophyEntitlementRow[]>(),
      collectPaginatedRows<AssignmentRow, QueryError>({
        fetchPage: async (from, to) => {
          const result = await admin
            .from("team_manager_assignments")
            .select("team_id, start_season_id, end_season_id")
            .eq("sporting_director_id", directorId)
            .eq("role", "general_manager")
            .in("status", ["active", "completed", "terminated"])
            .order("created_at", { ascending: true })
            .range(from, to)
            .returns<AssignmentRow[]>();

          return { data: result.data, error: result.error };
        },
      }),
      collectPaginatedRows<SeasonRow, QueryError>({
        fetchPage: async (from, to) => {
          const result = await admin
            .from("seasons")
            .select("id, game_year, name, status")
            .order("game_year", { ascending: true })
            .range(from, to)
            .returns<SeasonRow[]>();

          return { data: result.data, error: result.error };
        },
      }),
    ]);

  assertQuery(entitlementsResult.error, "les distinctions de carrière");
  assertQuery(assignmentsResult.error, "l’historique des équipes");
  assertQuery(seasonsResult.error, "l’historique des saisons");

  const { specialAwards, claimableTrophies } = mapSpecialTrophies({
    entitlements: entitlementsResult.data ?? [],
    includeClaimable,
  });
  const assignments = assignmentsResult.data;
  const seasons = seasonsResult.data;
  const teamIds = unique(assignments.map((assignment) => assignment.team_id));
  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const [attendanceTrophies, referralTrophies] = await Promise.all([
    loadAttendanceTrophies({
      admin,
      directorId,
      seasonById,
    }),
    loadReferralTrophies({ admin, directorId }),
  ]);

  if (teamIds.length === 0 || seasons.length === 0) {
    return buildTrophyGallery({
      raceWins: [],
      teamUciTitles: [],
      riderUciTitles: [],
      specialAwards,
      claimableTrophies,
      attendanceTrophies,
      referralTrophies,
    });
  }

  const teamSeasonsResult = await collectChunkedPaginatedRows<
    TeamSeasonRow,
    QueryError,
    string
  >({
    values: teamIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("team_seasons")
        .select(
          "id, team_id, season_id, display_name, final_rank, status"
        )
        .in("team_id", chunk)
        .order("created_at", { ascending: true })
        .range(from, to)
        .returns<TeamSeasonRow[]>();

      return { data: result.data, error: result.error };
    },
  });

  assertQuery(teamSeasonsResult.error, "les saisons des équipes");

  const managedTeamSeasons = teamSeasonsResult.data.filter((teamSeason) =>
    wasManagedDuringSeason({
      teamId: teamSeason.team_id,
      seasonId: teamSeason.season_id,
      assignments,
      seasonById,
    })
  );
  const managedTeamSeasonIds = managedTeamSeasons.map(
    (teamSeason) => teamSeason.id
  );
  const completedSeasonIds = unique(
    managedTeamSeasons.flatMap((teamSeason) => {
      const season = seasonById.get(teamSeason.season_id);
      return season?.status === "completed" && teamSeason.status === "completed"
        ? [teamSeason.season_id]
        : [];
    })
  );

  const [raceWins, riderUciTitles] = await Promise.all([
    loadMajorRaceWins({
      admin,
      teamSeasonIds: managedTeamSeasonIds,
      seasonById,
    }),
    loadRiderUciTitles({
      admin,
      teamIds,
      completedSeasonIds,
      assignments,
      seasonById,
    }),
  ]);

  const teamUciTitles = managedTeamSeasons.flatMap((teamSeason) => {
    const season = seasonById.get(teamSeason.season_id);

    if (
      teamSeason.final_rank !== 1 ||
      teamSeason.status !== "completed" ||
      season?.status !== "completed"
    ) {
      return [];
    }

    return [
      {
        id: teamSeason.id,
        seasonName: season.name,
        teamName: teamSeason.display_name,
      } satisfies TrophyTeamUciTitle,
    ];
  });

  return buildTrophyGallery({
    raceWins,
    teamUciTitles,
    riderUciTitles,
    specialAwards,
    claimableTrophies,
    attendanceTrophies,
    referralTrophies,
  });
}

async function loadReferralTrophies({
  admin,
  directorId,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  directorId: string;
}): Promise<ReferralTrophyMilestone[]> {
  const result = await admin
    .from("sporting_director_referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_director_id", directorId)
    .eq("status", "qualified");

  assertQuery(result.error, "les trophées de parrainage");

  return getUnlockedReferralTrophies(result.count ?? 0);
}

async function loadAttendanceTrophies({
  admin,
  directorId,
  seasonById,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  directorId: string;
  seasonById: Map<string, SeasonRow>;
}): Promise<TrophyAttendance[]> {
  const result = await admin
    .from("sporting_director_attendance_trophies")
    .select("id, season_id, awarded_at")
    .eq("sporting_director_id", directorId)
    .order("awarded_at", { ascending: true })
    .returns<AttendanceTrophyRow[]>();

  assertQuery(result.error, "les trophées d’assiduité");

  return (result.data ?? []).flatMap((trophy) => {
    const season = seasonById.get(trophy.season_id);
    return season
      ? [{ id: trophy.id, seasonName: season.name, awardedAt: trophy.awarded_at } satisfies TrophyAttendance]
      : [];
  });
}

function mapSpecialTrophies({
  entitlements,
  includeClaimable,
}: {
  entitlements: TrophyEntitlementRow[];
  includeClaimable: boolean;
}): {
  specialAwards: TrophySpecialAward[];
  claimableTrophies: ClaimableTrophyReward[];
} {
  const alphaTesterEntitlements = entitlements.filter(
    (entitlement) => entitlement.trophy_key === ALPHA_TESTER_TROPHY_KEY
  );

  return {
    specialAwards: alphaTesterEntitlements.flatMap((entitlement) =>
      entitlement.claimed_at
        ? [
            {
              id: entitlement.id,
              trophyKey: ALPHA_TESTER_TROPHY_KEY,
              availableAt: entitlement.available_at,
              claimedAt: entitlement.claimed_at,
              href: includeClaimable
                ? "/jeu/directeur-sportif#distinction-avatar"
                : null,
            },
          ]
        : []
    ),
    claimableTrophies: includeClaimable
      ? alphaTesterEntitlements.flatMap((entitlement) =>
          entitlement.claimed_at
            ? []
            : [
                {
                  key: ALPHA_TESTER_TROPHY_KEY,
                  availableAt: entitlement.available_at,
                  title: ALPHA_TESTER_TROPHY_DEFINITION.title,
                  description: ALPHA_TESTER_TROPHY_DEFINITION.description,
                  avatarFrameKey:
                    ALPHA_TESTER_TROPHY_DEFINITION.avatarFrameKey,
                  palette: ALPHA_TESTER_TROPHY_DEFINITION.palette,
                },
              ]
        )
      : [],
  };
}

async function loadMajorRaceWins({
  admin,
  teamSeasonIds,
  seasonById,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  teamSeasonIds: string[];
  seasonById: Map<string, SeasonRow>;
}): Promise<TrophyRaceWin[]> {
  const registrationsResult = await collectChunkedPaginatedRows<
    RaceRegistrationRow,
    QueryError,
    string
  >({
    values: teamSeasonIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("race_registrations")
        .select("id, team_season_id")
        .in("team_season_id", chunk)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<RaceRegistrationRow[]>();

      return { data: result.data, error: result.error };
    },
  });

  assertQuery(registrationsResult.error, "les inscriptions historiques");

  const registrationIds = registrationsResult.data.map(
    (registration) => registration.id
  );
  const rostersResult = await collectChunkedPaginatedRows<
    RaceRosterRow,
    QueryError,
    string
  >({
    values: registrationIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("race_rosters")
        .select("id, race_registration_id, rider_id")
        .in("race_registration_id", chunk)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<RaceRosterRow[]>();

      return { data: result.data, error: result.error };
    },
  });

  assertQuery(rostersResult.error, "les coureurs inscrits historiquement");

  const rosterIds = rostersResult.data.map((roster) => roster.id);
  const resultsQuery = await collectChunkedPaginatedRows<
    RaceResultRow,
    QueryError,
    string
  >({
    values: rosterIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("race_results")
        .select("id, race_edition_id, race_roster_id, created_at")
        .in("race_roster_id", chunk)
        .eq("status", "classified")
        .eq("final_rank", 1)
        .order("created_at", { ascending: false })
        .range(from, to)
        .returns<RaceResultRow[]>();

      return { data: result.data, error: result.error };
    },
  });

  assertQuery(resultsQuery.error, "les victoires historiques");

  const results = resultsQuery.data;

  if (results.length === 0) {
    return [];
  }

  const editionIds = unique(results.map((result) => result.race_edition_id));
  const editionsResult = await collectChunkedPaginatedRows<
    RaceEditionRow,
    QueryError,
    string
  >({
    values: editionIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("race_editions")
        .select("id, race_id, season_id, display_name, status")
        .in("id", chunk)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<RaceEditionRow[]>();

      return { data: result.data, error: result.error };
    },
  });

  assertQuery(editionsResult.error, "les éditions victorieuses");

  const raceIds = unique(
    editionsResult.data.map((edition) => edition.race_id)
  );
  const winnerRosterIds = unique(
    results.map((result) => result.race_roster_id)
  );
  const riderIds = unique(
    rostersResult.data
      .filter((roster) => winnerRosterIds.includes(roster.id))
      .map((roster) => roster.rider_id)
  );
  const [racesResult, ridersResult] = await Promise.all([
    collectChunkedPaginatedRows<RaceRow, QueryError, string>({
      values: raceIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("races")
          .select("id, slug, is_monument, is_grand_tour, competition_type")
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RaceRow[]>();

        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<RiderRow, QueryError, string>({
      values: riderIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("riders")
          .select("id, first_name, last_name")
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RiderRow[]>();

        return { data: result.data, error: result.error };
      },
    }),
  ]);

  assertQuery(racesResult.error, "les courses majeures");
  assertQuery(ridersResult.error, "les vainqueurs des trophées");

  const editionById = new Map(
    editionsResult.data.map((edition) => [edition.id, edition])
  );
  const raceById = new Map(racesResult.data.map((race) => [race.id, race]));
  const rosterById = new Map(
    rostersResult.data.map((roster) => [roster.id, roster])
  );
  const riderById = new Map(ridersResult.data.map((rider) => [rider.id, rider]));

  return results.flatMap((result) => {
    const edition = editionById.get(result.race_edition_id);
    const race = edition ? raceById.get(edition.race_id) : null;
    const roster = rosterById.get(result.race_roster_id);
    const rider = roster ? riderById.get(roster.rider_id) : null;
    const season = edition ? seasonById.get(edition.season_id) : null;
    const competitionType =
      race?.competition_type === "world_championship" ||
      race?.competition_type === "continental_championship"
        ? race.competition_type
        : "standard";

    if (
      !edition ||
      edition.status !== "completed" ||
      !race ||
      (!race.is_grand_tour &&
        !race.is_monument &&
        competitionType === "standard") ||
      !rider ||
      !season
    ) {
      return [];
    }

    return [
      {
        id: result.id,
        raceSlug: race.slug,
        raceName: edition.display_name,
        seasonName: season.name,
        wonAt: result.created_at,
        riderName: `${rider.first_name} ${rider.last_name}`.trim(),
        isGrandTour: race.is_grand_tour,
        isMonument: race.is_monument,
        competitionType,
      } satisfies TrophyRaceWin,
    ];
  });
}

async function loadRiderUciTitles({
  admin,
  teamIds,
  completedSeasonIds,
  assignments,
  seasonById,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  teamIds: string[];
  completedSeasonIds: string[];
  assignments: AssignmentRow[];
  seasonById: Map<string, SeasonRow>;
}): Promise<TrophyRiderUciTitle[]> {
  const [summariesResult, contractsResult] = await Promise.all([
    collectChunkedPaginatedRows<RiderSummaryRow, QueryError, string>({
      values: completedSeasonIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("rider_season_summaries")
          .select("id, rider_id, season_id")
          .in("season_id", chunk)
          .eq("uci_rank", 1)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RiderSummaryRow[]>();

        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<RiderContractRow, QueryError, string>({
      values: teamIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("rider_contracts")
          .select(
            "rider_id, team_id, start_season_id, end_season_id"
          )
          .in("team_id", chunk)
          .in("status", ["active", "completed", "terminated"])
          .order("created_at", { ascending: true })
          .range(from, to)
          .returns<RiderContractRow[]>();

        return { data: result.data, error: result.error };
      },
    }),
  ]);

  assertQuery(summariesResult.error, "les numéros un mondiaux");
  assertQuery(contractsResult.error, "les contrats historiques des champions");

  const eligibleSummaries = summariesResult.data.filter((summary) =>
    contractsResult.data.some(
      (contract) =>
        contract.rider_id === summary.rider_id &&
        coversSeason(contract, summary.season_id, seasonById) &&
        wasManagedDuringSeason({
          teamId: contract.team_id,
          seasonId: summary.season_id,
          assignments,
          seasonById,
        })
    )
  );

  const ridersResult = await collectChunkedPaginatedRows<
    RiderRow,
    QueryError,
    string
  >({
    values: unique(eligibleSummaries.map((summary) => summary.rider_id)),
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("riders")
        .select("id, first_name, last_name")
        .in("id", chunk)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<RiderRow[]>();

      return { data: result.data, error: result.error };
    },
  });

  assertQuery(ridersResult.error, "l’identité des numéros un mondiaux");

  const riderById = new Map(ridersResult.data.map((rider) => [rider.id, rider]));

  return eligibleSummaries.flatMap((summary) => {
    const rider = riderById.get(summary.rider_id);
    const season = seasonById.get(summary.season_id);

    if (!rider || !season) {
      return [];
    }

    return [
      {
        id: summary.id,
        seasonName: season.name,
        riderName: `${rider.first_name} ${rider.last_name}`.trim(),
      } satisfies TrophyRiderUciTitle,
    ];
  });
}

function wasManagedDuringSeason({
  teamId,
  seasonId,
  assignments,
  seasonById,
}: {
  teamId: string;
  seasonId: string;
  assignments: AssignmentRow[];
  seasonById: Map<string, SeasonRow>;
}) {
  const seasonYear = seasonById.get(seasonId)?.game_year;

  if (seasonYear === undefined) {
    return false;
  }

  return assignments.some((assignment) => {
    if (assignment.team_id !== teamId) {
      return false;
    }

    const startYear = seasonById.get(assignment.start_season_id)?.game_year;
    const endYear = assignment.end_season_id
      ? seasonById.get(assignment.end_season_id)?.game_year
      : null;

    return (
      startYear !== undefined &&
      seasonYear >= startYear &&
      (endYear === null || endYear === undefined || seasonYear <= endYear)
    );
  });
}

function coversSeason(
  contract: RiderContractRow,
  seasonId: string,
  seasonById: Map<string, SeasonRow>
) {
  const seasonYear = seasonById.get(seasonId)?.game_year;
  const startYear = seasonById.get(contract.start_season_id)?.game_year;
  const endYear = seasonById.get(contract.end_season_id)?.game_year;

  return (
    seasonYear !== undefined &&
    startYear !== undefined &&
    endYear !== undefined &&
    seasonYear >= startYear &&
    seasonYear <= endYear
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function assertQuery(error: QueryError | null, context: string) {
  if (error) {
    throw new Error(`Impossible de charger ${context} : ${error.message}`);
  }
}
