import { BRETON_SPONSORS } from "@/data/sponsors/brittany";

const SPONSOR_IDS_BY_TEAM_IDENTITY: Readonly<Record<string, readonly string[]>> = {
  "en avant guidon": BRETON_SPONSORS.map((sponsor) => sponsor.id),
};

export function resolveRegionalSponsorPreference(
  historicalTeamNames: readonly string[],
): readonly string[] {
  for (const teamName of historicalTeamNames) {
    const sponsorIds =
      SPONSOR_IDS_BY_TEAM_IDENTITY[normalizeTeamIdentity(teamName)];

    if (sponsorIds) return sponsorIds;
  }

  return [];
}

function normalizeTeamIdentity(teamName: string): string {
  return teamName.trim().toLocaleLowerCase("fr-FR");
}
