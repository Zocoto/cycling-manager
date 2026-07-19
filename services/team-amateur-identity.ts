import "server-only";

import {
  DEFAULT_AMATEUR_JERSEY,
  isAmateurJerseyPattern,
  normalizeHexColor,
  type AmateurJerseyConfig,
} from "@/lib/amateur-team";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TeamAmateurIdentity = {
  teamId: string;
  amateurName: string | null;
  homeCountryId: string;
  homeCountryName: string;
  homeCountryCode: string;
  jersey: AmateurJerseyConfig;
  isConfigured: boolean;
};

type SportingDirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type TeamRow = {
  id: string;
  home_country_id: string;
  amateur_name: string | null;
  amateur_jersey_pattern: string;
  amateur_jersey_primary_color: string;
  amateur_jersey_secondary_color: string;
  amateur_jersey_accent_color: string;
  amateur_identity_configured_at: string | null;
};
type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

export async function getTeamAmateurIdentityForAuthUser(
  authUserId: string
): Promise<TeamAmateurIdentity | null> {
  const normalizedAuthUserId = authUserId.trim();

  if (!normalizedAuthUserId) {
    throw new Error(
      "L’identifiant du joueur authentifié est obligatoire."
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: director, error: directorError } = await supabase
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", normalizedAuthUserId)
    .eq("status", "active")
    .maybeSingle<SportingDirectorRow>();

  if (directorError) {
    throw new Error(
      `Impossible de retrouver le Directeur Sportif : ${directorError.message}`
    );
  }

  if (!director) {
    return null;
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", director.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<AssignmentRow[]>();

  if (assignmentError) {
    throw new Error(
      `Impossible de retrouver l’équipe amateur : ${assignmentError.message}`
    );
  }

  const teamId = assignments?.[0]?.team_id;

  return teamId ? getTeamAmateurIdentity(teamId) : null;
}

export async function getTeamAmateurIdentity(
  teamId: string
): Promise<TeamAmateurIdentity | null> {
  const normalizedTeamId = teamId.trim();

  if (!normalizedTeamId) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select(
      `
        id,
        home_country_id,
        amateur_name,
        amateur_jersey_pattern,
        amateur_jersey_primary_color,
        amateur_jersey_secondary_color,
        amateur_jersey_accent_color,
        amateur_identity_configured_at
      `
    )
    .eq("id", normalizedTeamId)
    .maybeSingle<TeamRow>();

  if (teamError) {
    throw new Error(
      `Impossible de charger l’identité amateur : ${teamError.message}`
    );
  }

  if (!team) {
    return null;
  }

  const { data: country, error: countryError } = await supabase
    .from("countries")
    .select("id, name, iso_alpha2")
    .eq("id", team.home_country_id)
    .maybeSingle<CountryRow>();

  if (countryError || !country) {
    throw new Error(
      "Impossible de retrouver le pays d’affiliation de l’équipe."
    );
  }

  return {
    teamId: team.id,
    amateurName: team.amateur_name,
    homeCountryId: country.id,
    homeCountryName: country.name,
    homeCountryCode: country.iso_alpha2,
    jersey: toJerseyConfig(team),
    isConfigured: Boolean(
      team.amateur_identity_configured_at && team.amateur_name
    ),
  };
}

function toJerseyConfig(team: TeamRow): AmateurJerseyConfig {
  const pattern = isAmateurJerseyPattern(team.amateur_jersey_pattern)
    ? team.amateur_jersey_pattern
    : DEFAULT_AMATEUR_JERSEY.pattern;

  return {
    pattern,
    primaryColor:
      normalizeHexColor(team.amateur_jersey_primary_color) ??
      DEFAULT_AMATEUR_JERSEY.primaryColor,
    secondaryColor:
      normalizeHexColor(team.amateur_jersey_secondary_color) ??
      DEFAULT_AMATEUR_JERSEY.secondaryColor,
    accentColor:
      normalizeHexColor(team.amateur_jersey_accent_color) ??
      DEFAULT_AMATEUR_JERSEY.accentColor,
  };
}
