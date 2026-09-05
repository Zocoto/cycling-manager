import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationObjectiveMetrics = {
  referenceMemberTeamCount: number;
  naturalizationCount: number;
  manuallySubmittedSelectionCount: number;
  nationsCupRank: number | null;
};

type SeasonRow = { id: string };
type DevelopmentNationRow = {
  entity_key: string;
  display_name: string;
  points: number;
  wins: number;
};

export async function getFederationObjectiveMetrics({
  countryId,
  countryCode,
  seasonId,
  gameYear,
  currentMemberTeamCount,
}: {
  countryId: string;
  countryCode: string;
  seasonId: string;
  gameYear: number;
  currentMemberTeamCount: number;
}): Promise<FederationObjectiveMetrics> {
  const fallback: FederationObjectiveMetrics = {
    referenceMemberTeamCount: currentMemberTeamCount,
    naturalizationCount: 0,
    manuallySubmittedSelectionCount: 0,
    nationsCupRank: null,
  };

  try {
    const admin = createSupabaseAdminClient();
    const referenceSeason =
      gameYear < 3
        ? { data: { id: seasonId } as SeasonRow, error: null }
        : await admin
            .from("seasons")
            .select("id")
            .eq("game_year", gameYear - 1)
            .maybeSingle<SeasonRow>();
    if (referenceSeason.error) throw referenceSeason.error;

    const referenceSeasonId = referenceSeason.data?.id ?? seasonId;
    const [memberTeams, naturalizations, publishedSelections, juniorNations] =
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
        admin
          .from("development_ranking_entries")
          .select("entity_key, display_name, points, wins")
          .eq("season_id", seasonId)
          .eq("entity_type", "nation")
          .order("points", { ascending: false })
          .order("wins", { ascending: false })
          .order("display_name", { ascending: true })
          .returns<DevelopmentNationRow[]>(),
      ]);

    if (memberTeams.error) throw memberTeams.error;
    if (naturalizations.error) throw naturalizations.error;
    if (publishedSelections.error) throw publishedSelections.error;
    if (juniorNations.error) throw juniorNations.error;

    const nationsCupIndex = (juniorNations.data ?? []).findIndex(
      (entry) => entry.entity_key.toUpperCase() === countryCode.toUpperCase(),
    );

    return {
      referenceMemberTeamCount:
        memberTeams.count ?? currentMemberTeamCount,
      naturalizationCount: naturalizations.count ?? 0,
      manuallySubmittedSelectionCount: publishedSelections.count ?? 0,
      nationsCupRank: nationsCupIndex >= 0 ? nationsCupIndex + 1 : null,
    };
  } catch (error) {
    console.error("Impossible de charger les objectifs fédéraux :", error);
    return fallback;
  }
}
