import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GALA_S5_COURSES } from "./season-five-gala";
import { parseSeasonFiveGalaPublicStartlistsPayload } from "./season-five-gala-public-startlists";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
function fixture(teams = 1) {
  return {
    editionId: id(1), sourceSeason: 5, targetGameYear: 6, closesAt: "2026-12-03T17:00:00+00:00",
    courses: GALA_S5_COURSES.map((course, courseIndex) => ({
      eventKey: course.id, program: course.program,
      teams: courseIndex === 0 ? Array.from({ length: teams }, (_, teamIndex) => ({
        teamId: id(100 + teamIndex), name: `Source team ${teamIndex}`, futureName: `Future team ${teamIndex}`,
        identityReady: true, sponsorCatalogKey: null, jerseyId: null, jerseyStyle: null,
        amateurJersey: { pattern: "classic", primaryColor: "#123456", secondaryColor: "#ABCDEF", accentColor: "#FEDCBA" },
        riders: Array.from({ length: 7 }, (_, index) => ({ riderId: id(10000 + teamIndex * 8 + index), firstName: "Same", lastName: "Name", position: index + 1 })),
      })) : [],
    })),
  };
}

describe("S5 public startlist snapshot parser", () => {
  it("accepts the six courses, empty startlists and distinct homonyms", () => {
    const parsed = parseSeasonFiveGalaPublicStartlistsPayload(fixture());
    expect(parsed?.courses).toHaveLength(6);
    expect(parsed?.courses[0].teams[0].riders).toHaveLength(7);
    expect(parsed?.courses[1].teams).toEqual([]);
  });
  it("does not truncate an edition exceeding 50 teams and 1,000 selected riders", () => {
    const parsed = parseSeasonFiveGalaPublicStartlistsPayload(fixture(151));
    expect(parsed?.courses[0].teams).toHaveLength(151);
    expect(parsed?.courses[0].teams.reduce((count, team) => count + team.riders.length, 0)).toBe(1057);
  });
  it("strips account, finance, native ratings and unknown fields throughout the payload", () => {
    const raw = fixture();
    Object.assign(raw, { auth_user_id: id(999), balance: 90000 });
    Object.assign(raw.courses[0].teams[0], { contracts: [], budget: 10000 });
    Object.assign(raw.courses[0].teams[0].riders[0], { mountain: 99, primary_snapshot: { mountain: 75 } });
    const parsed = parseSeasonFiveGalaPublicStartlistsPayload(raw);
    expect(parsed).not.toHaveProperty("auth_user_id");
    expect(parsed?.courses[0].teams[0]).not.toHaveProperty("contracts");
    expect(parsed?.courses[0].teams[0].riders[0]).not.toHaveProperty("mountain");
  });
  it.each(["season", "edition", "date", "missing-course", "duplicate-course", "program", "short-roster", "position-hole", "duplicate-rider", "duplicate-team", "two-programs", "two-clubs"])("rejects malformed %s data", issue => {
    const raw = fixture();
    const course = raw.courses[0]; const team = course.teams[0];
    if (issue === "season") raw.sourceSeason = 6;
    if (issue === "edition") raw.editionId = "invalid";
    if (issue === "date") raw.closesAt = "not-a-date";
    if (issue === "missing-course") raw.courses.pop();
    if (issue === "duplicate-course") raw.courses[1].eventKey = course.eventKey;
    if (issue === "program") course.program = "continental";
    if (issue === "short-roster") team.riders.pop();
    if (issue === "position-hole") team.riders[0].position = 8;
    if (issue === "duplicate-rider") team.riders[0].riderId = team.riders[1].riderId;
    if (issue === "duplicate-team") course.teams.push(structuredClone(team));
    if (issue === "two-programs") raw.courses[3].teams.push(structuredClone(team));
    if (issue === "two-clubs") course.teams.push({ ...structuredClone(team), teamId: id(501) });
    expect(parseSeasonFiveGalaPublicStartlistsPayload(raw)).toBeNull();
  });
  it("allows a team's same riders on multiple races of its locked programme", () => {
    const raw = fixture(); raw.courses[1].teams.push(structuredClone(raw.courses[0].teams[0]));
    expect(parseSeasonFiveGalaPublicStartlistsPayload(raw)?.courses[1].teams).toHaveLength(1);
  });
  it("keeps the client payload module independent of the sponsor catalog and server services", () => {
    const source = readFileSync("lib/game/season-five-gala-public-startlists.ts", "utf8");
    expect(source).not.toContain("@/data/sponsors");
    expect(source).not.toContain("@/services/");
  });
});
