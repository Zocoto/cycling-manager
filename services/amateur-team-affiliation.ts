import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AmateurTeamAffiliationState = {
  teamCountryId: string;
  teamCountryCode: string;
  teamCountryName: string;
  trainerCountryId: string | null;
  trainerCountryCode: string | null;
  trainerCountryName: string;
  federationCountryId: string;
  federationCountryCode: string;
  federationCountryName: string;
  canChange: boolean;
  unavailableReason: string | null;
};

type TeamRow = {
  home_country_id: string;
  amateur_name: string | null;
};

type ManagerAssignmentRow = { sporting_director_id: string };
type DirectorRow = { country_id: string | null };

type SeasonRow = { id: string; game_year: number };
type TeamSeasonRow = { registration_country_id: string };
type CountryRow = { id: string; iso_alpha2: string; name: string };

export async function getAmateurTeamAffiliationState(
  teamId: string | null,
): Promise<AmateurTeamAffiliationState | null> {
  if (!teamId) return null;

  const admin = createSupabaseAdminClient();
  const [seasonResult, teamResult, assignmentResult] = await Promise.all([
    admin
      .from("seasons")
      .select("id, game_year")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
    admin
      .from("teams")
      .select("home_country_id, amateur_name")
      .eq("id", teamId)
      .maybeSingle<TeamRow>(),
    admin
      .from("team_manager_assignments")
      .select("sporting_director_id")
      .eq("team_id", teamId)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<ManagerAssignmentRow>(),
  ]);

  assertQuery(seasonResult.error, "la saison active");
  assertQuery(teamResult.error, "l’identité de l’équipe");
  assertQuery(assignmentResult.error, "l’entraîneur de l’équipe");
  if (!seasonResult.data || !teamResult.data || !assignmentResult.data) {
    return null;
  }
  const season = seasonResult.data;
  const team = teamResult.data;

  const [teamSeasonResult, changeResult, directorResult] = await Promise.all([
    admin
      .from("team_seasons")
      .select("registration_country_id")
      .eq("team_id", teamId)
      .eq("season_id", season.id)
      .maybeSingle<TeamSeasonRow>(),
    admin
      .from("team_national_affiliation_changes")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("season_id", season.id),
    admin
      .from("sporting_directors")
      .select("country_id")
      .eq("id", assignmentResult.data.sporting_director_id)
      .maybeSingle<DirectorRow>(),
  ]);

  assertQuery(teamSeasonResult.error, "l’affiliation sportive de l’équipe");
  assertQuery(changeResult.error, "l’historique des changements d’affiliation");
  assertQuery(directorResult.error, "la nationalité de l’entraîneur");
  if (!teamSeasonResult.data || !directorResult.data) return null;
  const director = directorResult.data;

  const federationCountryId = teamSeasonResult.data.registration_country_id;
  const [countriesResult, previousSeasonResult] = await Promise.all([
    admin
      .from("countries")
      .select("id, iso_alpha2, name")
      .in(
        "id",
        [
          team.home_country_id,
          director.country_id,
          federationCountryId,
        ].filter((countryId): countryId is string => Boolean(countryId)),
      )
      .eq("is_active", true)
      .returns<CountryRow[]>(),
    admin
      .from("seasons")
      .select("id, game_year")
      .eq("game_year", season.game_year - 1)
      .eq("status", "completed")
      .maybeSingle<SeasonRow>(),
  ]);
  assertQuery(countriesResult.error, "les nationalités de l’équipe");
  assertQuery(previousSeasonResult.error, "la saison précédente");

  const currentCountry = (countriesResult.data ?? []).find(
    (country) => country.id === team.home_country_id,
  );
  const federationCountry = (countriesResult.data ?? []).find(
    (country) => country.id === federationCountryId,
  );
  const trainerCountry = (countriesResult.data ?? []).find(
    (country) => country.id === director.country_id,
  );
  if (!currentCountry || !federationCountry) return null;

  const previousAffiliationResult = previousSeasonResult.data
    ? await admin
        .from("team_seasons")
        .select("id")
        .eq("team_id", teamId)
        .eq("season_id", previousSeasonResult.data.id)
        .eq("registration_country_id", federationCountryId)
        .eq("status", "completed")
        .maybeSingle<{ id: string }>()
    : { data: null, error: null };
  assertQuery(
    previousAffiliationResult.error,
    "l’ancienneté de l’équipe dans la fédération",
  );

  const alreadyChanged = (changeResult.count ?? 0) > 0;
  const hasAmateurIdentity = Boolean(team.amateur_name);
  const hasCompletedFederationSeason = Boolean(
    previousAffiliationResult.data,
  );
  const teamAlreadyAligned = currentCountry.id === federationCountry.id;
  const trainerAlreadyAligned =
    director.country_id === federationCountry.id;
  const structureAlreadyAligned =
    teamAlreadyAligned && trainerAlreadyAligned;
  const unavailableReason = !hasAmateurIdentity
    ? "L’identité de l’équipe amateur doit d’abord être finalisée."
    : structureAlreadyAligned
      ? "Votre équipe amateure et votre entraîneur portent déjà la nationalité sportive de cette fédération."
      : !hasCompletedFederationSeason
        ? `Ce changement sera disponible en Saison ${season.game_year + 1} si votre équipe reste affiliée à cette fédération.`
        : alreadyChanged && !teamAlreadyAligned
          ? "Le changement de nationalité a déjà été utilisé cette saison."
          : null;

  return {
    teamCountryId: currentCountry.id,
    teamCountryCode: currentCountry.iso_alpha2,
    teamCountryName: currentCountry.name,
    trainerCountryId: trainerCountry?.id ?? null,
    trainerCountryCode: trainerCountry?.iso_alpha2 ?? null,
    trainerCountryName: trainerCountry?.name ?? "Non renseignée",
    federationCountryId: federationCountry.id,
    federationCountryCode: federationCountry.iso_alpha2,
    federationCountryName: federationCountry.name,
    canChange: unavailableReason === null,
    unavailableReason,
  };
}

function assertQuery(
  error: { message: string } | null,
  resource: string,
): asserts error is null {
  if (error) throw new Error(`Impossible de charger ${resource} : ${error.message}`);
}
