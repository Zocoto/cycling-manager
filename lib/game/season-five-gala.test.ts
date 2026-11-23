import { describe, expect, it } from "vitest";
import { GALA_COURSES, GALA_PROGRAM_PROFILES, SEASON_FOUR_GALA } from "./season-four-gala";
import { GALA_S5_COURSES, SEASON_FIVE_GALA } from "./season-five-gala";
import verifiedProfiles from "./season-five-gala-profiles.json";

const identities = [
  { id: "pt-zoncolan", program: "pro-tour", pcmRaceId: 135, stageFile: "top_giro_14_2021.cds", startlistFilename: "top_giro.xml" },
  { id: "pt-liege", program: "pro-tour", pcmRaceId: 87, stageFile: "topclas_lbl_2019.cds", startlistFilename: "topclas_lbl.xml" },
  { id: "pt-hamburg", program: "pro-tour", pcmRaceId: 26, stageFile: "topclas_hamburg_2023.cds", startlistFilename: "topclas_hamburg.xml" },
  { id: "ct-alpe", program: "continental", pcmRaceId: 25, stageFile: "top_tdf_12_2022.cds", startlistFilename: "top_tdf.xml" },
  { id: "ct-fleche", program: "continental", pcmRaceId: 15, stageFile: "topclas_fleche_2024.cds", startlistFilename: "topclas_fleche.xml" },
  { id: "ct-flanders", program: "continental", pcmRaceId: 11, stageFile: "topclas_rondevv_2024.cds", startlistFilename: "topclas_rondevv.xml" },
] as const;

describe("season five gala course proposals", () => {
  it("provides three Pro Tour and three Continental races with six native identities", () => {
    expect(GALA_S5_COURSES).toHaveLength(6);
    expect(GALA_S5_COURSES.filter(course => course.program === "pro-tour")).toHaveLength(3);
    expect(GALA_S5_COURSES.filter(course => course.program === "continental")).toHaveLength(3);
    expect(GALA_S5_COURSES.map(({ id, program, pcmRaceId, stageFile, startlistFilename }) => ({
      id, program, pcmRaceId, stageFile, startlistFilename,
    }))).toEqual(identities);

    for (const key of ["id", "name", "pcmName", "pcmRaceId", "stageFile", "startlistFilename"] as const) {
      expect(new Set(GALA_S5_COURSES.map(course => course[key])).size, key).toBe(6);
    }
  });

  it("uses separately verified stage metadata for every proposed course", () => {
    expect(Object.keys(verifiedProfiles.courses).sort()).toEqual(identities.map(course => course.id).sort());
    expect(verifiedProfiles.source).toMatchObject({
      game: "Pro Cycling Manager 2026",
      pak: "pakchunk1-Windows.pak",
      checkedOn: "2026-11-21",
    });
    expect(verifiedProfiles.source.databaseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(verifiedProfiles.source.elevationUnits).toContain("not physical metres");

    for (const identity of identities) {
      const course = GALA_S5_COURSES.find(candidate => candidate.id === identity.id)!;
      const metadata = verifiedProfiles.courses[identity.id];
      expect(course.verified, identity.id).toBe(true);
      expect(course).toMatchObject({
        pcmRaceId: metadata.pcmRaceId,
        pcmName: metadata.pcmName,
        startlistFilename: metadata.startlistFilename,
        stageFile: metadata.stageFile,
        nativeCapacity: metadata.nativeCapacity,
        distanceKm: metadata.distanceKm,
      });
      expect(metadata.pcmStageId).toBeGreaterThan(0);
      expect(Number.isSafeInteger(metadata.pcmStageId)).toBe(true);
      expect(metadata.stageFile).toMatch(/^[a-z0-9_]+\.cds$/);
      expect(metadata.sceneFile).toBe(metadata.stageFile.replace(/\.cds$/, ".zces"));
      expect(metadata.startlistFilename).toMatch(/^[a-z0-9_]+\.xml$/);
      expect(metadata.stageSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(metadata.nativeCapacity).toBeGreaterThan(1);
      expect(Number.isSafeInteger(metadata.nativeCapacity)).toBe(true);
      expect(metadata.nativeMinRiders).toBeGreaterThan(0);
      expect(metadata.nativeMaxRiders).toBeGreaterThanOrEqual(metadata.nativeMinRiders);
      expect(Number.isFinite(metadata.distanceKm)).toBe(true);
      expect(metadata.distanceKm).toBeGreaterThan(0);
    }
    expect(new Set(Object.values(verifiedProfiles.courses).map(course => course.stageSha256)).size).toBe(6);
    expect(new Set(Object.values(verifiedProfiles.courses).map(course => course.pcmStageId)).size).toBe(6);
  });

  it("keeps six distinct real altitude curves even when terrain labels repeat", () => {
    expect(new Set(GALA_S5_COURSES.map(course => JSON.stringify(course.elevation))).size).toBe(6);
    expect(GALA_S5_COURSES.filter(course => course.profile === "Montagne")).toHaveLength(2);
    expect(GALA_S5_COURSES.filter(course => course.profile === "Vallons")).toHaveLength(2);

    for (const identity of identities) {
      const course = GALA_S5_COURSES.find(candidate => candidate.id === identity.id)!;
      expect(course.elevation, identity.id).toEqual(verifiedProfiles.courses[identity.id].elevation);
      expect(course.elevation.length).toBeGreaterThan(100);
      expect(course.elevation.length).toBeLessThanOrEqual(194);
      expect(course.elevation[0][0]).toBe(0);
      expect(course.elevation.at(-1)![0]).toBe(1);
      expect(course.elevation.every(([position, height], index, points) => (
        Number.isFinite(position) && Number.isFinite(height)
        && position >= 0 && position <= 1
        && (index === 0 || position > points[index - 1][0])
      )), identity.id).toBe(true);
      const heights = course.elevation.map(([, height]) => height);
      expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights));
    }
  });

  it("keeps the S4 archive and its source season independent from S5", () => {
    expect(SEASON_FOUR_GALA.sourceSeason).toBe(4);
    expect(SEASON_FOUR_GALA.route).toBe("/jeu/gala-saison-4");
    expect(GALA_PROGRAM_PROFILES).toEqual({
      "world-tour": ["mountain", "hills", "cobbles"],
      continental: ["mountain", "hills", "sprint"],
    });
    expect(Object.values(GALA_COURSES).map(course => ({ raceId: course.raceId, filename: course.filename }))).toEqual([
      { raceId: 25, filename: "top_tdf_18_2022" },
      { raceId: 173, filename: "topclas_maastricht_2018" },
      { raceId: 4, filename: "topclas_roubaix_2018" },
      { raceId: 105, filename: "c0_classiquedunkerque_2025" },
    ]);
    const archivedStages = new Set(Object.values(GALA_COURSES).map(course => course.filename));
    for (const course of GALA_S5_COURSES) {
      expect(archivedStages.has(course.stageFile!.replace(/\.cds$/, "")), course.id).toBe(false);
    }
    expect(SEASON_FIVE_GALA).toMatchObject({
      route: "/jeu/gala-saison-5",
      sourceSeason: 5,
      nextSeason: 6,
      continentalCap: 75,
      isRegistrationOpen: true,
      registrationClosesAt: "2026-12-03T17:00:00.000Z",
    });
  });

  it("sets the official deadline to 3 December at 18:00 in Paris", () => {
    expect(new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short",
    }).format(new Date(SEASON_FIVE_GALA.registrationClosesAt))).toBe("03/12/2026 18:00");
    expect(SEASON_FIVE_GALA.registrationDeadlineLabel).toBe("Jeudi 3 décembre à 18 h (heure de Paris)");
  });
});
