import { describe, expect, it, vi } from "vitest";
import { SPONSORS } from "@/data/sponsors";
import { DEFAULT_AMATEUR_JERSEY } from "@/lib/amateur-team";
import { GALA_S5_COURSES } from "@/lib/game/season-five-gala";
import { getSeasonFiveGalaPublicStartlists } from "./season-five-gala-public-startlists";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
function fixture(teams = 1) {
  return {
    editionId: id(1), sourceSeason: 5, targetGameYear: 6, closesAt: "2026-12-03T17:00:00Z",
    courses: GALA_S5_COURSES.map((course, courseIndex) => ({ eventKey: course.id, program: course.program,
      teams: courseIndex === 0 ? Array.from({ length: teams }, (_, teamIndex) => ({
        teamId: id(100 + teamIndex), name: "Source team", futureName: "Confirmed S6 team", identityReady: true,
        sponsorCatalogKey: null as string | null, jerseyId: null as string | null, jerseyStyle: null as string | null,
        amateurJersey: { pattern: "diagonal", primaryColor: "#aabbcc", secondaryColor: "#ddeeff", accentColor: "#123456" },
        riders: Array.from({ length: 7 }, (_, position) => ({ riderId: id(10000 + teamIndex * 8 + position), firstName: "Rider", lastName: String(position), position: position + 1 })),
      })) : [],
    })),
  };
}
function clientFor(data: unknown, error: { message: string } | null = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn(() => ({ abortSignal }));
  return { client: { rpc } as unknown as Parameters<typeof getSeasonFiveGalaPublicStartlists>[0], rpc, abortSignal };
}

describe("S5 public startlist adapter", () => {
  it("uses one authenticated RPC and keeps every team without additional queries", async () => {
    const { client, rpc, abortSignal } = clientFor(fixture(151));
    const result = await getSeasonFiveGalaPublicStartlists(client);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_season_five_gala_startlists");
    expect(abortSignal).toHaveBeenCalledExactlyOnceWith(expect.any(AbortSignal));
    expect(result.courses[0].teams).toHaveLength(151);
    expect(result.courses[0].teams.flatMap(team => team.riders)).toHaveLength(1057);
  });
  it("uses the selected future jersey, strips raw catalog fields and defaults only within that sponsor", async () => {
    const sponsor = SPONSORS.find(candidate => candidate.jerseys.length >= 2)!;
    const raw = fixture(); const team = raw.courses[0].teams[0];
    team.sponsorCatalogKey = sponsor.id; team.jerseyId = sponsor.jerseys[1].id;
    const first = await getSeasonFiveGalaPublicStartlists(clientFor(raw).client);
    expect(first.courses[0].teams[0].jersey).toEqual({ kind: "sponsor", imagePath: sponsor.jerseys[1].imagePath });
    expect(first.courses[0].teams[0]).not.toHaveProperty("sponsorCatalogKey");
    expect(first.courses[0].teams[0]).not.toHaveProperty("jerseyId");
    team.jerseyId = "unknown-selected-variant";
    const fallback = await getSeasonFiveGalaPublicStartlists(clientFor(raw).client);
    expect(fallback.courses[0].teams[0].jersey).toEqual({ kind: "sponsor", imagePath: sponsor.jerseys[0].imagePath });
  });
  it("normalizes amateur colors and falls back safely when artwork metadata is unavailable", async () => {
    const raw = fixture(); const team = raw.courses[0].teams[0];
    const first = await getSeasonFiveGalaPublicStartlists(clientFor(raw).client);
    expect(first.courses[0].teams[0].jersey).toEqual({ kind: "amateur", jersey: { pattern: "diagonal", primaryColor: "#AABBCC", secondaryColor: "#DDEEFF", accentColor: "#123456" } });
    team.sponsorCatalogKey = "unknown-sponsor"; team.jerseyId = "unknown-jersey";
    team.amateurJersey = { pattern: "not-supported", primaryColor: "red", secondaryColor: "", accentColor: "url(unsafe)" };
    const fallback = await getSeasonFiveGalaPublicStartlists(clientFor(raw).client);
    expect(fallback.courses[0].teams[0].jersey).toEqual({ kind: "amateur", jersey: DEFAULT_AMATEUR_JERSEY });
  });
  it.each(["rpc-error", "malformed", "null", "network"])("fails closed for %s without publishing an empty success", async reason => {
    const mock = clientFor(reason === "malformed" ? { courses: [] } : reason === "null" ? null : fixture(), reason === "rpc-error" ? { message: "database unavailable" } : null);
    if (reason === "network") mock.abortSignal.mockRejectedValue(new Error("timeout"));
    await expect(getSeasonFiveGalaPublicStartlists(mock.client)).rejects.toThrow("Impossible de charger les engagés");
  });
  it("reads a fresh edition after withdrawal instead of retaining the previous startlist", async () => {
    const before = fixture(); const after = fixture(0);
    const mock = clientFor(before);
    const first = await getSeasonFiveGalaPublicStartlists(mock.client);
    mock.abortSignal.mockResolvedValue({ data: after, error: null });
    const second = await getSeasonFiveGalaPublicStartlists(mock.client);
    expect(first.courses[0].teams).toHaveLength(1);
    expect(second.courses.every(course => course.teams.length === 0)).toBe(true);
    expect(mock.rpc).toHaveBeenCalledTimes(2);
  });
});
