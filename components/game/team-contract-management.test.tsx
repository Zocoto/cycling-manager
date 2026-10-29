import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TeamContractManagement } from "./team-contract-management";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";
import type { TeamContractManagementOverview } from "@/services/team-contract-management";
import type { RiderRatings } from "@/lib/game/rider-profile";

vi.mock("@/app/jeu/effectif/actions", () => ({ renewAllTeamRiderContractsAction: vi.fn() }));
vi.mock("@/app/jeu/transferts/actions", () => ({ renewRiderContractAction: vi.fn() }));

const ratings: RiderRatings = {
  mountain: 60, hills: 62, flat: 72, timeTrial: 65, cobbles: 78,
  sprint: 58, acceleration: 64, downhill: 61, endurance: 70,
  resistance: 68, recovery: 59, breakaway: 55, prologue: 63,
};

const overview: TeamContractManagementOverview = {
  currentSeasonName: "S4", nextSeasonName: "S5", eligibleCount: 1, anticipatableCount: 0,
  securedCount: 0, leavingCount: 0, estimatedRenewalPayroll: 50000, projectedNextPayroll: 50000, currency: "EUR",
  riders: [{ id: "rider-test", firstName: "Claire", lastName: "Test", countryCode: "BE", countryName: "Belgique", avatarProfileKey: null, avatarSeed: 1, age: 25, potentialSteps: 5, ratings, overall: 70, status: "eligible", currentSalary: 40000, currentCurrency: "EUR", currentContractEndSeasonName: "S4", nextSalary: 50000, nextCurrency: "EUR", nextContractEndSeasonName: null, renewalOffers: [{ targetEndSeasonYear: 5, startSeasonYear: 5, salaryPerSeason: 50000, premiumPercent: 0 }] }],
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
    expect(html).toContain("25 ans");
    expect(html).toContain("2,5 étoiles");
    const summary = html.match(/<summary[\s\S]*?<\/summary>/)?.[0] ?? "";
    expect(summary).toContain("PAV 78 · PLA 72");
    expect(summary).toContain("BAR 55");
    expect(html).toContain('aria-label="Statistiques de Claire Test"');
    expect(html.match(/<dd/g)).toHaveLength(13);
    expect(html).toMatch(/<details class=/);
    expect(html).not.toMatch(/<details[^>]*\sopen(?:\s|=|>)/);
  });
  it("keeps departures non-renewable and supports an empty squad", () => {
    const html = renderToStaticMarkup(<TeamContractManagement overview={{ ...overview, eligibleCount: 0, leavingCount: 1, riders: [{ ...overview.riders[0], status: "leaving", renewalOffers: [] }] }} jersey={FREE_AGENT_RIDER_JERSEY} />);
    expect(html).toContain("Départ programmé");
    expect(html).not.toContain('name="riderId"');
    const empty = renderToStaticMarkup(<TeamContractManagement overview={{ ...overview, eligibleCount: 0, riders: [] }} jersey={FREE_AGENT_RIDER_JERSEY} />);
    expect(empty).toContain("Aucun coureur sous contrat actif");
  });
});
