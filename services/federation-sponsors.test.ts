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

function expectedSponsors(countryCode: string) {
  return getSponsorsByCountryCode(countryCode)
    .map(({ id, name, sector, logoPath, colors }) => ({
      id, name, sector, logoPath,
      colors: { primary: colors.primary, background: colors.background, text: colors.text },
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

describe("federation sponsor coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contractQuery.returns.mockResolvedValue({
      data: [
        { sponsor_id: "registry-fr-1" },
        { sponsor_id: "registry-fr-2" },
        { sponsor_id: "registry-fr-2" },
        { sponsor_id: "registry-be" },
      ],
      error: null,
    });
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
      sponsors: expectedSponsors("FR"),
    });

    expect(mocks.contractQuery.in).toHaveBeenCalledWith("team_id", [
      "team-a",
      "team-b",
    ]);
    expect(mocks.contractQuery.eq).toHaveBeenCalledWith("role", "principal");
    expect(mocks.contractQuery.eq).toHaveBeenCalledWith("status", "active");
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "team_sponsor_contracts", "sponsors",
    ]);
  });

  it("retourne la capacité nationale sans requête lorsqu’aucune équipe n’est affiliée", async () => {
    await expect(
      getFederationSponsorCoverage({ countryCode: "BE", teamIds: [] }),
    ).resolves.toEqual({
      affiliatedSponsorCount: 0,
      availableSponsorCount: getSponsorsByCountryCode("BE").length,
      sponsors: expectedSponsors("BE"),
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("inclut le catalogue même sans contrat actif, sans requête supplémentaire", async () => {
    mocks.contractQuery.returns.mockResolvedValue({ data: [], error: null });
    const result = await getFederationSponsorCoverage({ countryCode: " be ", teamIds: ["team-a"] });
    expect(result.sponsors).toEqual(expectedSponsors("BE"));
    expect(result.sponsors).toHaveLength(result.availableSponsorCount);
    expect(result.affiliatedSponsorCount).toBe(0);
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["team_sponsor_contracts"]);
    expect(result.sponsors[0]).not.toHaveProperty("jerseys");
    expect(result.sponsors[0]).not.toHaveProperty("description");
    expect(result.sponsors[0]).not.toHaveProperty("budgetRange");
  });

  it("gère un catalogue national vide sans inventer de sponsors", async () => {
    await expect(getFederationSponsorCoverage({ countryCode: "ZZ", teamIds: [] })).resolves.toEqual({
      affiliatedSponsorCount: 0, availableSponsorCount: 0, sponsors: [],
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("ne masque pas une erreur de lecture des contrats", async () => {
    mocks.contractQuery.returns.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(getFederationSponsorCoverage({ countryCode: "FR", teamIds: ["team-a"] })).rejects.toThrow("unavailable");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
