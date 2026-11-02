import assets from "@/data/pcm-season-four-gala-assets.json";
import type { TeamRow } from "./types";

const teamAssetCodes: Readonly<Record<string, string>> = assets.teamAssetCodes;

/** Package-specific identities for exhibition copies, never live team records. */
export function applySeasonFourGalaAssetCodes(teams: readonly TeamRow[]): TeamRow[] {
  return teams.map(team => {
    const code = teamAssetCodes[team.id];
    return code ? { ...team, pcm_asset_code: code } : team;
  });
}
