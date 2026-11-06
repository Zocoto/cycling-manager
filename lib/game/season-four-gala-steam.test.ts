import { describe, expect, it } from "vitest";
import compatibility from "@/assets/pcm/gala-s4-steam-compatibility.json";
import { GALA_STEAM_DATABASE, validateSeasonFourGalaSteamCompatibility, type GalaSteamCompatibility } from "./season-four-gala-steam";
import type { GalaExportSnapshot } from "./season-four-gala-startlists";

function fixture(ids = [12532, 10501, 12739, 10438, 11614, 10565, 10713]): GalaExportSnapshot {
  return {
    season: 4,
    registrations: [{ id: "registration", team_id: "wolverine", program: "continental" }],
    selections: ids.map((id, index) => ({ registration_id: "registration", profile: "hills", rider_id: String(id), position: index + 1 })),
    teams: [{ id: "wolverine", pcm_export_id: 333, name: "TheWolverineCyclingTeam" }],
    riders: ids.map(id => ({ id: String(id), pcm_export_id: id, first_name: id === 12696 ? "Teklemariam" : id === 12828 ? "Jorge" : "Rider",
      last_name: id === 12696 ? "Mekonnen" : id === 12828 ? "Funk" : String(id), team_id: "wolverine",
      native: { mountain: 60, hills: 60, flat: 60, time_trial: 60, cobbles: 60, sprint: 60 } })),
  };
}

// Exact subset of the published 4 November v2 registry relevant to these cases.
// Keep this historical input even after the live Steam package is updated.
const steamV2: GalaSteamCompatibility = {
  title: "Cyclostratège S4 · Gala · 04/11/2026 15:36 · v2",
  workshopId: "3811779261", steamManifestId: "5096166018157259908",
  databaseSha256: "7d0d82d467d5d9c89aadac50de0352d0c3229755eb96d060b0bb9c0215adac22",
  teams: [333],
  riders: { "12532": 333, "10501": 333, "12739": 333, "10438": 333, "11614": 333, "10565": 333, "10713": 333 },
  races: {
    "25": { filename: "top_tdf", maxTeams: 23, minRiders: 7, maxRiders: 8 },
    "173": { filename: "topclas_maastricht", maxTeams: 25, minRiders: 7, maxRiders: 8 },
  },
};

describe("published Steam S4 gala compatibility", () => {
  it("pins the exact published Steam release", () => {
    expect(GALA_STEAM_DATABASE).toMatchObject({ workshopId: "3811779261", steamManifestId: "7757371739382865096",
      databaseSha256: "c078f18f0a0def91cda4e11b3b06edca4633c2734ed5e5b86c385c60fd18e0ae" });
    expect(Object.keys(compatibility.riders)).toHaveLength(847);
  });
  it("accepts the approved same-club lineup without mutating the input", () => {
    const snapshot = fixture(), before = structuredClone(snapshot);
    expect(() => validateSeasonFourGalaSteamCompatibility(snapshot, "continental:hills")).not.toThrow();
    expect(snapshot).toEqual(before);
  });
  it("rejects Mekonnen and Funk by name rather than producing a silently incomplete file", () => {
    const snapshot = fixture([12532, 10501, 12696, 10438, 11614, 12828, 10713]);
    expect(() => validateSeasonFourGalaSteamCompatibility(snapshot, undefined, steamV2)).toThrow(/Teklemariam Mekonnen.*Jorge Funk/);
  });
  it("checks only the requested event, so an unrelated invalid lineup cannot block a valid course", () => {
    const snapshot = fixture([12532, 10501, 12696, 10438, 11614, 12828, 10713]);
    const valid = fixture();
    snapshot.selections.push(...valid.selections.map(row => ({ ...row, profile: "mountain" as const })));
    snapshot.riders.push(...valid.riders.filter(row => !snapshot.riders.some(existing => existing.id === row.id)));
    expect(() => validateSeasonFourGalaSteamCompatibility(snapshot, "continental:mountain", steamV2)).not.toThrow();
    expect(() => validateSeasonFourGalaSteamCompatibility(snapshot, undefined, steamV2)).toThrow(/absent de la BDD Steam/);
  });
  it("rejects changed Steam team ownership and absent teams", () => {
    const snapshot = fixture();
    snapshot.teams[0].pcm_export_id = 307;
    expect(() => validateSeasonFourGalaSteamCompatibility(snapshot)).toThrow(/Club différent/);
    snapshot.teams[0].pcm_export_id = 999999;
    expect(() => validateSeasonFourGalaSteamCompatibility(snapshot)).toThrow(/Équipe absente/);
  });
  it("rejects wrong source seasons, missing identities and rosters outside Steam's 7–8 range", () => {
    expect(() => validateSeasonFourGalaSteamCompatibility({ ...fixture(), season: 5 })).toThrow(/saison 4/);
    const missing = fixture(); missing.riders.pop();
    expect(() => validateSeasonFourGalaSteamCompatibility(missing)).toThrow(/Coureur absent/);
    expect(() => validateSeasonFourGalaSteamCompatibility(fixture([12532]))).toThrow(/7 à 8/);
  });
  it("rejects filename or capacity drift from the published race configuration", () => {
    const steam: GalaSteamCompatibility = structuredClone(compatibility);
    const changed = { ...steam, races: { ...steam.races, "173": { ...steam.races["173"], filename: "wrong" } } };
    expect(() => validateSeasonFourGalaSteamCompatibility(fixture(), undefined, changed)).toThrow(/Paramètres de course/);
  });
});
