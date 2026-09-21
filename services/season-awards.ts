import "server-only";

import type { SeasonAwardKey } from "@/lib/game/season-awards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type SeasonAwardRow = {
  id: string;
  season_id: string;
  award_key: SeasonAward["key"];
  title: string;
  description: string;
  recipient_type: SeasonAward["recipientType"];
  rider_id: string | null;
  academy_rider_id: string | null;
  team_id: string | null;
  sporting_director_id: string | null;
  recipient_name: string;
  team_name: string | null;
  stat_value: number | null;
  stat_label: string | null;
  awarded_at: string;
  seasons: { name: string; game_year: number } | null;
};

export type SeasonAward = {
  id: string;
  seasonId: string;
  seasonName: string;
  gameYear: number;
  key: SeasonAwardKey;
  title: string;
  description: string;
  recipientType: "rider" | "junior_rider" | "team" | "director";
  riderId: string | null;
  academyRiderId: string | null;
  teamId: string | null;
  sportingDirectorId: string | null;
  recipientName: string;
  teamName: string | null;
  statValue: number | null;
  statLabel: string | null;
  awardedAt: string;
};

export async function getSeasonAwards(
  supabase: SupabaseServerClient,
): Promise<SeasonAward[]> {
  const { data, error } = await supabase
    .from("season_awards")
    .select("id, season_id, award_key, title, description, recipient_type, rider_id, academy_rider_id, team_id, sporting_director_id, recipient_name, team_name, stat_value, stat_label, awarded_at, seasons (name, game_year)")
    .order("awarded_at", { ascending: false })
    .returns<SeasonAwardRow[]>();
  if (error) throw new Error(`Impossible de charger les awards : ${error.message}`);
  return (data ?? []).map(mapSeasonAwardRow);
}

export async function getSportingDirectorSeasonAwards(
  supabase: SupabaseServerClient,
  sportingDirectorId: string,
): Promise<SeasonAward[]> {
  const { data, error } = await supabase
    .from("season_awards")
    .select("id, season_id, award_key, title, description, recipient_type, rider_id, academy_rider_id, team_id, sporting_director_id, recipient_name, team_name, stat_value, stat_label, awarded_at, seasons (name, game_year)")
    .eq("sporting_director_id", sportingDirectorId)
    .order("awarded_at", { ascending: false })
    .returns<SeasonAwardRow[]>();

  if (error) {
    throw new Error(`Impossible de charger les awards du Directeur Sportif : ${error.message}`);
  }

  return (data ?? []).map(mapSeasonAwardRow);
}

function mapSeasonAwardRow(row: SeasonAwardRow): SeasonAward {
  return {
    id: row.id,
    seasonId: row.season_id,
    seasonName: row.seasons?.name ?? "Saison",
    gameYear: row.seasons?.game_year ?? 0,
    key: row.award_key,
    title: row.title,
    description: row.description,
    recipientType: row.recipient_type,
    riderId: row.rider_id,
    academyRiderId: row.academy_rider_id,
    teamId: row.team_id,
    sportingDirectorId: row.sporting_director_id,
    recipientName: row.recipient_name,
    teamName: row.team_name,
    statValue: row.stat_value,
    statLabel: row.stat_label,
    awardedAt: row.awarded_at,
  };
}
