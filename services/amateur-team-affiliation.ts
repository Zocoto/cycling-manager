import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AmateurTeamAffiliationState = {
  currentCountryId: string | null;
  currentCountryCode: string | null;
  currentCountryName: string | null;
  canChange: boolean;
  unavailableReason: string | null;
};

type TeamRow = {
  home_country_id: string;
  amateur_name: string | null;
};

type SeasonRow = { id: string };
type TeamSeasonRow = { registration_country_id: string };
type CountryRow = { iso_alpha2: string; name: string };

export async function getAmateurTeamAffiliationState(
  teamId: string | null,
): Promise<AmateurTeamAffiliationState | null> {
  if (!teamId) return null;

  const admin = createSupabaseAdminClient();
  const [seasonResult, teamResult, sponsorResult] = await Promise.all([
    admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
    admin
      .from("teams")
      .select("home_country_id, amateur_name")
      .eq("id", teamId)
      .maybeSingle<TeamRow>(),
    admin
      .from("team_sponsor_contracts")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("role", "principal")
      .in("status", ["active", "planned"]),
  ]);

  assertQuery(seasonResult.error, "la saison active");
  assertQuery(teamResult.error, "l’identité de l’équipe");
  assertQuery(sponsorResult.error, "le statut amateur de l’équipe");
  if (!seasonResult.data || !teamResult.data) return null;

  const [teamSeasonResult, countryResult, changeResult] = await Promise.all([
    admin
      .from("team_seasons")
      .select("registration_country_id")
      .eq("team_id", teamId)
      .eq("season_id", seasonResult.data.id)
      .maybeSingle<TeamSeasonRow>(),
    admin
      .from("countries")
      .select("iso_alpha2, name")
      .eq("id", teamResult.data.home_country_id)
      .maybeSingle<CountryRow>(),
    admin
      .from("team_national_affiliation_changes")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("season_id", seasonResult.data.id),
  ]);

  assertQuery(teamSeasonResult.error, "l’affiliation sportive de l’équipe");
  assertQuery(countryResult.error, "le pays d’affiliation de l’équipe");
  assertQuery(changeResult.error, "l’historique des changements d’affiliation");

  const hasSponsor = (sponsorResult.count ?? 0) > 0;
  const alreadyChanged = (changeResult.count ?? 0) > 0;
  const hasAmateurIdentity = Boolean(teamResult.data.amateur_name);
  const unavailableReason = !hasAmateurIdentity
    ? "L’identité de l’équipe amateur doit d’abord être finalisée."
    : hasSponsor
      ? "L’affiliation ne peut plus être transférée après la signature d’un sponsor principal."
      : alreadyChanged
        ? "Le transfert d’affiliation a déjà été utilisé cette saison."
        : null;

  return {
    currentCountryId:
      teamSeasonResult.data?.registration_country_id ??
      teamResult.data.home_country_id,
    currentCountryCode: countryResult.data?.iso_alpha2 ?? null,
    currentCountryName: countryResult.data?.name ?? null,
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
