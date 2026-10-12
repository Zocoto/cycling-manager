import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { calculateStaffAcademyTraining } from "@/lib/game/staff-academy";
import type { StaffAcademyOverview, StaffAcademyTraining } from "@/services/staff-academy";
import { StaffAcademyCard } from "./staff-academy-card";

vi.mock("@/app/jeu/infrastructures/actions", () => ({
  startInfrastructureProjectAction: () => undefined,
  startStaffAcademyTrainingAction: () => undefined,
  chooseStaffAcademyTalentAction: () => undefined,
}));

function academy(educators = 1): StaffAcademyOverview {
  return {
    academyLevel: 1,
    baseCapacity: 1,
    capacity: 1,
    activeTrainingCount: 0,
    educatorBonuses: {
      activeEducatorCount: educators,
      costReductionPercentage: 25,
      durationReductionPercentage: 15,
      extraCapacity: 0,
    },
    activeTrainings: [],
    pendingTalentChoices: [],
    recentTrainings: [],
    members: [{
      contractId: "contract-1", memberId: "member-1",
      firstName: "Jean", lastName: "Test", fullName: "Jean Test",
      role: "mechanic", roleLabel: "Mécanicien", level: 1,
      trainerSpecialty: null, trainerSpecialtyLabel: null,
      talents: [], availableTalentLabels: ["Roues"],
      levelTraining: calculateStaffAcademyTraining({ improvementType: "level", staffLevel: 1, talentCount: 0 }),
      talentTraining: calculateStaffAcademyTraining({ improvementType: "talent", staffLevel: 1, talentCount: 0 }),
      canImproveLevel: true, canAddTalent: true, activeTrainingId: null,
      federalDurationReductionPercentage: 0,
    }],
  };
}

function render(value = academy(), mode: "training" | "complete" = "training") {
  return renderToStaticMarkup(createElement(StaffAcademyCard, {
    academy: value, architects: [], activeProjects: [], directorLevel: 20,
    balance: -402_000, currency: "EUR", mode,
  }));
}

function trainingForms(html: string) {
  return Array.from(html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g), ([form]) => form)
    .filter((form) => form.includes('name="staffContractId"'));
}

describe("free staff academy courses", () => {
  it("offers both free courses with a negative cash balance, without financial confirmation", () => {
    const forms = trainingForms(render());
    expect(forms).toHaveLength(2);
    for (const form of forms) {
      expect(form).toContain("Gratuit");
      expect(form).toContain("Durée");
      expect(form).not.toContain('disabled=""');
      expect(form).not.toContain("data-financial-expense");
      expect(form).not.toContain("Trésorerie insuffisante");
    }
  });

  it("requires an active educator for either course", () => {
    for (const form of trainingForms(render(academy(0)))) {
      expect(form).toContain('disabled=""');
      expect(form).toContain("Recrutez un formateur actif");
    }
  });

  it("still enforces capacity and a single course per member", () => {
    const full = academy();
    full.activeTrainingCount = 1;
    for (const form of trainingForms(render(full))) {
      expect(form).toContain('disabled=""');
      expect(form).toContain("Tous les emplacements sont occupés");
    }
    const busy = academy();
    busy.members[0].activeTrainingId = "training-1";
    expect(render(busy)).toContain("Ce membre suit déjà un stage");
  });

  it("keeps the construction cost and budget check", () => {
    const html = render(academy(), "complete");
    expect(html).toContain('data-financial-label="le chantier Académie des métiers"');
    expect(html).toContain("Trésorerie insuffisante");
    for (const form of trainingForms(html)) expect(form).not.toContain('disabled=""');
  });

  it("preserves historical paid courses and labels new courses as free", () => {
    const value = academy();
    const historic: StaffAcademyTraining = {
      id: "historic", contractId: "contract-1", memberId: "member-1", memberName: "Jean Test",
      improvementType: "level", improvementLabel: "Étoile", previousLevel: 1, previousTalentCount: 1,
      cost: 525_000, durationDays: 5, remainingDays: 0, completionGameYear: 4,
      completionDayNumber: 5, progressPercentage: 100, status: "completed",
      awardedTalentLabel: null, completedAt: null,
      educatorCostReductionPercentage: 10, educatorDurationReductionPercentage: 15,
      federalDurationReductionPercentage: 0,
      educatorMentorshipReductionDays: 0, educatorTalentChoiceCount: 1, talentChoices: [],
    };
    value.recentTrainings = [historic, { ...historic, id: "free", cost: 0, educatorCostReductionPercentage: 0 }];
    const html = render(value);
    expect(html).toContain("525");
    expect(html).toContain("Stage gratuit");
    expect(html.match(/coût −/g)).toHaveLength(1);
  });

  it("shows fixed talent choices inline without charging or consuming a training slot", () => {
    const value = academy();
    value.pendingTalentChoices = [{
      id: "pending", contractId: "contract-1", memberId: "member-1", memberName: "Jean Test",
      improvementType: "talent", improvementLabel: "Nouveau talent", previousLevel: 1, previousTalentCount: 1,
      cost: 0, durationDays: 6, remainingDays: 0, completionGameYear: 4,
      completionDayNumber: 10, progressPercentage: 100, status: "active",
      awardedTalentLabel: null, completedAt: null,
      educatorCostReductionPercentage: 0, educatorDurationReductionPercentage: 0,
      federalDurationReductionPercentage: 0, educatorMentorshipReductionDays: 0,
      educatorTalentChoiceCount: 2,
      talentChoices: [
        {code: "mechanic_wheel_efficiency",label: "Roues",description: "Bonus roues"},
        {code: "mechanic_frame_efficiency",label: "Cadre",description: "Bonus cadre"},
      ],
    }];
    value.members[0].activeTrainingId = "pending";
    const html = render(value);
    expect(html).toContain("place de formation libérée");
    expect(html).toContain("Les propositions sont définitives");
    expect(html).toContain('name="talentCode" value="mechanic_wheel_efficiency"');
    expect(html).toContain('name="talentCode" value="mechanic_frame_efficiency"');
    expect(html.match(/Choisir ce talent/g)).toHaveLength(2);
    expect(html).toContain("1 emplacement(s) disponible(s)");
  });
});
