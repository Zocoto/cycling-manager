import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationObjectiveMetrics = {
  referenceMemberTeamCount: number;
  naturalizationCount: number;
  manuallySubmittedSelectionCount: number;
  nationsCupRank: number | null;
  nationsCupDivision: number | null;
  nationsCupGroup: string | null;
  nationsCupPoints: number;
  nationsCupEvents: number;
};

type SeasonRow = { id: string };
type NationsCupStandingRow = {
  country_id: string;
  division: number;
  group_code: string | null;
  points: number;
  events_count: number;
  overall_rank: number;
};

export async function getFederationObjectiveMetrics({
  countryId,
  seasonId,
  gameYear,
  currentMemberTeamCount,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
  currentMemberTeamCount: number;
}): Promise<FederationObjectiveMetrics> {
  const fallback: FederationObjectiveMetrics = {
    referenceMemberTeamCount: currentMemberTeamCount,
    naturalizationCount: 0,
    manuallySubmittedSelectionCount: 0,
    nationsCupRank: null,
    nationsCupDivision: null,
    nationsCupGroup: null,
    nationsCupPoints: 0,
    nationsCupEvents: 0,
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
    if (referenceSeason.error) throw referenceSeason.error;

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
          .not("created_by_director_id", "is", null)
          .in("status", ["pending_confirmation", "finalized"]),
        admin.rpc("get_national_federation_nations_cup_standings", {
          p_season_id: seasonId,
        }),
      ]);

    if (memberTeams.error) throw memberTeams.error;
    if (naturalizations.error) throw naturalizations.error;
    if (publishedSelections.error) throw publishedSelections.error;
    if (nationsCup.error) throw nationsCup.error;

    const nationsCupStanding = (
      (nationsCup.data ?? []) as NationsCupStandingRow[]
    ).find((entry) => entry.country_id === countryId);
    const hasNationsCupResult = (nationsCupStanding?.events_count ?? 0) > 0;

    return {
      referenceMemberTeamCount:
        memberTeams.count ?? currentMemberTeamCount,
      naturalizationCount: naturalizations.count ?? 0,
      manuallySubmittedSelectionCount: publishedSelections.count ?? 0,
      nationsCupRank: hasNationsCupResult
        ? (nationsCupStanding?.overall_rank ?? null)
        : null,
      nationsCupDivision: nationsCupStanding?.division ?? null,
      nationsCupGroup: nationsCupStanding?.group_code ?? null,
      nationsCupPoints: nationsCupStanding?.points ?? 0,
      nationsCupEvents: nationsCupStanding?.events_count ?? 0,
    };
  } catch (error) {
    console.error("Impossible de charger les objectifs fédéraux :", error);
    return fallback;
  }
}
