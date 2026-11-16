import "server-only";

import { ALBUM_ACHIEVEMENTS } from "@/lib/game/collector-album";

import {
  normalizeGameObjective,
  type GameObjective,
  type GameObjectiveRow,
} from "@/lib/game/objectives";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export async function getCurrentGameObjectives(
  supabase: SupabaseServerClient
): Promise<GameObjective[]> {
  const { data, error } = await supabase.rpc("get_current_game_objectives");

  if (error) {
    throw new Error(`Impossible de charger les objectifs : ${error.message}`);
  }

  return ((data ?? []) as GameObjectiveRow[]).map(normalizeGameObjective);
}

export type RewardsPageObjective = GameObjective & {
  album?: { editionId: string; achievementId: string; trophy: boolean };
};

type CycloStickersRewardObjectiveRow = Omit<
  GameObjectiveRow,
  "objective_key" | "objective_type" | "objective_group" | "description" |
    "reward_item_name" | "reward_item_kind"
> & { edition_id: string; achievement_id: string; trophy: boolean };

const albumAchievementDescriptions = new Map(
  ALBUM_ACHIEVEMENTS.map(({ id, description }) => [id, description]),
);

export async function getCurrentCycloStickersRewardObjectives(
  supabase: SupabaseServerClient,
): Promise<RewardsPageObjective[]> {
  const { data, error } = await supabase.rpc("get_current_cyclo_stickers_reward_objectives")
    .abortSignal(AbortSignal.timeout(3000));

  if (error) {
    console.error("Impossible de charger les succès Cyclo-Stickers", error.message);
    return [];
  }

  return ((data ?? []) as CycloStickersRewardObjectiveRow[]).map((row) => ({
    ...normalizeGameObjective({
      ...row,
      objective_key: `album:${row.edition_id}:${row.achievement_id}`,
      objective_type: "secondary",
      objective_group: "cyclo_stickers",
      description: albumAchievementDescriptions.get(row.achievement_id) ?? "",
      reward_item_name: null,
      reward_item_kind: null,
    }),
    album: { editionId: row.edition_id, achievementId: row.achievement_id, trophy: row.trophy },
  }));
}
