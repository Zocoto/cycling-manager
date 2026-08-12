import "server-only";

import {
  calculateInGameTenureDays,
  evaluateNaturalizationEligibility,
  type NaturalizationEligibility,
} from "@/lib/game/naturalization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type SeasonRow = {
  id: string;
  game_year: number;
  current_day_number: number | null;
};

type CountryProgressRow = {
  accumulated_days: number;
  active_since_season_id: string | null;
  active_since_day_number: number | null;
};

export async function getProfessionalRiderNaturalizationEligibility({
  authUserId,
  riderId,
}: {
  authUserId: string;
  riderId: string;
}): Promise<NaturalizationEligibility | null> {
  const admin = createSupabaseAdminClient();
  const [directorResult, seasonResult] = await Promise.all([
    admin
      .from("sporting_directors")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("status", "active")
      .maybeSingle<{ id: string }>(),
    admin
      .from("seasons")
      .select("id, game_year, current_day_number")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);
  assertQuery(directorResult.error, "le Directeur Sportif");
  assertQuery(seasonResult.error, "la saison active");
  if (!directorResult.data || !seasonResult.data) return null;

  const assignmentResult = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", directorResult.data.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ team_id: string }>();
  assertQuery(assignmentResult.error, "l'équipe du Directeur Sportif");
  if (!assignmentResult.data) return null;

  const teamId = assignmentResult.data.team_id;
  const [
    riderResult,
    contractResult,
    teamSeasonResult,
    titleResult,
    welcomeCenterResult,
  ] = await Promise.all([
    admin
      .from("riders")
      .select("country_id")
      .eq("id", riderId)
      .eq("status", "active")
      .maybeSingle<{ country_id: string }>(),
    admin
      .from("rider_contracts")
      .select("id")
      .eq("rider_id", riderId)
      .eq("team_id", teamId)
      .eq("status", "active")
      .maybeSingle<{ id: string }>(),
    admin
      .from("team_seasons")
      .select("registration_country_id")
      .eq("team_id", teamId)
      .eq("season_id", seasonResult.data.id)
      .maybeSingle<{ registration_country_id: string }>(),
    admin
      .from("rider_national_championship_titles")
      .select("id", { count: "exact", head: true })
      .eq("rider_id", riderId),
    admin
      .from("team_infrastructures")
      .select("level")
      .eq("team_id", teamId)
      .eq("infrastructure_code", "international_welcome_center")
      .maybeSingle<{ level: number }>(),
  ]);
  assertQuery(riderResult.error, "le coureur");
  assertQuery(contractResult.error, "le contrat actuel du coureur");
  assertQuery(teamSeasonResult.error, "la nationalité actuelle de l'équipe");
  assertQuery(titleResult.error, "le palmarès national du coureur");
  if (!riderResult.data || !contractResult.data || !teamSeasonResult.data) {
    return null;
  }

  const targetCountryId = teamSeasonResult.data.registration_country_id;
  const progressResult = await admin
    .from("rider_naturalization_country_progress")
    .select("accumulated_days, active_since_season_id, active_since_day_number")
    .eq("rider_id", riderId)
    .eq("country_id", targetCountryId)
    .maybeSingle<CountryProgressRow>();
  assertQuery(
    progressResult.error,
    "la progression de naturalisation du coureur",
  );

  let elapsedDays = progressResult.data?.accumulated_days ?? 0;
  if (
    progressResult.data?.active_since_season_id &&
    progressResult.data.active_since_day_number !== null
  ) {
    let progressStartSeason: SeasonRow | null = seasonResult.data;
    if (progressResult.data.active_since_season_id !== seasonResult.data.id) {
      const progressSeasonResult = await admin
        .from("seasons")
        .select("id, game_year, current_day_number")
        .eq("id", progressResult.data.active_since_season_id)
        .maybeSingle<SeasonRow>();
      assertQuery(
        progressSeasonResult.error,
        "le début de la progression de naturalisation",
      );
      progressStartSeason = progressSeasonResult.data;
    }

    if (progressStartSeason) {
      elapsedDays += calculateInGameTenureDays({
        startGameYear: progressStartSeason.game_year,
        startDayNumber: progressResult.data.active_since_day_number,
        currentGameYear: seasonResult.data.game_year,
        currentDayNumber: seasonResult.data.current_day_number ?? 1,
      });
    }
  }

  const countryIds = [riderResult.data.country_id, targetCountryId];
  const countriesResult = await admin
    .from("countries")
    .select("id, name, iso_alpha2")
    .in("id", countryIds)
    .returns<CountryRow[]>();
  assertQuery(countriesResult.error, "les nationalités de naturalisation");
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const currentCountry = countryById.get(riderResult.data.country_id);
  const targetCountry = countryById.get(targetCountryId);
  if (!currentCountry || !targetCountry) return null;

  return evaluateNaturalizationEligibility({
    level: "professional",
    elapsedDays,
    currentCountry: toCountry(currentCountry),
    targetCountry: toCountry(targetCountry),
    hasNationalChampionshipTitle: (titleResult.count ?? 0) > 0,
    requiredDays: [84, 70, 56, 42, 28, 14][
      Math.max(0, Math.min(5, Number(welcomeCenterResult.data?.level ?? 0)))
    ],
  });
}

function toCountry(country: CountryRow) {
  return {
    id: country.id,
    name: country.name,
    code: country.iso_alpha2,
  };
}

function assertQuery(error: { message: string } | null, label: string): void {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
