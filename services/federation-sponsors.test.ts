import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSponsorsByCountryCode } from "@/data/sponsors/catalog-utils";

const mocks = vi.hoisted(() => {
  function createQuery(result: unknown) {
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
      returns: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.returns.mockResolvedValue(result);
    return query;
  }

  const contractQuery = createQuery({
    data: [
      { sponsor_id: "registry-fr-1" },
      { sponsor_id: "registry-fr-2" },
      { sponsor_id: "registry-fr-2" },
      { sponsor_id: "registry-be" },
    ],
    error: null,
  });
  const sponsorQuery = createQuery({ data: [], error: null });

  return {
    contractQuery,
    sponsorQuery,
    from: vi.fn((table: string) =>
      table === "team_sponsor_contracts" ? contractQuery : sponsorQuery,
    ),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.from }),
}));

import { getFederationSponsorCoverage } from "@/services/federation-sponsors";

describe("federation sponsor coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const frenchSponsors = getSponsorsByCountryCode("FR");
    const belgianSponsor = getSponsorsByCountryCode("BE")[0];
    mocks.sponsorQuery.returns.mockResolvedValue({
      data: [
        { id: "registry-fr-1", catalog_key: frenchSponsors[0].id },
        { id: "registry-fr-2", catalog_key: frenchSponsors[1].id },
        { id: "registry-be", catalog_key: belgianSponsor.id },
      ],
      error: null,
    });
  });

  it("compte une seule fois les sponsors nationaux actifs des équipes affiliées", async () => {
    await expect(
      getFederationSponsorCoverage({
        countryCode: "fr",
        teamIds: [" team-a ", "team-b", "team-b"],
      }),
    ).resolves.toEqual({
      affiliatedSponsorCount: 2,
      availableSponsorCount: getSponsorsByCountryCode("FR").length,
    });

    expect(mocks.contractQuery.in).toHaveBeenCalledWith("team_id", [
      "team-a",
      "team-b",
    ]);
    expect(mocks.contractQuery.eq).toHaveBeenCalledWith("role", "principal");
    expect(mocks.contractQuery.eq).toHaveBeenCalledWith("status", "active");
  });

  it("retourne la capacité nationale sans requête lorsqu’aucune équipe n’est affiliée", async () => {
    await expect(
      getFederationSponsorCoverage({ countryCode: "BE", teamIds: [] }),
    ).resolves.toEqual({
      affiliatedSponsorCount: 0,
      availableSponsorCount: getSponsorsByCountryCode("BE").length,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
