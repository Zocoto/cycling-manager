import "server-only";

import { SPONSORS } from "@/data/sponsors";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TeamSponsorIdentity } from "@/services/team-sponsor-identity";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type GameHeaderSnapshot = {
  display_name: string | null;
  team_id: string | null;
  team_name: string | null;
  team_short_name: string | null;
  sponsor_catalog_key: string | null;
  selected_jersey_id: string | null;
  budget_per_season: number | string | null;
  currency_code: string | null;
  contract_duration_seasons: number | null;
};

export type GameHeaderData = {
  displayName: string | undefined;
  teamSponsorIdentity: TeamSponsorIdentity | null;
};

export async function getGameHeaderData(
  supabase: SupabaseServerClient,
  _authUserId: string
): Promise<GameHeaderData> {
  // Conservé dans la signature pour éviter de dupliquer la résolution de
  // session dans les pages ; l'identité est vérifiée dans la RPC via auth.uid().
  void _authUserId;

  const response = await supabase.rpc("get_current_game_header_snapshot");
  const data = response.data as GameHeaderSnapshot | null;
  const { error } = response;

  if (error) {
    throw new Error(
      `Impossible de charger le header de jeu : ${error.message}`
    );
  }

  return {
    displayName: data?.display_name ?? undefined,
    teamSponsorIdentity: toTeamSponsorIdentity(data),
  };
}

function toTeamSponsorIdentity(
  snapshot: GameHeaderSnapshot | null
): TeamSponsorIdentity | null {
  if (
    !snapshot?.team_id ||
    !snapshot.team_name ||
    !snapshot.sponsor_catalog_key ||
    !snapshot.selected_jersey_id ||
    !snapshot.currency_code ||
    !snapshot.contract_duration_seasons
  ) {
    return null;
  }

  const sponsor = SPONSORS.find(
    (candidate) => candidate.id === snapshot.sponsor_catalog_key
  );
  const selectedJersey = sponsor?.jerseys.find(
    (jersey) => jersey.id === snapshot.selected_jersey_id
  );
  const budgetPerSeason = Number(snapshot.budget_per_season);

  if (!sponsor || !selectedJersey || !Number.isFinite(budgetPerSeason)) {
    return null;
  }

  return {
    teamId: snapshot.team_id,
    teamName: snapshot.team_name,
    teamShortName: snapshot.team_short_name,
    sponsor,
    selectedJersey,
    budgetPerSeason,
    currencyCode: snapshot.currency_code,
    contractDurationSeasons: snapshot.contract_duration_seasons,
  };
}
