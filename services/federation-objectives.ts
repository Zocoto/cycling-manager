import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFederationSeasonObjectiveVariants } from "@/lib/game/federation-objectives";
import { getUciRankings } from "@/services/uci-rankings";

export type FederationObjectiveMetrics = {
  referenceMemberTeamCount: number;
  naturalizationCount: number;
  manuallySubmittedSelectionCount: number;
  nationsCupRank: number | null;
  nationsCupOverallRank: number | null;
  nationsCupDivision: number | null;
  nationsCupGroup: string | null;
  nationsCupPoolSize: number;
  nationsCupPoints: number;
  nationsCupEvents: number;
  juniorChampionshipRank: number | null;
  cyclingSchoolCount: number;
  teamUciRank: number | null;
  riderUciRank: number | null;
};

type SeasonRow = { id: string };
type NationsCupStandingRow = {
  country_id: string;
  division: number;
  group_code: string | null;
  points: number;
  events_count: number;
  overall_rank: number;
  division_rank: number;
  group_rank: number;
};

export async function getFederationObjectiveMetrics({
  countryId,
  seasonId,
  gameYear,
  currentMemberTeamCount,
  countryCode,
  memberTeamIds,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
  currentMemberTeamCount: number;
  countryCode: string;
  memberTeamIds: string[];
}): Promise<FederationObjectiveMetrics> {
  const fallback: FederationObjectiveMetrics = {
    referenceMemberTeamCount: currentMemberTeamCount,
    naturalizationCount: 0,
    manuallySubmittedSelectionCount: 0,
    nationsCupRank: null,
    nationsCupOverallRank: null,
    nationsCupDivision: null,
    nationsCupGroup: null,
    nationsCupPoolSize: 0,
    nationsCupPoints: 0,
    nationsCupEvents: 0,
    juniorChampionshipRank: null,
    cyclingSchoolCount: 0,
    teamUciRank: null,
    riderUciRank: null,
  };

  try {
    const admin = createSupabaseAdminClient();
    const referenceSeason =
      gameYear <= 1
        ? { data: { id: seasonId } as SeasonRow, error: null }
        : await admin
            .from("seasons")
            .select("id")
            .eq("game_year", gameYear - 1)
            .maybeSingle<SeasonRow>();
    if (referenceSeason.error) {
      console.error("Impossible de charger la saison de référence fédérale :", referenceSeason.error);
    }

    const referenceSeasonId = referenceSeason.data?.id ?? seasonId;
    const [memberTeams, naturalizations, publishedSelections, nationsCup] =
      await Promise.all([
        admin
          .from("team_seasons")
          .select("team_id", { count: "exact", head: true })
          .eq("season_id", referenceSeasonId)
          .eq("registration_country_id", countryId)
          .in("status", ["planned", "active", "completed"]),
        admin
          .from("rider_naturalizations")
          .select("id", { count: "exact", head: true })
          .eq("season_id", seasonId)
          .eq("to_country_id", countryId),
        admin
          .from("national_federation_selection_lists")
          .select("id", { count: "exact", head: true })
          .eq("country_id", countryId)
          .eq("season_id", seasonId)
          .not("manually_submitted_at", "is", null)
          .in("status", ["pending_confirmation", "finalized"]),
        admin.rpc("get_national_federation_nations_cup_standings", {
          p_season_id: seasonId,
        }),
      ]);

    for (const [label, error] of [
      ["équipes affiliées", memberTeams.error],
      ["naturalisations", naturalizations.error],
      ["convocations manuelles", publishedSelections.error],
      ["Nations Cup", nationsCup.error],
    ] as const) {
      if (error) console.error(`Impossible de charger les ${label} de la fédération :`, error);
    }

    const standings = (nationsCup.data ?? []) as NationsCupStandingRow[];
    const nationsCupStanding = standings.find((entry) => entry.country_id === countryId);
    const hasNationsCupResult = (nationsCupStanding?.events_count ?? 0) > 0;
    const nationsCupPoolSize = nationsCupStanding
      ? standings.filter((entry) =>
          entry.division === nationsCupStanding.division &&
          entry.group_code === nationsCupStanding.group_code
        ).length
      : 0;

    let futureMetrics = {
      juniorChampionshipRank: null as number | null,
      cyclingSchoolCount: 0,
      teamUciRank: null as number | null,
      riderUciRank: null as number | null,
    };
    if (gameYear >= 4) {
      const variants = getFederationSeasonObjectiveVariants(countryId, gameYear);
      const needsSchool = variants.includes("cycling_school");
      const needsJunior = variants.includes("junior_championships");
      const needsUci = variants.includes("team_uci") || variants.includes("rider_uci");
      const [seasonDates, juniorEditions, rankings] = await Promise.all([
        needsSchool
          ? admin.from("seasons").select("starts_on, ends_on").eq("id", seasonId)
              .maybeSingle<{ starts_on: string; ends_on: string }>()
          : Promise.resolve({ data: null, error: null }),
        needsJunior
          ? admin.from("development_race_editions")
              .select("id")
              .eq("season_id", seasonId)
              .eq("status", "completed")
              .in("competition_type", [
                "continental_road", "continental_time_trial", "world_road", "world_time_trial",
              ])
              .returns<Array<{ id: string }>>()
          : Promise.resolve({ data: [], error: null }),
        needsUci ? getUciRankings().catch((error) => {
          console.error("Impossible de charger les classements UCI fédéraux :", error);
          return null;
        }) : Promise.resolve(null),
      ]);

      if (seasonDates.error) console.error("Impossible de dater l’objectif de formation :", seasonDates.error);
      if (juniorEditions.error) console.error("Impossible de charger les championnats juniors :", juniorEditions.error);

      const nextDay = seasonDates.data
        ? new Date(`${seasonDates.data.ends_on}T00:00:00Z`)
        : null;
      nextDay?.setUTCDate(nextDay.getUTCDate() + 1);
      const [schools, juniorResults] = await Promise.all([
        needsSchool && seasonDates.data && memberTeamIds.length > 0 && nextDay
          ? admin.from("international_youth_centers")
              .select("id", { count: "exact", head: true })
              .eq("country_id", countryId)
              .in("team_id", memberTeamIds)
              .gte("completed_at", seasonDates.data.starts_on)
              .lt("completed_at", nextDay.toISOString().slice(0, 10))
          : Promise.resolve({ count: 0, error: null }),
        needsJunior && (juniorEditions.data?.length ?? 0) > 0
          ? admin.from("development_race_results")
              .select("rank")
              .in("race_edition_id", (juniorEditions.data ?? []).map((edition) => edition.id))
              .eq("country_code", countryCode.toUpperCase())
              .eq("result_scope", "general")
              .order("rank", { ascending: true })
              .limit(1)
              .returns<Array<{ rank: number }>>()
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (schools.error) console.error("Impossible de charger les écoles fédérales :", schools.error);
      if (juniorResults.error) console.error("Impossible de charger les résultats juniors :", juniorResults.error);
      const memberTeamIdSet = new Set(memberTeamIds);
      futureMetrics = {
        juniorChampionshipRank: juniorResults.data?.[0]?.rank ?? null,
        cyclingSchoolCount: schools.count ?? 0,
        teamUciRank: rankings?.seasonId === seasonId
          ? (rankings.teams.find((entry) => memberTeamIdSet.has(entry.teamId))?.rank ?? null)
          : null,
        riderUciRank: rankings?.seasonId === seasonId
          ? (rankings.riders.find((entry) => entry.countryCode === countryCode.toUpperCase())?.rank ?? null)
          : null,
      };
    }

    return {
      referenceMemberTeamCount:
        memberTeams.count ?? currentMemberTeamCount,
      naturalizationCount: naturalizations.error ? 0 : (naturalizations.count ?? 0),
      manuallySubmittedSelectionCount: publishedSelections.error
        ? 0
        : (publishedSelections.count ?? 0),
      nationsCupRank: hasNationsCupResult
        ? (nationsCupStanding?.group_code
            ? nationsCupStanding.group_rank
            : nationsCupStanding?.division_rank ?? null)
        : null,
      nationsCupOverallRank: hasNationsCupResult
        ? (nationsCupStanding?.overall_rank ?? null)
        : null,
      nationsCupDivision: nationsCupStanding?.division ?? null,
      nationsCupGroup: nationsCupStanding?.group_code ?? null,
      nationsCupPoolSize,
      nationsCupPoints: nationsCupStanding?.points ?? 0,
      nationsCupEvents: nationsCupStanding?.events_count ?? 0,
      ...futureMetrics,
    };
  } catch (error) {
    console.error("Impossible de charger les objectifs fédéraux :", error);
    return fallback;
  }
}
