import "server-only";

import {
  RIDER_ARCHIVE_REASON_LABELS,
  isRiderArchiveReason,
} from "@/lib/game/rider-career-archive";
import type { RiderNotablePerformance } from "@/lib/game/rider-notable-performances";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PublicRiderProfile } from "@/services/public-rider-profile";

type ArchiveRow = {
  rider_id: string;
  country_id: string;
  country_name: string;
  country_code: string;
  first_name: string;
  last_name: string;
  avatar_profile_key: string;
  avatar_seed: number | string;
  retirement_season_id: string;
  retirement_season_name: string;
  retirement_game_year: number;
  retirement_age: number | null;
  retirement_reason: string;
  career_race_days: number;
  total_victories: number;
  total_points: number;
  best_uci_rank: number | null;
};

type ArchiveSeasonRow = {
  season_id: string;
  season_name: string;
  game_year: number;
  team_id: string;
  team_name: string;
  victories: number | null;
  points: number | null;
  uci_rank: number | null;
  national_titles: unknown;
  notable_performances: unknown;
};

type ContractHistoryRow = {
  team_id: string;
  start_season_id: string;
  left_season_id: string | null;
  joined_day_number: number;
  left_day_number: number | null;
  transfer_fee: number | string | null;
  currency_code: string;
};

type ArchivedTeamSeasonRow = {
  id: string;
  team_id: string;
  season_id: string;
};

type ArchivedRewardRow = {
  team_season_id: string | null;
  source_reference: string;
  uci_points: number;
  description: string;
};

export async function getArchivedRiderProfile(
  riderId: string,
): Promise<PublicRiderProfile | null> {
  const admin = createSupabaseAdminClient();
  const archiveResult = await admin
    .from("rider_history_archives")
    .select(
      "rider_id, country_id, country_name, country_code, first_name, last_name, avatar_profile_key, avatar_seed, retirement_season_id, retirement_season_name, retirement_game_year, retirement_age, retirement_reason, career_race_days, total_victories, total_points, best_uci_rank",
    )
    .eq("rider_id", riderId)
    .maybeSingle<ArchiveRow>();

  assertQuery(archiveResult.error, "l’archive du coureur");
  const archive = archiveResult.data;
  if (!archive) return null;

  const [seasonsResult, contractsResult] = await Promise.all([
    admin
      .from("rider_history_archive_seasons")
      .select(
        "season_id, season_name, game_year, team_id, team_name, victories, points, uci_rank, national_titles, notable_performances",
      )
      .eq("rider_id", riderId)
      .order("game_year", { ascending: false })
      .returns<ArchiveSeasonRow[]>(),
    admin
      .from("rider_contracts")
      .select(
        "team_id, start_season_id, left_season_id, joined_day_number, left_day_number, transfer_fee, currency_code",
      )
      .eq("rider_id", riderId)
      .returns<ContractHistoryRow[]>(),
  ]);
  assertQuery(seasonsResult.error, "l’historique archivé du coureur");

  const reason = isRiderArchiveReason(archive.retirement_reason)
    ? archive.retirement_reason
    : "no_team_and_no_race";
  assertQuery(contractsResult.error, "les mouvements archivés du coureur");

  const archivedSeasons = seasonsResult.data ?? [];
  const teamIds = [...new Set(archivedSeasons.map((season) => season.team_id))];
  const seasonIds = [
    ...new Set(archivedSeasons.map((season) => season.season_id)),
  ];
  const teamSeasonsResult =
    teamIds.length > 0 && seasonIds.length > 0
      ? await admin
          .from("team_seasons")
          .select("id, team_id, season_id")
          .in("team_id", teamIds)
          .in("season_id", seasonIds)
          .returns<ArchivedTeamSeasonRow[]>()
      : { data: [] as ArchivedTeamSeasonRow[], error: null };
  assertQuery(
    teamSeasonsResult.error,
    "les équipes saisonnières du coureur archivé",
  );

  const archivedTeamSeasons = teamSeasonsResult.data ?? [];
  const rewardResult = archivedTeamSeasons.length
    ? await admin
        .from("reward_events")
        .select("team_season_id, source_reference, uci_points, description")
        .eq("rider_id", riderId)
        .in(
          "team_season_id",
          archivedTeamSeasons.map((season) => season.id),
        )
        .in("source_type", ["race_result", "stage_result"])
        .returns<ArchivedRewardRow[]>()
    : { data: [] as ArchivedRewardRow[], error: null };
  assertQuery(rewardResult.error, "le palmarès archivé par équipe");

  const teamSeasonById = new Map(
    archivedTeamSeasons.map((season) => [season.id, season]),
  );
  const teamCountBySeasonId = new Map<string, Set<string>>();
  for (const season of archivedSeasons) {
    const teams =
      teamCountBySeasonId.get(season.season_id) ?? new Set<string>();
    teams.add(season.team_id);
    teamCountBySeasonId.set(season.season_id, teams);
  }
  const achievementsBySeasonTeam = new Map<
    string,
    { points: number; victoryReferences: Set<string> }
  >();
  for (const reward of rewardResult.data ?? []) {
    const teamSeason = reward.team_season_id
      ? teamSeasonById.get(reward.team_season_id)
      : null;
    if (!teamSeason) continue;
    const key = `${teamSeason.season_id}:${teamSeason.team_id}`;
    const achievements = achievementsBySeasonTeam.get(key) ?? {
      points: 0,
      victoryReferences: new Set<string>(),
    };
    achievements.points += Number(reward.uci_points);
    if (
      /:rank:1(?::|$)/.test(reward.source_reference) ||
      /(?:victoire|1(?:er|e) place)/i.test(reward.description)
    ) {
      achievements.victoryReferences.add(reward.source_reference);
    }
    achievementsBySeasonTeam.set(key, achievements);
  }

  const history = archivedSeasons.map((season) => {
    const startingContract = (contractsResult.data ?? []).find(
      (contract) =>
        contract.team_id === season.team_id &&
        contract.start_season_id === season.season_id,
    );
    const leavingContract = (contractsResult.data ?? []).find(
      (contract) =>
        contract.team_id === season.team_id &&
        contract.left_season_id === season.season_id,
    );
    const hasSeveralTeams =
      (teamCountBySeasonId.get(season.season_id)?.size ?? 0) > 1;
    const achievements = achievementsBySeasonTeam.get(
      `${season.season_id}:${season.team_id}`,
    );

    return {
      seasonId: season.season_id,
      seasonName: season.season_name,
      gameYear: season.game_year,
      teamId: season.team_id,
      teamName: season.team_name,
      transferFee:
        startingContract?.transfer_fee !== null &&
        startingContract?.transfer_fee !== undefined
          ? Number(startingContract.transfer_fee)
          : null,
      currencyCode: startingContract?.currency_code ?? "EUR",
      joinedDayNumber: startingContract?.joined_day_number ?? null,
      leftDayNumber: leavingContract?.left_day_number ?? null,
      victories: hasSeveralTeams
        ? (achievements?.victoryReferences.size ?? 0)
        : season.victories,
      points: hasSeveralTeams ? (achievements?.points ?? 0) : season.points,
      uciRank: season.uci_rank,
      nationalTitles: parseNationalTitles(season.national_titles),
      notablePerformances: parseNotablePerformances(
        season.notable_performances,
      ),
      careerLevel: "professional" as const,
      juniorRaceCount: null,
      juniorPodiums: null,
    };
  });

  return {
    id: archive.rider_id,
    firstName: archive.first_name,
    lastName: archive.last_name,
    status: "retired",
    country: {
      id: archive.country_id,
      name: archive.country_name,
      code: archive.country_code,
    },
    avatarProfileKey: archive.avatar_profile_key,
    avatarSeed: archive.avatar_seed,
    activeSeason: null,
    age: archive.retirement_age,
    careerRaceDays: archive.career_race_days,
    potentialSteps: null,
    ratings: null,
    scoutingReport: null,
    condition: { form: 75, dayNumber: null, events: [] },
    medical: null,
    currentTeam: null,
    nationalTitles: history.flatMap((season) =>
      season.nationalTitles.map((title) => ({
        ...title,
        seasonId: season.seasonId,
        seasonName: season.seasonName,
        isActive: false,
      })),
    ),
    history,
    specialAbilities: [],
    equipment: {},
    privateContract: null,
    canManage: false,
    archive: {
      retirementSeasonId: archive.retirement_season_id,
      retirementSeasonName: archive.retirement_season_name,
      retirementGameYear: archive.retirement_game_year,
      retirementAge: archive.retirement_age,
      reason,
      reasonLabel: RIDER_ARCHIVE_REASON_LABELS[reason],
      totalVictories: archive.total_victories,
      totalPoints: archive.total_points,
      bestUciRank: archive.best_uci_rank,
    },
  };
}

function parseNationalTitles(
  value: unknown,
): PublicRiderProfile["history"][number]["nationalTitles"] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const type = candidate.type;
    const countryName = candidate.countryName;
    const countryCode = candidate.countryCode;
    if (
      (type !== "road" && type !== "time_trial") ||
      typeof countryName !== "string" ||
      typeof countryCode !== "string"
    ) {
      return [];
    }
    return [{ type, countryName, countryCode }];
  });
}

function parseNotablePerformances(value: unknown): RiderNotablePerformance[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    if (
      typeof candidate.raceEditionId !== "string" ||
      typeof candidate.raceName !== "string" ||
      typeof candidate.uciPoints !== "number" ||
      !Array.isArray(candidate.labels) ||
      !candidate.labels.every((label) => typeof label === "string") ||
      (candidate.finalRank !== null && typeof candidate.finalRank !== "number")
    ) {
      return [];
    }

    return [
      {
        raceEditionId: candidate.raceEditionId,
        raceName: candidate.raceName,
        uciPoints: candidate.uciPoints,
        labels: candidate.labels,
        finalRank: candidate.finalRank,
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
