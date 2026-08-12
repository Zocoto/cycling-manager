import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PreparationType = "indoor_track" | "wind_tunnel";

export type TeamRiderPreparationOverview = {
  teamName: string;
  seasonName: string;
  currentDayNumber: number;
  currentGameDayIndex: number;
  facilities: Record<
    PreparationType,
    { level: number; activePreparationId: string | null }
  >;
  riders: Array<{
    id: string;
    firstName: string;
    lastName: string;
    countryCode: string;
  }>;
  preparations: Array<{
    id: string;
    type: PreparationType;
    riderName: string;
    buildingLevel: number;
    preparationStartGameDay: number;
    preparationEndGameDay: number;
    bonusStartGameDay: number;
    bonusEndGameDay: number;
    ratingBonus: number;
    status: "planned" | "completed" | "cancelled";
  }>;
};

export async function getCurrentTeamRiderPreparationOverview(
  authUserId: string,
): Promise<TeamRiderPreparationOverview | null> {
  const admin = createSupabaseAdminClient();
  await admin.rpc("settle_due_rider_performance_preparations");
  const director = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  if (director.error)
    throw new Error(`Impossible de charger le DS : ${director.error.message}`);
  if (!director.data) return null;
  const [assignment, season] = await Promise.all([
    admin
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", director.data.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<{ team_id: string }>(),
    admin
      .from("seasons")
      .select("id,name,game_year,current_day_number")
      .eq("status", "active")
      .maybeSingle<{
        id: string;
        name: string;
        game_year: number;
        current_day_number: number;
      }>(),
  ]);
  if (assignment.error || season.error)
    throw new Error("Impossible de charger le contexte de préparation.");
  if (!assignment.data || !season.data) return null;
  const teamSeason = await admin
    .from("team_seasons")
    .select("id,display_name")
    .eq("team_id", assignment.data.team_id)
    .eq("season_id", season.data.id)
    .maybeSingle<{ id: string; display_name: string }>();
  if (teamSeason.error || !teamSeason.data) return null;
  const [infrastructures, contracts, preparations] = await Promise.all([
    admin
      .from("team_infrastructures")
      .select("infrastructure_code,level")
      .eq("team_id", assignment.data.team_id)
      .in("infrastructure_code", ["indoor_track", "wind_tunnel"])
      .returns<Array<{ infrastructure_code: string; level: number }>>(),
    admin
      .from("rider_contracts")
      .select("rider_id")
      .eq("team_id", assignment.data.team_id)
      .eq("status", "active")
      .returns<Array<{ rider_id: string }>>(),
    admin
      .from("rider_performance_preparations")
      .select(
        "id,rider_id,preparation_type,building_level,preparation_start_game_day,preparation_end_game_day,bonus_start_game_day,bonus_end_game_day,rating_bonus,status",
      )
      .eq("team_id", assignment.data.team_id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<
        Array<{
          id: string;
          rider_id: string;
          preparation_type: PreparationType;
          building_level: number;
          preparation_start_game_day: number;
          preparation_end_game_day: number;
          bonus_start_game_day: number;
          bonus_end_game_day: number;
          rating_bonus: number;
          status: "planned" | "completed" | "cancelled";
        }>
      >(),
  ]);
  if (infrastructures.error || contracts.error || preparations.error)
    throw new Error("Impossible de charger les préparations coureurs.");
  const riderIds = (contracts.data ?? []).map((row) => row.rider_id);
  const ridersResult = riderIds.length
    ? await admin
        .from("riders")
        .select("id,first_name,last_name,country_id")
        .in("id", riderIds)
        .returns<
          Array<{
            id: string;
            first_name: string;
            last_name: string;
            country_id: string;
          }>
        >()
    : { data: [], error: null };
  if (ridersResult.error)
    throw new Error("Impossible de charger les coureurs.");
  const countryIds = [
    ...new Set((ridersResult.data ?? []).map((rider) => rider.country_id)),
  ];
  const countries = countryIds.length
    ? await admin
        .from("countries")
        .select("id,iso_alpha2")
        .in("id", countryIds)
        .returns<Array<{ id: string; iso_alpha2: string }>>()
    : { data: [], error: null };
  const countryById = new Map(
    (countries.data ?? []).map((country) => [country.id, country.iso_alpha2]),
  );
  const riderById = new Map(
    (ridersResult.data ?? []).map((rider) => [rider.id, rider]),
  );
  const level = (code: PreparationType) =>
    (infrastructures.data ?? []).find((row) => row.infrastructure_code === code)
      ?.level ?? 0;
  const mappedPreparations = (preparations.data ?? []).flatMap((row) => {
    const rider = riderById.get(row.rider_id);
    return rider
      ? [
          {
            id: row.id,
            type: row.preparation_type,
            riderName: `${rider.first_name} ${rider.last_name}`,
            buildingLevel: row.building_level,
            preparationStartGameDay: row.preparation_start_game_day,
            preparationEndGameDay: row.preparation_end_game_day,
            bonusStartGameDay: row.bonus_start_game_day,
            bonusEndGameDay: row.bonus_end_game_day,
            ratingBonus: row.rating_bonus,
            status: row.status,
          },
        ]
      : [];
  });
  return {
    teamName: teamSeason.data.display_name,
    seasonName: season.data.name,
    currentDayNumber: season.data.current_day_number,
    currentGameDayIndex:
      season.data.game_year * 28 + season.data.current_day_number - 1,
    facilities: {
      indoor_track: {
        level: level("indoor_track"),
        activePreparationId:
          mappedPreparations.find(
            (row) => row.type === "indoor_track" && row.status === "planned",
          )?.id ?? null,
      },
      wind_tunnel: {
        level: level("wind_tunnel"),
        activePreparationId:
          mappedPreparations.find(
            (row) => row.type === "wind_tunnel" && row.status === "planned",
          )?.id ?? null,
      },
    },
    riders: (ridersResult.data ?? [])
      .map((rider) => ({
        id: rider.id,
        firstName: rider.first_name,
        lastName: rider.last_name,
        countryCode: countryById.get(rider.country_id) ?? "UN",
      }))
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`,
          "fr",
        ),
      ),
    preparations: mappedPreparations,
  };
}
