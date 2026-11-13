import { describe, expect, it } from "vitest";

import existingAssets from "@/data/pcm-existing-assets.json";
import galaAssets from "@/data/pcm-season-four-gala-assets.json";
import { applyExistingPcmAssetCodes, applySeasonFourGalaAssetCodes } from "./gala-asset-codes";
import { describePcmGraphics } from "./graphics-coverage";
import type { TeamRow } from "./types";

const team = (id: string, code: string | null): TeamRow => ({
  id,
  home_country_id: "country",
  pcm_export_id: 244,
  pcm_asset_code: code,
  amateur_jersey_primary_color: null,
  amateur_jersey_secondary_color: null,
});

describe("PCM installed graphical identities", () => {
  it("keeps every approved Gala S4 mapping in the universal pack", () => {
    for (const [id, code] of Object.entries(galaAssets.teamAssetCodes)) {
      expect(applyExistingPcmAssetCodes([team(id, "inferred")])[0].pcm_asset_code).toBe(code);
    }
  });

  it("restores older approved assets for the same club after a rename", () => {
    const olderClubId = Object.keys(existingAssets.teamAssetCodes)
      .find(id => !(id in galaAssets.teamAssetCodes))!;
    const source = { ...team(olderClubId, "new"), display_name: "Renamed club" };
    const result = applyExistingPcmAssetCodes([source]);
    expect(result[0].pcm_asset_code).toBe(
      existingAssets.teamAssetCodes[olderClubId as keyof typeof existingAssets.teamAssetCodes],
    );
    expect(source.pcm_asset_code).toBe("new");
    expect(result[0].display_name).toBe("Renamed club");
  });

  it("does not let an unknown club borrow a published team's jersey", () => {
    const unknown = team("not-in-pack", "ccr");
    expect(applyExistingPcmAssetCodes([unknown])).toEqual([{ ...unknown, pcm_asset_code: null }]);
    expect(applySeasonFourGalaAssetCodes).toBe(applyExistingPcmAssetCodes);
  });

  it("assigns every packaged club a unique three-letter code", () => {
    const codes = Object.values(existingAssets.teamAssetCodes);
    expect(codes).toHaveLength(49);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every(code => /^[a-z]{3}$/.test(code))).toBe(true);
  });

  it("looks up distinctives by the exact cooked variant on the rider's exported club", () => {
    const result = describePcmGraphics([
      { teamId: 244, teamName: "Abbaye du Lion", assetCode: "mov" },
      { teamId: 245, teamName: "Cumbre Coca Rush", assetCode: "ccr" },
    ], [
      { teamId: 244, riderId: 10001, championBits: 128 | 512, pcmCountryCode: "BEL" },
      { teamId: 245, riderId: 10002, championBits: -2048, pcmCountryCode: "COL" },
      { teamId: 245, riderId: 10003, championBits: 1024, pcmCountryCode: "COL" },
    ]);
    expect(result.distinctives).toMatchObject([
      { variant: "bel", custom: true }, { variant: "euro", custom: true },
      { variant: "world", custom: true }, { variant: "world_itt", custom: false },
    ]);
  });
});
