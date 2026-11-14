import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDashboardFederationConstructionOpportunity } from "./dashboard-federation-construction";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

type DashboardProject = {
  infrastructure_code: string;
  completes_game_day_index: number;
  completes_at: string | null;
};

const context = { teamSeasonId: "team-season", sportingDirectorId: "president", seasonId: "season" };
const row = {
  season: { game_year: 5, current_day_number: 8 },
  country: {
    id: "federation",
    iso_alpha2: "BE",
    terms: [{ start_game_year: 5, end_game_year: 6 }],
    levels: [
      { infrastructure_code: "national_detection_network", level: 1 },
      { infrastructure_code: "national_performance_center", level: 5 },
      { infrastructure_code: "national_technical_laboratory", level: 1 },
    ],
    projects: [
      { infrastructure_code: "federal_staff_institute", completes_game_day_index: 146, completes_at: null },
      { infrastructure_code: "federal_medical_network", completes_game_day_index: 147, completes_at: null },
      { infrastructure_code: "race_organization_office", completes_game_day_index: 147, completes_at: null },
      { infrastructure_code: "home_advantage_program", completes_game_day_index: 146, completes_at: null },
    ] satisfies DashboardProject[],
  },
};

function mockRead(data: typeof row | null, balance = "2000000.01", reservedAmount = "300000.01") {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  const budget = {
    abortSignal: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { balance, reserved_amount: reservedAmount }, error: null,
    }),
  };
  const client = { from: vi.fn().mockReturnValue(query), rpc: vi.fn().mockReturnValue(budget) };
  vi.mocked(createSupabaseAdminClient).mockReturnValueOnce(
    client as unknown as ReturnType<typeof createSupabaseAdminClient>,
  );
  return { client, query };
}

describe("dashboard federation construction", () => {
  it("shows affordable projects once all active projects are due, skipping levels awaiting settlement", async () => {
    const { client, query } = mockRead(row);

    expect(await getDashboardFederationConstructionOpportunity(context)).toEqual({
      countryCode: "be",
      projects: [
        { code: "national_detection_network", name: "Réseau national de détection", targetLevel: 2, cost: 1_700_000 },
        { code: "federal_integration_office", name: "Bureau fédéral d’intégration", targetLevel: 1, cost: 1_200_000 },
      ],
    });
    expect(client.from).toHaveBeenCalledExactlyOnceWith("team_seasons");
    expect(query.eq.mock.calls).toEqual([
      ["id", "team-season"],
      ["season_id", "season"],
      ["season.status", "active"],
      ["country.is_active", true],
      ["country.terms.governance_mode", "elected"],
      ["country.terms.president_director_id", "president"],
      ["country.projects.status", "active"],
    ]);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("get_national_federation_hosting_budget", {
      p_country_id: "federation", p_season_id: "season",
    });
  });

  it("waits for the delivery time on the completion day", async () => {
    const { client } = mockRead({
      ...row,
      country: {
        ...row.country,
        projects: [{
          infrastructure_code: "national_technical_laboratory",
          completes_game_day_index: 147,
          completes_at: new Date(Date.now() + 37 * 60_000).toISOString(),
        }],
      },
    });

    await expect(getDashboardFederationConstructionOpportunity(context)).resolves.toBeNull();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("skips the budget read while any active project is still in progress", async () => {
    const { client } = mockRead({
      ...row,
      country: {
        ...row.country,
        projects: [
          ...row.country.projects,
          { infrastructure_code: "national_technical_laboratory", completes_game_day_index: 148, completes_at: null },
        ],
      },
    });

    await expect(getDashboardFederationConstructionOpportunity(context)).resolves.toBeNull();
    expect(client.from).toHaveBeenCalledExactlyOnceWith("team_seasons");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...row, country: { ...row.country, terms: [{ start_game_year: 3, end_game_year: 4 }] } },
  ])("skips the budget read without a current elected mandate", async (data) => {
    const { client } = mockRead(data);
    await expect(getDashboardFederationConstructionOpportunity(context)).resolves.toBeNull();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("omits an alert if the projects would consume reserved money", async () => {
    mockRead(row, "2000000.00", "800000.01");
    await expect(getDashboardFederationConstructionOpportunity(context)).resolves.toBeNull();
  });
});
