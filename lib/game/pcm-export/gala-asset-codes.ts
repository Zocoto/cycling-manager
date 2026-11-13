import assets from "@/data/pcm-existing-assets.json";
import { hasPcmWorkshopTeamKit } from "./graphics-coverage";
import type { TeamRow } from "./types";

const teamAssetCodes: Readonly<Record<string, string>> = assets.teamAssetCodes;

/** Resolve the installed pack by permanent club identity, never its current name. */
export function applyExistingPcmAssetCodes(teams: readonly TeamRow[]): TeamRow[] {
  return teams.map(team => {
    const code = Object.hasOwn(teamAssetCodes, team.id) ? teamAssetCodes[team.id] : null;
    if (code && !hasPcmWorkshopTeamKit(code)) {
      throw new Error(`Maillot ou mini-maillot PCM manquant pour l’équipe ${team.id} (${code}).`);
    }
    return team.pcm_asset_code === code ? team : { ...team, pcm_asset_code: code };
  });
}

/** Kept for the S4 exhibition callers; both export modes use the same pack. */
export const applySeasonFourGalaAssetCodes = applyExistingPcmAssetCodes;
