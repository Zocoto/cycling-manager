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
        "LISEZ-MOI.txt",
        "OfficialLocal.cdb",
        "OfficialRelease.cdb",
        "manifest.json",
        "mod.xml",
        "validation.json",
      ].sort(),
    );
    expect(files["OfficialRelease.cdb"]).toEqual(source.cdb);
    expect(files["OfficialLocal.cdb"].byteLength).toBe(2_001_159);
    expect(strFromU8(files["mod.xml"])).toContain(
      "<Title>Cyclostratège</Title>",
    );
    expect(strFromU8(files["LISEZ-MOI.txt"])).toContain(
      "%APPDATA%\\Pro Cycling Manager 2026\\Mod\\",
    );
    expect(strFromU8(files["LISEZ-MOI.txt"])).toContain(
      "Cyclostratege-PCM26-S3\\OfficialRelease.cdb",
    );
    expect(strFromU8(files["LISEZ-MOI.txt"])).toContain(
      "dix coureurs Simulo",
    );
    expect(Object.keys(files).every((name) => !name.includes("/"))).toBe(true);
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
      counts: { teams: 109, riders: 1351, sponsors: 109, contracts: 1351 },
      divisionCounts: { "10": 30, "11": 20, "12": 59 },
      ratingScale: {
        version: 2,
        method: "fixed-linear-absolute",
        population: "theoretical Cyclostratege scale from 0 to 100",
        csMinimum: 0,
        csMaximum: 100,
        pcmMinimum: 45,
        pcmMaximum: 85,
        coefficient: 0.4,
      },
      ratingRange: { minimum: 59, maximum: 77 },
      countryFallbacks: [],
      scope: {
        nativeRatingsOnly: true,
        bonusesIncluded: false,
        graphicalAssetsIncluded: false,
        existingPcmContentPreserved: false,
        originalProfessionalTeamsRemoved: true,
        spectatorTeamIncluded: true,
      },
    },
  };
}
