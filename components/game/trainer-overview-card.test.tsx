import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrainerOverviewCard } from "@/components/game/trainer-overview-card";
import type { TeamTrainer } from "@/services/team-training";

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
  ],
  assignedRiderCount: 2,
  riderCapacity: 5,
} satisfies TeamTrainer;

describe("TrainerOverviewCard", () => {
  it("sépare visiblement le talent de base et les lignes supplémentaires", () => {
    const markup = renderToStaticMarkup(
      <TrainerOverviewCard trainer={trainer} />,
    );

    expect(markup).toContain("Talent de base");
    expect(markup).toContain("Montagne");
    expect(markup).toContain("Lignes de talent supplémentaires");
    expect(markup).toContain("Ligne 1 · Sprint");
    expect(markup).toContain(
      "+20 % d’efficacité sur les entraînements sprint, cumulable avec la spécialité principale",
    );
    expect(markup).toContain('aria-valuenow="2"');
  });
});
