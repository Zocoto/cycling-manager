import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  notices: [{ source_reference: "special:award", trophy_kind: "achievement" }],
  selectionWins: [] as Array<Record<string, unknown>>,
  seasons: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc(name: string, args: unknown) {
      mocks.calls.push({ table: name, method: "rpc", args: [args] });
      const query: Record<string, unknown> = {};
      for (const method of ["order", "range"]) {
        query[method] = () => query;
      }
      query.returns = () => Promise.resolve({ data: mocks.selectionWins, error: null });
      return query;
    },
    from(table: string) {
      const result = () => ({ data: table === "sporting_director_trophy_notifications" ? mocks.notices : table === "seasons" ? mocks.seasons : [], error: null, count: 0 });
      const query: Record<string, unknown> = {
        then(resolve: (value: unknown) => void) { resolve(result()); },
      };
      for (const method of ["select", "eq", "is", "order", "limit", "range", "in"]) {
        query[method] = (...args: unknown[]) => { mocks.calls.push({ table, method, args }); return query; };
      }
      query.returns = () => Promise.resolve(result());
      query.maybeSingle = () => Promise.resolve({ data: { id: "director-own" }, error: null });
      return query;
    },
  }),
}));

import { getPublicSportingDirectorTrophyGallery, getSportingDirectorTrophyGallery } from "@/services/trophy-gallery";

beforeEach(() => { mocks.calls.length = 0; mocks.selectionWins = []; mocks.seasons = []; });

describe("private trophy arrival lookup", () => {
  it("scopes unread notices to the authenticated director, bounds results and only reads small columns", async () => {
    const gallery = await getSportingDirectorTrophyGallery("auth-own");
    expect(gallery.unseenAwards).toEqual([{ sourceReference: "special:award", kind: "achievement" }]);
    expect(mocks.calls).toContainEqual({ table: "sporting_directors", method: "eq", args: ["auth_user_id", "auth-own"] });
    expect(mocks.calls.filter((call) => call.table === "sporting_director_trophy_notifications")).toEqual([
      { table: "sporting_director_trophy_notifications", method: "select", args: ["source_reference, trophy_kind"] },
      { table: "sporting_director_trophy_notifications", method: "eq", args: ["sporting_director_id", "director-own"] },
      { table: "sporting_director_trophy_notifications", method: "is", args: ["seen_at", null] },
      { table: "sporting_director_trophy_notifications", method: "order", args: ["awarded_at", { ascending: false }] },
      { table: "sporting_director_trophy_notifications", method: "order", args: ["id", { ascending: false }] },
      { table: "sporting_director_trophy_notifications", method: "limit", args: [100] },
    ]);
  });
  it("never fetches private notifications for a public profile", async () => {
    const gallery = await getPublicSportingDirectorTrophyGallery("00000000-0000-4000-8000-000000000001");
    expect(gallery.unseenAwards).toBeUndefined();
    expect(mocks.calls.some((call) => call.table === "sporting_director_trophy_notifications")).toBe(false);
  });
  it("does not query without an authenticated user id", async () => {
    await getSportingDirectorTrophyGallery(" ");
    expect(mocks.calls).toEqual([]);
  });

  it("shows historical international selection titles even without a club assignment", async () => {
    mocks.seasons = [{
      id: "season-3", game_year: 3, name: "Saison 3", status: "completed",
      starts_on: "2026-09-01", ends_on: "2026-09-28",
    }];
    mocks.selectionWins = [{
      id: "selection-result", race_slug: "cc-europe-road", race_name: "Championnat continental",
      season_id: "season-3", won_at: "2026-09-20T16:00:00Z", rider_name: "Fixture Winner",
      competition_type: "continental_championship",
    }];
    const gallery = await getSportingDirectorTrophyGallery("auth-own");
    expect(gallery.counts.championships).toBe(1);
    expect(gallery.trophies[0]).toMatchObject({
      kind: "continental_championship", seasonName: "Saison 3", riderName: "Fixture Winner",
    });
    expect(mocks.calls).toContainEqual({
      table: "get_sporting_director_selection_trophy_wins", method: "rpc",
      args: [{ p_sporting_director_id: "director-own" }],
    });
  });

  it("uses the requested director for public selection trophies", async () => {
    const directorId = "00000000-0000-4000-8000-000000000001";
    await getPublicSportingDirectorTrophyGallery(directorId);
    expect(mocks.calls).toContainEqual({
      table: "get_sporting_director_selection_trophy_wins", method: "rpc",
      args: [{ p_sporting_director_id: directorId }],
    });
  });
});
