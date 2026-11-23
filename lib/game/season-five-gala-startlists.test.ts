import { describe, expect, it } from "vitest";
import { makeGalaS5Fixture } from "./__test-fixtures__/season-five-gala";
import { buildSeasonFiveGalaStartlists, selectSeasonFiveGalaContracts } from "./season-five-gala-startlists";
import { createSeasonFiveGalaStartlistInstaller } from "./season-five-gala-installer";

const hash = "b".repeat(64);
describe("S5 gala startlists bound to the exact source database", () => {
  it.each([7, 8])("preserves a %i-rider registration, observer and confirmed S6 name", count => {
    const { source, snapshot } = makeGalaS5Fixture(1, count);
    const result = buildSeasonFiveGalaStartlists(source, snapshot, hash);
    expect(result.manifest).toMatchObject({ galaEdition: "season-five", sourceSeason: 5, identitySeason: 6, databaseSha256: hash, snapshotSha256: snapshot.sha256 });
    expect(Object.keys(result.files)).toEqual(["Pro-Tour/top_giro.xml"]);
    expect(result.files["Pro-Tour/top_giro.xml"]).toContain('<team id="243">');
    expect(result.files["Pro-Tour/top_giro.xml"].match(/<cyclist /g)).toHaveLength(count + 7);
    expect(result.manifest.events[0]).toMatchObject({ groupCount: 1, nativeCapacity: 23, clubCapacity: 22, teams: [{ team: "S6 Team 0000" }] });
  });
  it.each([["pt-zoncolan", 22], ["pt-liege", 24], ["pt-hamburg", 23], ["ct-alpe", 22], ["ct-fleche", 24], ["ct-flanders", 24]])("balances every registered team on %s within %i club slots", (course, capacity) => {
    const { source, snapshot } = makeGalaS5Fixture(51, 8, course);
    const result = buildSeasonFiveGalaStartlists(source, snapshot, hash);
    const groups = result.manifest.events as { teams: { teamId: string }[]; clubCapacity: number }[];
    expect(groups).toHaveLength(Math.ceil(51 / capacity));
    expect(groups.every(group => group.teams.length <= capacity && group.clubCapacity === capacity)).toBe(true);
    expect(new Set(groups.flatMap(group => group.teams.map(team => team.teamId))).size).toBe(51);
    expect(groups.reduce((total, group) => total + group.teams.length, 0)).toBe(51);
  });
  it("keeps Continental admission and later native progression without clipping", () => {
    const { source, snapshot } = makeGalaS5Fixture(1, 7, "ct-flanders");
    expect(snapshot.ratings[0].mountain).toBe(79);
    const before = structuredClone(snapshot.ratings);
    expect(buildSeasonFiveGalaStartlists(source, snapshot, hash).manifest.events).toHaveLength(1);
    expect(snapshot.ratings).toEqual(before);
    source.admissions[0].primary_snapshot.mountain = 76;
    expect(() => buildSeasonFiveGalaStartlists(source, snapshot, hash)).toThrow("admission");
  });
  it.each([6, 9])("rejects %i riders instead of truncating", count => {
    const { source, snapshot } = makeGalaS5Fixture(1, count);
    expect(() => buildSeasonFiveGalaStartlists(source, snapshot, hash)).toThrow("7–8");
  });
  it("rejects missing IDs, position holes, duplicate riders and source ownership mismatches", () => {
    for (const corruption of ["id", "position", "duplicate", "owner"] as const) {
      const { source, snapshot } = makeGalaS5Fixture();
      if (corruption === "id") snapshot.riders[0].pcm_export_id = 9001;
      if (corruption === "position") source.selections[0].position = 8;
      if (corruption === "duplicate") source.selections[0].rider_id = source.selections[1].rider_id;
      if (corruption === "owner") snapshot.contracts[0].team_id = "another-club";
      expect(() => buildSeasonFiveGalaStartlists(source, snapshot, hash)).toThrow();
    }
  });
  it("rejects S4 or mutable/unconfirmed identity metadata", () => {
    const { source, snapshot } = makeGalaS5Fixture();
    source.identities[0].identity_ready = false;
    expect(() => buildSeasonFiveGalaStartlists(source, snapshot, hash)).toThrow("S6 identity");
    source.identities[0].identity_ready = true;
    source.events[0].startlist_filename = "top_tdf.xml";
    expect(() => buildSeasonFiveGalaStartlists(source, snapshot, hash)).toThrow("course metadata");
    snapshot.galaEdition = "season-four";
    expect(() => buildSeasonFiveGalaStartlists(source, snapshot, hash)).toThrow("S5 source");
  });
  it("retains an expired S5 contract across S6 rollover and excludes a S6-only recruit", () => {
    const { source, snapshot } = makeGalaS5Fixture();
    const registered = new Map([[source.selections[0].rider_id, source.entries[0].team_id]]);
    const expired = snapshot.contracts[0];
    const future = { ...expired, id: "future", rider_id: "future-rider", start_season_id: "s6", end_season_id: "s6", status: "active" };
    const released = { ...expired, status: "terminated", left_season_id: "s6" };
    const selected = selectSeasonFiveGalaContracts([released, future], snapshot.seasons, registered);
    expect(selected).toEqual([released]);
  });
  it("ships an edition-aware installer that verifies the database and selected group", () => {
    const script = createSeasonFiveGalaStartlistInstaller();
    expect(script).toContain("$audit.galaEdition -cne 'season-five'");
    expect(script).toContain("$_.eventKey -ceq $Course -and $_.groupNumber -eq $Groupe");
    expect(script).toContain("$entry.sha256");
    expect(script).toContain("-LiteralPath");
    expect(script).not.toContain("topclas_maastricht");
  });
});
