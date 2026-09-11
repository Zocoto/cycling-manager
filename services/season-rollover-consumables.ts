import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type SeasonRow = {
  id: string;
  game_year: number;
  status: string;
};

type TeamSeasonRow = {
  id: string;
  team_id: string;
  season_id: string;
};

type GenericInventoryRow = {
  team_season_id: string;
  inventory_item_id: string;
  quantity: number;
  acquisition_source: string | null;
  acquired_at: string;
};

type DailyRewardInventoryRow = {
  id: string;
  team_season_id: string;
  status: string;
  expires_after_game_year: number;
};

export type ConsumableRolloverRepair = {
  sourceGameYear: number | null;
  targetGameYear: number | null;
  genericItemsRecovered: number;
  genericUnitsRecovered: number;
  dailyRewardsReattached: number;
};

const ROLLOVER_MARKER = "Rollover consommables";

/**
 * Repairs the two consumable stores after a season rollover. It is safe to run
 * on every maintenance pass: generic rows carry a marker and daily rewards
 * move away from the previous team_season_id after the first successful pass.
 */
export async function repairCurrentConsumableRollover(
  supabase: SupabaseClient,
): Promise<ConsumableRolloverRepair> {
  const seasonsResult = await supabase
    .from("seasons")
    .select("id, game_year, status")
    .in("status", ["active", "completed"])
    .order("game_year", { ascending: false })
    .returns<SeasonRow[]>();
  assertQuery(seasonsResult.error, "les saisons du rattrapage d’inventaire");

  const targetSeason = (seasonsResult.data ?? []).find(
    (season) => season.status === "active",
  );
  const sourceSeason = targetSeason
    ? (seasonsResult.data ?? []).find(
        (season) =>
          season.status === "completed" &&
          season.game_year === targetSeason.game_year - 1,
      )
    : null;

  if (!targetSeason || !sourceSeason) {
    return {
      sourceGameYear: sourceSeason?.game_year ?? null,
      targetGameYear: targetSeason?.game_year ?? null,
      genericItemsRecovered: 0,
      genericUnitsRecovered: 0,
      dailyRewardsReattached: 0,
    };
  }

  const teamSeasonsResult = await supabase
    .from("team_seasons")
    .select("id, team_id, season_id")
    .in("season_id", [sourceSeason.id, targetSeason.id])
    .returns<TeamSeasonRow[]>();
  assertQuery(teamSeasonsResult.error, "les équipes des saisons du rattrapage");

  const sourceTeams = (teamSeasonsResult.data ?? []).filter(
    (teamSeason) => teamSeason.season_id === sourceSeason.id,
  );
  const targetByTeam = new Map(
    (teamSeasonsResult.data ?? [])
      .filter((teamSeason) => teamSeason.season_id === targetSeason.id)
      .map((teamSeason) => [teamSeason.team_id, teamSeason]),
  );
  const sourceTeamIds = sourceTeams.map((teamSeason) => teamSeason.id);
  const targetTeamIds = [...targetByTeam.values()].map(
    (teamSeason) => teamSeason.id,
  );

  if (sourceTeamIds.length === 0 || targetTeamIds.length === 0) {
    return {
      sourceGameYear: sourceSeason.game_year,
      targetGameYear: targetSeason.game_year,
      genericItemsRecovered: 0,
      genericUnitsRecovered: 0,
      dailyRewardsReattached: 0,
    };
  }

  const [sourceInventoryResult, targetInventoryResult, rewardsResult] =
    await Promise.all([
      supabase
        .from("team_item_inventory")
        .select(
          "team_season_id, inventory_item_id, quantity, acquisition_source, acquired_at",
        )
        .in("team_season_id", sourceTeamIds)
        .returns<GenericInventoryRow[]>(),
      supabase
        .from("team_item_inventory")
        .select(
          "team_season_id, inventory_item_id, quantity, acquisition_source, acquired_at",
        )
        .in("team_season_id", targetTeamIds)
        .returns<GenericInventoryRow[]>(),
      supabase
        .from("daily_reward_inventory")
        .select("id, team_season_id, status, expires_after_game_year")
        .in("team_season_id", sourceTeamIds)
        .eq("status", "available")
        .gte("expires_after_game_year", targetSeason.game_year)
        .returns<DailyRewardInventoryRow[]>(),
    ]);
  assertQuery(sourceInventoryResult.error, "les consommables S2");
  assertQuery(targetInventoryResult.error, "les consommables S3");
  assertQuery(rewardsResult.error, "les récompenses consommables S2");

  const sourceTeamById = new Map(
    sourceTeams.map((teamSeason) => [teamSeason.id, teamSeason]),
  );
  const targetInventoryByKey = new Map(
    (targetInventoryResult.data ?? []).map((inventory) => [
      `${inventory.team_season_id}/${inventory.inventory_item_id}`,
      inventory,
    ]),
  );
  const recoveredRows: GenericInventoryRow[] = [];
  let genericUnitsRecovered = 0;

  for (const inventory of sourceInventoryResult.data ?? []) {
    const sourceTeam = sourceTeamById.get(inventory.team_season_id);
    const targetTeam = sourceTeam ? targetByTeam.get(sourceTeam.team_id) : null;
    if (!targetTeam) continue;

    const key = `${targetTeam.id}/${inventory.inventory_item_id}`;
    const existing = targetInventoryByKey.get(key);
    if (existing?.acquisition_source?.startsWith(ROLLOVER_MARKER)) continue;

    recoveredRows.push({
      team_season_id: targetTeam.id,
      inventory_item_id: inventory.inventory_item_id,
      quantity: (existing?.quantity ?? 0) + inventory.quantity,
      acquisition_source: `${ROLLOVER_MARKER} · ${
        existing?.acquisition_source ?? inventory.acquisition_source ?? "objet récupéré"
      }`,
      acquired_at: existing?.acquired_at ?? inventory.acquired_at,
    });
    genericUnitsRecovered += inventory.quantity;
  }

  if (recoveredRows.length > 0) {
    const upsertResult = await supabase
      .from("team_item_inventory")
      .upsert(
        recoveredRows.map((row) => ({ ...row, updated_at: new Date().toISOString() })),
        { onConflict: "team_season_id,inventory_item_id" },
      );
    assertQuery(upsertResult.error, "la restauration des consommables génériques");
  }

  const rewardsByTarget = new Map<string, string[]>();
  for (const reward of rewardsResult.data ?? []) {
    const sourceTeam = sourceTeamById.get(reward.team_season_id);
    const targetTeam = sourceTeam ? targetByTeam.get(sourceTeam.team_id) : null;
    if (!targetTeam) continue;
    const ids = rewardsByTarget.get(targetTeam.id) ?? [];
    ids.push(reward.id);
    rewardsByTarget.set(targetTeam.id, ids);
  }

  let dailyRewardsReattached = 0;
  for (const [targetTeamSeasonId, rewardIds] of rewardsByTarget) {
    const wildcardResult = await supabase
      .from("daily_reward_wildcard_reservations")
      .update({ team_season_id: targetTeamSeasonId })
      .in("source_inventory_id", rewardIds)
      .eq("status", "reserved");
    assertQuery(wildcardResult.error, "les réservations de récompenses consommables");

    const rewardResult = await supabase
      .from("daily_reward_inventory")
      .update({ team_season_id: targetTeamSeasonId })
      .in("id", rewardIds)
      .eq("status", "available");
    assertQuery(rewardResult.error, "le rattachement des récompenses consommables");
    dailyRewardsReattached += rewardIds.length;
  }

  return {
    sourceGameYear: sourceSeason.game_year,
    targetGameYear: targetSeason.game_year,
    genericItemsRecovered: recoveredRows.length,
    genericUnitsRecovered,
    dailyRewardsReattached,
  };
}

function assertQuery(error: { message: string } | null, label: string): void {
  if (error) throw new Error(`Impossible de traiter ${label} : ${error.message}`);
}
