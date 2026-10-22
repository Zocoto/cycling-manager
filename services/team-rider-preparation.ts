import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPerformancePreparationPolicy, PERFORMANCE_PREPARATION_TYPES, type PerformancePreparationType as PreparationType } from "@/lib/game/performance-preparation";

export type TeamRiderPreparationOverview = {
  teamName: string;
  seasonName: string;
  currentDayNumber: number;
  currentGameDayIndex: number;
  facilities: Record<
    PreparationType,
    {
      level: number;
      activePreparationId: string | null;
      activePreparationIds?: string[];
      capacity?: number;
      specializationCode?: string | null;
    }
  >;
  riders: Array<{
    id: string;
    firstName: string;
    lastName: string;
    countryCode: string;
  }>;
  preparations: Array<{
    id: string;
    riderId?: string;
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
  const currentGameDayIndex =
    season.data.game_year * 28 + season.data.current_day_number - 1;
  const currentGameYear = season.data.game_year;
  const [infrastructures, contracts, preparations, specializations] = await Promise.all([
    admin
      .from("team_infrastructures")
      .select("infrastructure_code,level")
      .eq("team_id", assignment.data.team_id)
      .in("infrastructure_code", PERFORMANCE_PREPARATION_TYPES)
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
        "id,rider_id,preparation_type,building_level,preparation_start_game_day,preparation_end_game_day,bonus_start_game_day,bonus_end_game_day,rating_bonus,status,created_at",
      )
      .eq("team_id", assignment.data.team_id)
      .neq("status", "cancelled")
      // All occupied places come before bounded history, even
      // when more recent completed preparations would otherwise hide them.
      .order("status", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40)
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
          created_at: string;
        }>
      >(),
    admin.from("team_infrastructure_specializations")
      .select("infrastructure_code,active_specialization_code,pending_specialization_code,effective_game_day_index")
      .eq("team_id", assignment.data.team_id)
      .in("infrastructure_code", ["cobbles_center", "hills_circuit", "mountain_base"])
      .limit(3)
      .returns<Array<{ infrastructure_code: string; active_specialization_code: string | null; pending_specialization_code: string | null; effective_game_day_index: number | null }>>(),
  ]);
  if (infrastructures.error || contracts.error || preparations.error || specializations.error)
    throw new Error("Impossible de charger les préparations coureurs.");
  const contractedRiderIds = new Set(
    (contracts.data ?? []).map((row) => row.rider_id),
  );
  const riderIds = [
    ...new Set([
      ...contractedRiderIds,
      ...(preparations.data ?? []).map((row) => row.rider_id),
    ]),
  ];
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
  const mappedPreparations = [...(preparations.data ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((row) => {
      const rider = riderById.get(row.rider_id);
      return {
        id: row.id,
        riderId: row.rider_id,
        type: row.preparation_type,
        riderName: rider
          ? `${rider.first_name} ${rider.last_name}`
          : "Coureur indisponible",
        buildingLevel: row.building_level,
        preparationStartGameDay: row.preparation_start_game_day,
        preparationEndGameDay: row.preparation_end_game_day,
        bonusStartGameDay: row.bonus_start_game_day,
        bonusEndGameDay: row.bonus_end_game_day,
        ratingBonus: row.rating_bonus,
        status: row.status,
      };
    });
  const facility = (code: PreparationType) => {
    const facilityLevel = level(code);
    const specialization = (specializations.data ?? []).find(row => row.infrastructure_code === code);
    const specializationCode = currentGameYear < 3 ? null
      : specialization?.pending_specialization_code && specialization.effective_game_day_index !== null
        && specialization.effective_game_day_index <= currentGameDayIndex
        ? specialization.pending_specialization_code : specialization?.active_specialization_code ?? null;
    // Count source rows, not the display roster: a transferred rider must not
    // silently free a reserved place. Dates also tolerate a delayed settlement.
    const activePreparationIds = (preparations.data ?? [])
      .filter(
        (row) =>
          row.preparation_type === code &&
          row.status === "planned" &&
          row.preparation_end_game_day >= currentGameDayIndex,
      )
      .map((row) => row.id);
    return {
      level: facilityLevel,
      capacity: getPerformancePreparationPolicy(facilityLevel, { preparationType: code, specializationCode })?.capacity ?? 0,
      specializationCode,
      activePreparationId: activePreparationIds[0] ?? null,
      activePreparationIds,
    };
  };
  return {
    teamName: teamSeason.data.display_name,
    seasonName: season.data.name,
    currentDayNumber: season.data.current_day_number,
    currentGameDayIndex,
    facilities: {
      indoor_track: facility("indoor_track"),
      wind_tunnel: facility("wind_tunnel"),
      cobbles_center: facility("cobbles_center"),
      hills_circuit: facility("hills_circuit"),
      mountain_base: facility("mountain_base"),
    },
    riders: (ridersResult.data ?? [])
      .filter((rider) => contractedRiderIds.has(rider.id))
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
