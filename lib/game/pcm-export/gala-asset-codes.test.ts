import { describe, expect, it } from "vitest";

import existingAssets from "@/data/pcm-existing-assets.json";
import galaAssets from "@/data/pcm-season-four-gala-assets.json";
import { applyExistingPcmAssetCodes, applySeasonFourGalaAssetCodes } from "./gala-asset-codes";
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

  it("preserves unknown clubs and uses one mapping for normal and gala exports", () => {
    const unknown = team("not-in-pack", "abc");
    expect(applyExistingPcmAssetCodes([unknown])).toEqual([unknown]);
    expect(applySeasonFourGalaAssetCodes).toBe(applyExistingPcmAssetCodes);
  });

  it("assigns every packaged club a unique three-letter code", () => {
    const codes = Object.values(existingAssets.teamAssetCodes);
    expect(codes).toHaveLength(49);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every(code => /^[a-z]{3}$/.test(code))).toBe(true);
  });
});
