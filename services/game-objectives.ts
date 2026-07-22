import "server-only";

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
