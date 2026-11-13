import inventory from "@/data/pcm-workshop-graphics.json";
import { PCM_CHAMPIONSHIP_MASKS } from "./types";

export const WORKSHOP_TEAM_ASSET_CODES = [...new Set([
  ...inventory.jerseyCodes, ...inventory.miniCodes, ...Object.keys(inventory.variants),
])];

const jerseys = new Set(inventory.jerseyCodes);
const minis = new Set(inventory.miniCodes);
const variants: Readonly<Record<string, readonly string[]>> = inventory.variants;
const titles = Object.keys(PCM_CHAMPIONSHIP_MASKS) as (keyof typeof PCM_CHAMPIONSHIP_MASKS)[];

export function hasPcmWorkshopTeamKit(code: string) {
  return jerseys.has(code) && minis.has(code);
}

export function describePcmGraphics(
  teams: readonly { teamId: number; teamName: string; assetCode: string }[],
  champions: readonly { teamId: number; riderId: number; championBits: number; pcmCountryCode: string }[],
) {
  const teamKits = teams.map(team => ({ ...team, custom: hasPcmWorkshopTeamKit(team.assetCode) }));
  const codesById = new Map(teamKits.map(team => [team.teamId, team.assetCode]));
  const distinctives = champions.flatMap(({ teamId, riderId, championBits, pcmCountryCode }) => {
    const assetCode = codesById.get(teamId);
    if (!assetCode) throw new Error(`Équipe PCM ${teamId} absente pour le champion ${riderId}.`);
    return titles.flatMap(title => {
      if (!(championBits & PCM_CHAMPIONSHIP_MASKS[title])) return [];
      const variant = title === "world_road" ? "world"
        : title === "world_time_trial" ? "world_itt"
        : title === "continental_europe_road" ? "euro"
        : title === "continental_europe_time_trial" ? "euro_itt"
        : pcmCountryCode.toLowerCase();
      return [{ teamId, riderId, title, assetCode, variant, custom: variants[assetCode]?.includes(variant) ?? false }];
    });
  });
  return { sourceWorkshopManifest: inventory.sourceWorkshopManifest, teamKits, distinctives };
}
