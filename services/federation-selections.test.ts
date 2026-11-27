import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdmin: vi.fn(), forecasts: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("@/services/federation-selection-weather", () => ({ getFederationSelectionForecasts: mocks.forecasts }));

import { getFederationSelectionState } from "./federation-selections";

type Row = Record<string, unknown>;
type ResponseStatus = "draft" | "pending" | "confirmed" | "declined" | "ineligible";

function fixture({
  gameYear = 5,
  slotKey = "nc-hills",
  junior = false,
  responses = { gor: "confirmed", ruslan: "declined" },
}: {
  gameYear?: number;
  slotKey?: string;
  junior?: boolean;
  responses?: Record<string, ResponseStatus>;
} = {}) {
  const tables: Record<string, Row[]> = {
    national_federation_selection_lists: [{ id: "colombia-hills", country_id: "co", season_id: "season", slot_key: slotKey, status: "finalized", revision: 2 }],
    national_federation_terms: [],
    national_federation_selection_preferences: [{ country_id: "co", season_id: "season", automatic_selection: true }],
    national_federation_hosting_awards: [],
    national_federation_selection_slots: [{ slot_key: slotKey, competition_code: junior ? "world_championship_junior" : "nations_cup", rider_category: junior ? "junior" : "professional" }],
    national_federation_olympic_qualifications: [{ country_id: "co", season_id: "season", rider_quota: 3, time_trial_rider_quota: 2 }],
    national_federation_selection_members: Object.entries(responses).map(([riderId, response]) => ({
      id: `member-${riderId}`, selection_list_id: "colombia-hills", professional_rider_id: junior ? null : riderId,
      junior_rider_id: junior ? riderId : null, owner_team_id: "owner-team", response_status: response,
    })),
  };
  const from = vi.fn((table: string) => {
    let matching = [...(tables[table] ?? [])];
    const query = {
      select() { return query; },
      eq(column: string, value: unknown) { matching = matching.filter(row => row[column] === value); return query; },
      lte(column: string, value: number) { matching = matching.filter(row => Number(row[column]) <= value); return query; },
      gte(column: string, value: number) { matching = matching.filter(row => Number(row[column]) >= value); return query; },
      in(column: string, values: unknown[]) { matching = matching.filter(row => values.includes(row[column])); return query; },
      async returns() { return { data: matching, error: null }; },
      async maybeSingle() { return { data: matching[0] ?? null, error: null }; },
    };
    return query;
  });
  const rpc = vi.fn(() => ({ select: () => ({ returns: async () => ({ data: [], error: null }) }) }));
  mocks.createAdmin.mockReturnValue({ from, rpc });
  mocks.forecasts.mockResolvedValue({});
  return {
    tables,
    load: () => getFederationSelectionState({countryId: "co", seasonId: "season", gameYear, currentDayNumber: 22, viewerTeamId: null}),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("federation selections after a refused call-up", () => {
  it("shows only Gor as selected in S5 Colombia hills after Ruslan declined, retaining both responses", async () => {
    const f = fixture();
    const before = structuredClone(f.tables);
    const result = await f.load();
    expect(result.selections["nc-hills"]).toEqual({
      status: "finalized", revision: 2, riderIds: ["gor"], confirmedRiderIds: ["gor"],
      responses: {gor: "confirmed", ruslan: "declined"},
    });
    expect(f.tables).toEqual(before);
  });

  it.each([4, 5, 6, 8])("keeps draft/pending/confirmed choices while excluding refused and ineligible members in S%i", async gameYear => {
    const f = fixture({ gameYear, responses: {draft: "draft", pending: "pending", confirmed: "confirmed", refused: "declined", ineligible: "ineligible"} });
    const result = await f.load();
    expect(result.selections["nc-hills"].riderIds).toEqual(["draft", "pending", "confirmed"]);
    expect(result.selections["nc-hills"].confirmedRiderIds).toEqual(["confirmed"]);
    expect(result.selections["nc-hills"].responses).toEqual({draft: "draft", pending: "pending", confirmed: "confirmed", refused: "declined", ineligible: "ineligible"});
    if (gameYear % 4 === 0) {
      expect(result.olympicQuota).toBe(3);
      expect(result.olympicTimeTrialQuota).toBe(2);
    }
  });

  it("applies the same selection rule to junior identities without losing the refusal history", async () => {
    const f = fixture({slotKey: "world-junior-road", junior: true});
    const result = await f.load();
    expect(result.selections["world-junior-road"]?.riderIds).toEqual(["gor"]);
    expect(result.selections["world-junior-road"]?.confirmedRiderIds).toEqual(["gor"]);
    expect(result.selections["world-junior-road"]?.responses?.ruslan).toBe("declined");
  });
});
