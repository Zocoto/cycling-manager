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

  const seasonsResult = await admin
    .from("rider_history_archive_seasons")
    .select(
      "season_id, season_name, game_year, team_id, team_name, victories, points, uci_rank, national_titles, notable_performances",
    )
    .eq("rider_id", riderId)
    .order("game_year", { ascending: false })
    .returns<ArchiveSeasonRow[]>();
  assertQuery(seasonsResult.error, "l’historique archivé du coureur");

  const reason = isRiderArchiveReason(archive.retirement_reason)
    ? archive.retirement_reason
    : "no_team_and_no_race";
  const history = (seasonsResult.data ?? []).map((season) => ({
    seasonId: season.season_id,
    seasonName: season.season_name,
    gameYear: season.game_year,
    teamId: season.team_id,
    teamName: season.team_name,
    victories: season.victories,
    points: season.points,
    uciRank: season.uci_rank,
    nationalTitles: parseNationalTitles(season.national_titles),
    notablePerformances: parseNotablePerformances(
      season.notable_performances,
    ),
  }));

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
    condition: { form: 75, dayNumber: null },
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
      (candidate.finalRank !== null &&
        typeof candidate.finalRank !== "number")
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