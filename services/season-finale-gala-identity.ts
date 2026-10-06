import "server-only";

import { SPONSORS } from "@/data/sponsors";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PcmExportSnapshot } from "@/lib/game/pcm-export/types";
import { createSponsoredRiderJersey } from "@/lib/rider-jersey";

export type SeasonFinaleGalaIdentity = {
  team_id: string;
  identity_season: number;
  team_name: string;
  team_short_name: string;
  team_country_code: string;
  registration_country_id: string;
  sponsor_catalog_key: string | null;
  jersey_id: string | null;
  jersey_style: string | null;
  identity_ready: boolean;
};

export async function loadSeasonFinaleGalaSourceSeason(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await supabase.rpc("get_season_finale_gala_export_context");
  const season = ((data ?? []) as Array<{ id: string; game_year: number }>)[0];
  if (error || !season) throw new Error(`Saison du gala introuvable : ${error?.message ?? "aucune donnée"}`);
  return season;
}

export async function loadSeasonFinaleGalaIdentities(
  supabase: ReturnType<typeof createSupabaseAdminClient>, teamIds: string[],
) {
  const identities = new Map<string, SeasonFinaleGalaIdentity>();
  for (let start = 0; start < teamIds.length; start += 100) {
    const { data, error } = await supabase.rpc("get_pcm_gala_team_identities", {
      p_team_ids: teamIds.slice(start, start + 100),
    });
    if (error) throw new Error(`Impossible de charger les identités du gala : ${error.message}`);
    for (const identity of (data ?? []) as SeasonFinaleGalaIdentity[]) identities.set(identity.team_id, identity);
  }
  return identities;
}

export function getSeasonFinaleGalaJersey(identity: SeasonFinaleGalaIdentity | null | undefined) {
  const sponsor = SPONSORS.find((item) => item.id === identity?.sponsor_catalog_key);
  const jersey = sponsor?.jerseys.find((item) => item.id === identity?.jersey_id);
  return sponsor && jersey ? createSponsoredRiderJersey({
    colors: sponsor.colors, style: jersey.style, imagePath: jersey.imagePath,
  }) : null;
}

// Only the in-memory PCM copy is changed, never the current team_seasons rows.
export function applySeasonFinaleGalaIdentities(
  snapshot: PcmExportSnapshot, identities: Map<string, SeasonFinaleGalaIdentity>,
): PcmExportSnapshot {
  return {
    ...snapshot,
    teamSeasons: snapshot.teamSeasons.map((team) => {
      const identity = identities.get(team.team_id);
      return identity?.identity_ready ? { ...team, display_name: identity.team_name,
        short_name: identity.team_short_name, registration_country_id: identity.registration_country_id } : { ...team };
    }),
    teams: snapshot.teams.map((team) => {
      const identity = identities.get(team.id);
      const sponsor = SPONSORS.find((item) => item.id === identity?.sponsor_catalog_key);
      return sponsor && identity?.identity_ready ? { ...team,
        amateur_jersey_primary_color: sponsor.colors.primary,
        amateur_jersey_secondary_color: sponsor.colors.secondary } : { ...team };
    }),
  };
}
