import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  client: null as unknown,
  getRankings: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => fixture.client }));
vi.mock("@/services/uci-rankings", () => ({ getUciRankings: fixture.getRankings }));
import { getFederationObjectiveMetrics } from "./federation-objectives";
import type { UciRankings } from "./uci-rankings";

const source = readFileSync(
  resolve(process.cwd(), "services/federation-objectives.ts"),
  "utf8",
);

function rankings(seasonId = "season"): UciRankings {
  const team = (teamId: string, rank: number): UciRankings["teams"][number] => ({
    teamId, rank, teamName: teamId, directorName: null, directorUsername: null,
    points: 100, division: "amateur", isProfessional: false, projectedDivision: "amateur",
    jerseyArtwork: { kind: "sponsor", imagePath: "/test-jersey.png" },
  });
  const rider = (countryCode: string, rank: number): UciRankings["riders"][number] => ({
    countryCode, rank, riderId: `rider-${countryCode}`, riderName: countryCode,
    avatarProfileKey: null, avatarSeed: null, age: 25, teamId: null, teamName: null,
    countryName: countryCode, points: 100,
    jersey: { primaryColor: "#ffffff", secondaryColor: "#000000", accentColor: "#888888", pattern: "solid", status: "free-agent" },
  });
  return {
    seasonId, seasonName: "S4", nations: [], rookies: [],
    teams: [team("other", 2), team("member", 7)],
    riders: [rider("DE", 1), rider("FR", 4)],
  };
}

const input = {
  countryId: "01", seasonId: "season", gameYear: 4,
  currentMemberTeamCount: 2, countryCode: "fr", memberTeamIds: ["member"],
};

beforeEach(() => {
  fixture.getRankings.mockReset();
  const query = () => {
    const result = { data: [], count: 0, error: null };
    const builder = {
      select: () => builder, eq: () => builder, in: () => builder, not: () => builder,
      maybeSingle: async () => ({ data: { id: "previous-season" }, error: null }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  };
  fixture.client = { from: query, rpc: query };
});

describe("federation objective metrics", () => {
  it("compte la preuve durable de soumission manuelle sans dépendre du mode courant", () => {
    expect(source).toContain(
      '.not("manually_submitted_at", "is", null)',
    );
    expect(source).not.toContain(
      '.not("created_by_director_id", "is", null)',
    );
    expect(source).toContain(
      '.in("status", ["pending_confirmation", "finalized"])',
    );
    expect(source).not.toContain("if (naturalizations.error) throw naturalizations.error");
    expect(source).toContain("publishedSelections.error");
    expect(source).toContain("publishedSelections.count ?? 0");
  });

  it.each(["01", "02"])("reuses the render snapshot for UCI objective variant %s", async (countryId) => {
    fixture.getRankings.mockRejectedValue(new Error("must not reload the provided snapshot"));
    const metrics = await getFederationObjectiveMetrics({ ...input, countryId, uciRankings: rankings() });
    expect(metrics).toMatchObject({ teamUciRank: 7, riderUciRank: 4 });
    expect(fixture.getRankings).not.toHaveBeenCalled();
  });

  it("keeps an explicitly unavailable snapshot without fetching it again", async () => {
    const metrics = await getFederationObjectiveMetrics({ ...input, uciRankings: null });
    expect(metrics).toMatchObject({ teamUciRank: null, riderUciRank: null });
    expect(fixture.getRankings).not.toHaveBeenCalled();
  });

  it("loads rankings for existing callers that do not provide a snapshot", async () => {
    fixture.getRankings.mockResolvedValue(rankings());
    const metrics = await getFederationObjectiveMetrics(input);
    expect(metrics).toMatchObject({ teamUciRank: 7, riderUciRank: 4 });
    expect(fixture.getRankings).toHaveBeenCalledTimes(1);
  });

  it("ignores rankings from another season", async () => {
    const metrics = await getFederationObjectiveMetrics({ ...input, uciRankings: rankings("another-season") });
    expect(metrics).toMatchObject({ teamUciRank: null, riderUciRank: null });
    expect(fixture.getRankings).not.toHaveBeenCalled();
  });

  it("does not reuse a different federation's membership or rider nationality", async () => {
    const metrics = await getFederationObjectiveMetrics({
      ...input, countryCode: "BE", memberTeamIds: ["unranked"], uciRankings: rankings(),
    });
    expect(metrics).toMatchObject({ teamUciRank: null, riderUciRank: null });
    expect(fixture.getRankings).not.toHaveBeenCalled();
  });
});
