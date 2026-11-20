import "server-only";

import type { PantheonCategory, PantheonFilters, PantheonKind } from "@/lib/game/pantheon";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type PantheonRider = {
  rider_key: string | null;
  rider_id: string | null;
  rider_name: string | null;
  country_code: string | null;
  retired: boolean;
};

export type PantheonWinner = PantheonRider & {
  id: string;
  race_key: string;
  race_name: string;
  result_href: string | null;
  season_name: string;
  game_year: number;
  category: PantheonCategory;
  kind: PantheonKind;
  stage_name: string | null;
  team_name: string | null;
  points: number;
};

export type PantheonRank = PantheonRider & {
  rank: number;
  wins: number;
  points: number;
  category_wins: Partial<Record<PantheonCategory, number>>;
};

type Page<T> = { items: T[]; total: number };
type Season = { game_year: number; season_name: string };

export type PantheonData =
  | (Page<PantheonWinner> & { view: "palmares"; seasons: Season[]; race_name?: string | null })
  | (Page<PantheonRank> & { view: "classement" });

export async function getPantheonData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  filters: PantheonFilters,
): Promise<PantheonData> {
  const common = { p_category: filters.category, p_query: filters.query, p_page: filters.page };
  if (filters.view === "classement") {
    const { data, error } = await supabase.rpc("get_pantheon_ranking", { ...common, p_sort: filters.sort });
    if (error) throw new Error(error.message);
    return { ...(data as Page<PantheonRank>), view: "classement" };
  }

  const { data, error } = await supabase.rpc("get_pantheon_winners", {
    ...common,
    p_kind: filters.kind,
    p_season: filters.season,
    p_race_key: filters.raceKey,
  });
  if (error) throw new Error(error.message);
  return { ...(data as Omit<Extract<PantheonData, { view: "palmares" }>, "view">), view: "palmares" };
}
