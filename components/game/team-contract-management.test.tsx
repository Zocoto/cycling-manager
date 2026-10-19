import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TeamContractManagement } from "./team-contract-management";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";
import type { TeamContractManagementOverview } from "@/services/team-contract-management";

vi.mock("@/app/jeu/effectif/actions", () => ({ renewAllTeamRiderContractsAction: vi.fn() }));
vi.mock("@/app/jeu/transferts/actions", () => ({ renewRiderContractAction: vi.fn() }));

const overview: TeamContractManagementOverview = {
  currentSeasonName: "S4", nextSeasonName: "S5", eligibleCount: 1, anticipatableCount: 0,
  securedCount: 0, leavingCount: 0, estimatedRenewalPayroll: 50000, projectedNextPayroll: 50000, currency: "EUR",
  riders: [{ id: "rider-test", firstName: "Claire", lastName: "Test", countryCode: "BE", countryName: "Belgique", avatarProfileKey: null, avatarSeed: 1, age: 25, overall: 70, status: "eligible", currentSalary: 40000, currentCurrency: "EUR", currentContractEndSeasonName: "S4", nextSalary: 50000, nextCurrency: "EUR", nextContractEndSeasonName: null, renewalOffers: [{ targetEndSeasonYear: 5, startSeasonYear: 5, salaryPerSeason: 50000, premiumPercent: 0 }] }],
};

describe("responsive contract management", () => {
  it("uses the same single rider and decision form on mobile and desktop", () => {
    const html = renderToStaticMarkup(<TeamContractManagement overview={overview} jersey={FREE_AGENT_RIDER_JERSEY} />);
    expect(html.match(/name="riderId"/g)).toHaveLength(1);
    expect(html.match(/name="targetEndSeasonYear"/g)).toHaveLength(1);
    expect(html).toContain("lg:table-row");
    expect(html).toContain("lg:min-w-[1080px]");
    expect(html).toContain("Échéance actuelle");
    expect(html).toContain("Salaire actuel");
  });
  it("keeps departures non-renewable and supports an empty squad", () => {
    const html = renderToStaticMarkup(<TeamContractManagement overview={{ ...overview, eligibleCount: 0, leavingCount: 1, riders: [{ ...overview.riders[0], status: "leaving", renewalOffers: [] }] }} jersey={FREE_AGENT_RIDER_JERSEY} />);
    expect(html).toContain("Départ programmé");
    expect(html).not.toContain('name="riderId"');
    const empty = renderToStaticMarkup(<TeamContractManagement overview={{ ...overview, eligibleCount: 0, riders: [] }} jersey={FREE_AGENT_RIDER_JERSEY} />);
    expect(empty).toContain("Aucun coureur sous contrat actif");
  });
});
