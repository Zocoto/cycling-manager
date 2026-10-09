import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]> }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async () => ({ data: {}, error: null }),
    from: (table: string) => {
      const rows = () => fixtures.tables[table] ?? [];
      const query = {
        select: () => query, eq: () => query, gte: () => query,
        lte: () => query, order: () => query, limit: () => query,
        is: () => query, in: () => query,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        returns: async () => ({ data: rows(), error: null }),
      };
      return query;
    },
  }),
}));

import { getFederationGovernanceOverview } from "./federation-governance";

const context = { countryId: "rw", season: { id: "s4", gameYear: 4, currentDayNumber: 1 }, viewerTeamId: "kigali" };

describe("federation presidency without a fabricated election", () => {
  beforeEach(() => {
    fixtures.tables = {
      national_federation_terms: [{ governance_mode: "elected", president_director_id: "sevri", start_game_year: 3, end_game_year: 4 }],
      sporting_directors: [{ id: "sevri", display_name: "sevrinovitch" }],
      team_manager_assignments: [{ sporting_director_id: "sevri" }],
    };
  });
  it("shows the actual current mandate and presidential authority after a nomination", async () => {
    expect(await getFederationGovernanceOverview(context)).toMatchObject({
      phase: "automatic", termStartGameYear: 3, termEndGameYear: 4,
      presidentName: "sevrinovitch", viewerIsPresident: true,
      canApply: false, canVote: false, candidates: [], voteCount: 0,
    });
  });
  it("keeps the scheduled next election when no president exists", async () => {
    fixtures.tables.national_federation_terms = [];
    expect(await getFederationGovernanceOverview(context)).toMatchObject({
      phase: "scheduled", termStartGameYear: 5, termEndGameYear: 6,
      presidentName: null, viewerIsPresident: false,
    });
  });
  it("does not hide the regular next-mandate election behind the current appointment", async () => {
    fixtures.tables.national_federation_elections = [{
      id: "next-election", status: "applications", election_type: "regular",
      term_start_game_year: 5, term_end_game_year: 6, elected_director_id: null,
      applications_close_at: null, voting_close_at: null, created_at: "2026-10-29T12:00:00Z",
    }];
    expect(await getFederationGovernanceOverview(context)).toMatchObject({
      phase: "applications", termStartGameYear: 5, termEndGameYear: 6,
      presidentName: "sevrinovitch", viewerIsPresident: true,
    });
  });
});
