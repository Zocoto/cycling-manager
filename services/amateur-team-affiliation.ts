import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AmateurTeamAffiliationState = {
  currentCountryId: string;
  currentCountryCode: string;
  currentCountryName: string;
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

type SeasonRow = { id: string; game_year: number };
type TeamSeasonRow = { registration_country_id: string };
type CountryRow = { id: string; iso_alpha2: string; name: string };

export async function getAmateurTeamAffiliationState(
  teamId: string | null,
): Promise<AmateurTeamAffiliationState | null> {
  if (!teamId) return null;

  const admin = createSupabaseAdminClient();
  const [seasonResult, teamResult] = await Promise.all([
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
  ]);

  assertQuery(seasonResult.error, "la saison active");
  assertQuery(teamResult.error, "l’identité de l’équipe");
  if (!seasonResult.data || !teamResult.data) return null;
  const season = seasonResult.data;
  const team = teamResult.data;

  const [teamSeasonResult, changeResult] = await Promise.all([
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
  ]);

  assertQuery(teamSeasonResult.error, "l’affiliation sportive de l’équipe");
  assertQuery(changeResult.error, "l’historique des changements d’affiliation");
  if (!teamSeasonResult.data) return null;

  const federationCountryId = teamSeasonResult.data.registration_country_id;
  const [countriesResult, previousSeasonResult] = await Promise.all([
    admin
      .from("countries")
      .select("id, iso_alpha2, name")
      .in("id", [team.home_country_id, federationCountryId])
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
  const unavailableReason = !hasAmateurIdentity
    ? "L’identité de l’équipe amateur doit d’abord être finalisée."
    : currentCountry.id === federationCountry.id
      ? "Votre équipe porte déjà la nationalité sportive de cette fédération."
      : !hasCompletedFederationSeason
        ? `Ce changement sera disponible en Saison ${season.game_year + 1} si votre équipe reste affiliée à cette fédération.`
        : alreadyChanged
          ? "Le changement de nationalité a déjà été utilisé cette saison."
          : null;

  return {
    currentCountryId: currentCountry.id,
    currentCountryCode: currentCountry.iso_alpha2,
    currentCountryName: currentCountry.name,
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
