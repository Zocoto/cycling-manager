import "server-only";

import { SPONSORS } from "@/data/sponsors";
import {
  DEFAULT_AMATEUR_JERSEY,
  isAmateurJerseyPattern,
  normalizeHexColor,
  type AmateurJerseyConfig,
} from "@/lib/amateur-team";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationTeamJerseyArtwork =
  | { kind: "sponsor"; imagePath: string }
  | { kind: "amateur"; jersey: AmateurJerseyConfig };

type TeamRow = {
  id: string;
  amateur_jersey_pattern: string;
  amateur_jersey_primary_color: string;
  amateur_jersey_secondary_color: string;
  amateur_jersey_accent_color: string;
};
type SponsorContractRow = {
  team_id: string;
  sponsor_id: string;
  selected_jersey_id: string | null;
  created_at: string;
};
type SponsorRow = { id: string; catalog_key: string };

export async function getFederationTeamJerseyArtworks(
  teamIds: string[],
): Promise<Record<string, FederationTeamJerseyArtwork>> {
  const uniqueTeamIds = [...new Set(teamIds.filter(Boolean))];
  if (uniqueTeamIds.length === 0) return {};

  const admin = createSupabaseAdminClient();
  const [teamsResult, contractsResult] = await Promise.all([
    admin
      .from("teams")
      .select(
        "id, amateur_jersey_pattern, amateur_jersey_primary_color, amateur_jersey_secondary_color, amateur_jersey_accent_color",
      )
      .in("id", uniqueTeamIds)
      .returns<TeamRow[]>(),
    admin
      .from("sponsor_contracts")
      .select("team_id, sponsor_id, selected_jersey_id, created_at")
      .in("team_id", uniqueTeamIds)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .returns<SponsorContractRow[]>(),
  ]);
  if (teamsResult.error) throw teamsResult.error;
  if (contractsResult.error) throw contractsResult.error;

  const contracts = contractsResult.data ?? [];
  const sponsorIds = [...new Set(contracts.map((contract) => contract.sponsor_id))];
  const sponsorsResult = sponsorIds.length
    ? await admin
        .from("sponsors")
        .select("id, catalog_key")
        .in("id", sponsorIds)
        .returns<SponsorRow[]>()
    : { data: [] as SponsorRow[], error: null };
  if (sponsorsResult.error) throw sponsorsResult.error;

  const teamById = new Map((teamsResult.data ?? []).map((team) => [team.id, team]));
  const sponsorById = new Map(
    (sponsorsResult.data ?? []).map((sponsor) => [sponsor.id, sponsor]),
  );
  const contractByTeamId = new Map<string, SponsorContractRow>();
  for (const contract of contracts) {
    if (!contractByTeamId.has(contract.team_id)) {
      contractByTeamId.set(contract.team_id, contract);
    }
  }

  return Object.fromEntries(
    uniqueTeamIds.map((teamId) => {
      const contract = contractByTeamId.get(teamId);
      const sponsorRegistry = contract ? sponsorById.get(contract.sponsor_id) : null;
      const sponsor = sponsorRegistry
        ? SPONSORS.find((candidate) => candidate.id === sponsorRegistry.catalog_key)
        : null;
      const jersey = sponsor
        ? sponsor.jerseys.find((candidate) => candidate.id === contract?.selected_jersey_id) ??
          sponsor.jerseys[0]
        : null;

      return [
        teamId,
        jersey?.imagePath
          ? { kind: "sponsor" as const, imagePath: jersey.imagePath }
          : { kind: "amateur" as const, jersey: getAmateurJersey(teamById.get(teamId)) },
      ];
    }),
  );
}

function getAmateurJersey(team: TeamRow | undefined): AmateurJerseyConfig {
  if (!team) return DEFAULT_AMATEUR_JERSEY;
  return {
    pattern: isAmateurJerseyPattern(team.amateur_jersey_pattern)
      ? team.amateur_jersey_pattern
      : DEFAULT_AMATEUR_JERSEY.pattern,
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
