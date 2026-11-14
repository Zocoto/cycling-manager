import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FederationInfrastructureCatalog } from "@/components/game/federation-infrastructure-catalog";
import type { FederationInfrastructureProjectState, FederationInfrastructureState } from "@/services/federation-infrastructures";

vi.mock("@/app/jeu/federations/infrastructure-actions", () => ({
  contributeArchitectToFederationProjectAction: async () => undefined,
  requestFederationSponsorCreationAction: async () => undefined,
  startFederationSchoolCyclingPlanAction: async () => undefined,
  startFederationInfrastructureProjectAction: async () => undefined,
  updateFederationProjectPriorityAction: async () => undefined,
}));
vi.mock("@/components/game/infrastructure-specialization-panel", () => ({
  InfrastructureSpecializationPanel: () => null,
}));

const project: FederationInfrastructureProjectState = {
  id: "detection-project",
  code: "national_detection_network",
  targetLevel: 1,
  priority: "balanced",
  baseCost: 450_000,
  finalCost: 450_000,
  baseDurationDays: 6,
  finalDurationMinutes: 8_640,
  remainingMinutes: 4_320,
  architectCount: 0,
  architects: [],
  viewerTeamHasContributed: false,
};

function renderCatalog(activeProjects: FederationInfrastructureState["activeProjects"]) {
  return renderToStaticMarkup(
    <FederationInfrastructureCatalog countryCode="FR" managementLocked={false} infrastructureState={{
      levels: {},
      activeProjects,
      availableArchitects: [{ contractId: "architect", firstName: "Camille", lastName: "Martin", level: 2, specialty: "Équilibré" }],
      canLaunch: true,
      canContribute: true,
      canManageSpecializations: false,
      gameYear: 5,
      balance: 10_000_000,
      specializations: {},
      schoolCyclingPlan: null,
      sponsorCreationJobs: [],
    }} />,
  );
}

function launchButtons(markup: string) {
  return [...markup.matchAll(/<button\b[^>]*>Lancer le niveau \d+<\/button>/g)].map(([button]) => button);
}

describe("limite des chantiers fédéraux", () => {
  it("laisse le président lancer un chantier si le créneau est libre", () => {
    const markup = renderCatalog([]);
    const launches = launchButtons(markup);
    expect(markup).toContain("Un seul chantier à la fois par fédération.");
    expect(launches.length).toBeGreaterThan(0);
    expect(launches.some(button => button.includes(' disabled=""'))).toBe(false);
  });

  it("bloque tous les nouveaux lancements et conserve les chantiers existants avec leurs architectes", () => {
    const secondProject = { ...project, id: "medical-project", code: "federal_medical_network" } as const;
    const markup = renderCatalog([project, secondProject]);
    expect(markup).toContain('name="projectId" value="detection-project"');
    expect(markup).toContain('name="projectId" value="medical-project"');
    expect(markup).toContain("Un chantier est déjà en cours dans cette fédération.");
    const launches = launchButtons(markup);
    expect(launches.length).toBeGreaterThan(0);
    expect(launches.every(button => button.includes(' disabled=""'))).toBe(true);
    const contributions = [...markup.matchAll(/<button\b[^>]*>Affecter au chantier<\/button>/g)].map(([button]) => button);
    expect(contributions).toHaveLength(2);
    expect(contributions.some(button => button.includes(' disabled=""'))).toBe(false);
  });

  it("autorise un autre bâtiment à la date de livraison sans masquer le suivi", () => {
    const markup = renderCatalog([{ ...project, remainingMinutes: 0 }]);
    const launches = launchButtons(markup);
    expect(markup).toContain("Livraison imminente");
    expect(markup).not.toContain("Un chantier est déjà en cours dans cette fédération.");
    expect(launches.length).toBeGreaterThan(0);
    expect(launches.some(button => button.includes(' disabled=""'))).toBe(false);
  });

  it("affiche les minutes et les centimes réellement gagnés", () => {
    const markup = renderCatalog([{
      ...project,
      finalCost: 449_999.58,
      finalDurationMinutes: 8_381,
      remainingMinutes: 37,
      architectCount: 1,
      architects: [{
        contractId: "architect",
        name: "Camille Martin",
        level: 2,
        specialty: "Équilibré",
        teamId: "club",
        teamName: "Club",
        costRefund: 0.42,
        savedMinutes: 259,
      }],
    }]);

    expect(markup).toContain("37 min");
    expect(markup).toContain("5 j 19 h 41 min");
    expect(markup).toMatch(/\+0,42\s€ · −4 h 19 min/);
    expect(launchButtons(markup).every(button => button.includes(' disabled=""'))).toBe(true);
  });
});
