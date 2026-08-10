import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const FAN_CLUB_HEADQUARTERS_CODE = "fan_club_headquarters";
export const FAN_CLUB_SHOP_CODE = "club_shop";

export type TeamFanClubBuildings = {
  headquartersLevel: number;
  shopLevel: number;
};

const NO_FAN_CLUB_BUILDINGS: TeamFanClubBuildings = {
  headquartersLevel: 0,
  shopLevel: 0,
};

export async function getTeamFanClubBuildings(
  supabase: ServerClient,
  teamId: string,
): Promise<TeamFanClubBuildings> {
  const normalizedTeamId = teamId.trim();
  if (!normalizedTeamId) return NO_FAN_CLUB_BUILDINGS;

  const result = await supabase
    .from("team_infrastructures")
    .select("infrastructure_code, level")
    .eq("team_id", normalizedTeamId)
    .in("infrastructure_code", [
      FAN_CLUB_HEADQUARTERS_CODE,
      FAN_CLUB_SHOP_CODE,
    ])
    .returns<Array<{ infrastructure_code: string; level: number }>>();

  if (result.error) {
    throw new Error(
      `Impossible de charger les bâtiments du Fan Club : ${result.error.message}`,
    );
  }

  return (result.data ?? []).reduce<TeamFanClubBuildings>(
    (buildings, row) => {
      const level = Math.max(0, Math.min(5, Number(row.level) || 0));
      if (row.infrastructure_code === FAN_CLUB_HEADQUARTERS_CODE) {
        buildings.headquartersLevel = level;
      }
      if (row.infrastructure_code === FAN_CLUB_SHOP_CODE) {
        buildings.shopLevel = level;
      }
      return buildings;
    },
    { ...NO_FAN_CLUB_BUILDINGS },
  );
}
