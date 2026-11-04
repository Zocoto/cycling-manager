import assets from "@/data/pcm-existing-assets.json";
import type { TeamRow } from "./types";

const teamAssetCodes: Readonly<Record<string, string>> = assets.teamAssetCodes;

/** Resolve the installed pack by permanent club identity, never its current name. */
export function applyExistingPcmAssetCodes(teams: readonly TeamRow[]): TeamRow[] {
  return teams.map(team => {
    const code = teamAssetCodes[team.id];
    return code ? { ...team, pcm_asset_code: code } : team;
  });
}

/** Kept for the S4 exhibition callers; both export modes use the same pack. */
export const applySeasonFourGalaAssetCodes = applyExistingPcmAssetCodes;
