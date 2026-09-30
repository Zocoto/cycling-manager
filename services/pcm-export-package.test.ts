import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";

import type { PcmExportResult } from "@/lib/game/pcm-export/types";
import { createPcmExportPackage } from "@/services/pcm-export-package";

describe("pack d'installation PCM26", () => {
  it("contient un dossier Cyclostratege directement copiable dans Mod", async () => {
    const source = createSource();
    const result = await createPcmExportPackage(source);
    const files = unzipSync(result.archive);

    expect(Object.keys(files).sort()).toEqual(
      [
        "Cyclostratege/LISEZ-MOI.txt",
        "Cyclostratege/OfficialLocal.cdb",
        "Cyclostratege/OfficialRelease.cdb",
        "Cyclostratege/manifest.json",
        "Cyclostratege/mod.xml",
        "Cyclostratege/validation.json",
      ].sort(),
    );
    expect(files["Cyclostratege/OfficialRelease.cdb"]).toEqual(source.cdb);
    expect(files["Cyclostratege/OfficialLocal.cdb"].byteLength).toBe(2_001_159);
    expect(strFromU8(files["Cyclostratege/mod.xml"])).toContain(
      "<Title>Cyclostratège</Title>",
    );
    expect(strFromU8(files["Cyclostratege/LISEZ-MOI.txt"])).toContain(
      "%APPDATA%\\Pro Cycling Manager 2026\\Mod\\",
    );
    expect(result.filename).toBe("Cyclostratege-PCM26-S3.zip");
    expect(result.archiveSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

function createSource(): PcmExportResult {
  return {
    cdb: new Uint8Array([1, 2, 3, 4]),
    metadata: {
      generatedAt: "2026-09-30T18:00:00.000Z",
      season: 3,
      snapshotSha256: "a".repeat(64),
      outputSha256: "b".repeat(64),
      filename: "OfficialRelease.cdb",
      bytes: 4,
      counts: { teams: 108, riders: 1341, sponsors: 108, contracts: 1341 },
      divisionCounts: { "10": 30, "11": 20, "12": 58 },
      ratingScale: {
        version: 1,
        method: "global-linear-population",
        population: "all active contracted riders in the exported season",
        csMinimum: 35,
        csMaximum: 81,
        pcmMinimum: 50,
        pcmMaximum: 85,
        coefficient: 35 / 46,
      },
      ratingRange: { minimum: 50, maximum: 85 },
      countryFallbacks: [],
      scope: {
        nativeRatingsOnly: true,
        bonusesIncluded: false,
        graphicalAssetsIncluded: false,
        existingPcmContentPreserved: true,
      },
    },
  };
}
