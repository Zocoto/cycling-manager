import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  RiderTrainingPlanFields,
  TrainingPlansEditor,
} from "@/components/game/training-controls";
import type { TeamTrainer } from "@/services/team-training";

vi.mock("@/app/jeu/entrainement/actions", () => ({
  saveRiderTrainingPlansAction: vi.fn(),
  saveTeamTrainingSettingsAction: vi.fn(),
}));

const trainer = {
  contractId: "trainer-contract-1",
  countryId: "france",
  countryName: "France",
  countryCode: "FR",
  firstName: "Jean",
  lastName: "Dupont",
  level: 5,
  specialty: "mountain",
  specialtyLabel: "Montagne",
  efficiencyBonus: 20,
  talents: [
    {
      slot: 1,
      code: "trainer_sprint",
      label: "Domaine Sprint",
      description:
        "+20 % d’efficacité sur les entraînements sprint, cumulable avec la spécialité principale",
      specialty: "sprint",
      specialtyLabel: "Sprint",
      efficiencyBonus: 20,
    },
    {
      slot: 2,
      code: "trainer_time_trial",
      label: "Domaine Chrono & prologue",
      description:
        "+20 % d’efficacité sur les entraînements chrono & prologue, cumulable avec la spécialité principale",
      specialty: "time_trial",
      specialtyLabel: "Chrono & prologue",
      efficiencyBonus: 20,
    },
  ],
  assignedRiderCount: 1,
  riderCapacity: 5,
} satisfies TeamTrainer;

describe("RiderTrainingPlanFields", () => {
  it("affiche le talent de base, toutes les lignes supplémentaires et l’affinité réelle", () => {
    const markup = renderToStaticMarkup(
      <TrainingPlansEditor
        initialPlans={[
          {
            riderId: "rider-1",
            intensity: 50,
            domain: "climber",
            trainerContractId: trainer.contractId,
          },
        ]}
      >
        <RiderTrainingPlanFields
          riderId="rider-1"
          riderCountryCode="FR"
          trainers={[trainer]}
        />
      </TrainingPlansEditor>,
    );

    expect(markup).toContain("Talents de l’entraîneur");
    expect(markup).toContain("Talent de base · Montagne");
    expect(markup).toContain("Ligne 1 · Sprint");
    expect(markup).toContain("Ligne 2 · Chrono &amp; prologue");
    expect(markup).toContain("Affinité nationale active · +10 %");
    expect(markup).toContain("Base Montagne +20%");
    expect(markup).toContain("Lignes Sprint +20%, Chrono &amp; prologue +20%");
    expect(markup).toContain('for="training-trainer-rider-1"');
    expect(markup).toContain('id="training-trainer-rider-1"');
  });
});
