import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  RiderTrainingPlanFields,
  TrainingPlansEditor,
  TrainingRosterList,
  TrainingPlansSaveFeedback,
} from "@/components/game/training-controls";
import type { TeamTrainer } from "@/services/team-training";
import { INITIAL_TRAINING_PLANS_SAVE_STATE } from "@/lib/game/training-plan-save-state";

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
  it("renders each rider’s saved domain and trainer before any interaction", () => {
    const markup = renderToStaticMarkup(<TrainingPlansEditor
      trainerIds={[trainer.contractId]}
      initialPlans={[
        { riderId: "a", intensity: 58, domain: "stage_racer", trainerContractId: trainer.contractId },
        { riderId: "b", intensity: 75, domain: "sprinter", trainerContractId: null },
      ]}
    >
      <RiderTrainingPlanFields riderId="a" riderCountryCode="FR" trainers={[trainer]} />
      <RiderTrainingPlanFields riderId="b" riderCountryCode="BE" trainers={[trainer]} />
    </TrainingPlansEditor>);
    function selectedOption(selectId: string) {
      const select = markup.match(new RegExp(`<select[^>]*id="${selectId}"[^>]*>(.*?)</select>`))?.[1];
      return select?.match(/<option[^>]*value="([^"]*)"[^>]*selected=""/u)?.[1];
    }
    expect(selectedOption("training-domain-a")).toBe("stage_racer");
    expect(selectedOption("training-trainer-a")).toBe(trainer.contractId);
    expect(selectedOption("training-domain-b")).toBe("sprinter");
    expect(selectedOption("training-trainer-b")).toBe("");
    expect(markup).toContain('name="plans" value="[]"');
  });

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
    expect(markup).toContain("Compétence de base · Montagne");
    expect(markup).toContain("Ligne 1 · Sprint");
    expect(markup).toContain("Ligne 2 · Chrono &amp; prologue");
    expect(markup).toContain("Affinité nationale active · +10 %");
    expect(markup).toContain("Base Montagne +20%");
    expect(markup).toContain("Lignes Sprint +20%, Chrono &amp; prologue +20%");
    expect(markup).toContain('for="training-trainer-rider-1"');
    expect(markup).toContain('id="training-trainer-rider-1"');
    expect(markup).toContain("Grimpeur · MON / END");
    expect(markup).toContain(
      'aria-label="Répartition du gain pour le profil Grimpeur"',
    );
    expect(markup).toContain("Gain prioritaire");
    expect(markup).toContain("100 %");
    expect(markup).toContain("55 %");
    expect(markup).toContain("Gain d’entretien");
    expect(markup).toContain("ⓘ Répartition du gain");
    expect(markup).toContain("group-open:rotate-180");
    expect(markup).toContain('for="training-domain-rider-1"');
    expect(markup).toContain('id="training-domain-rider-1"');
    expect(markup).toContain("whitespace-nowrap");
    expect(markup).not.toContain("Le gain réel varie ensuite");
  });

  it("propose un tri compact par statut sans quitter l’éditeur", () => {
    const markup = renderToStaticMarkup(
      <TrainingRosterList
        riders={[
          {
            id: "rider-1",
            firstName: "Ana",
            lastName: "Martin",
            squadStatus: "absolute_leader",
          },
          {
            id: "rider-2",
            firstName: "Zoé",
            lastName: "Bernard",
            squadStatus: "domestique",
          },
        ]}
      >
        <article>Ana Martin</article>
        <article>Zoé Bernard</article>
      </TrainingRosterList>,
    );

    expect(markup).toContain("Trier par");
    expect(markup).toContain("Statut dans l’équipe");
    expect(markup).toContain("Nom du coureur");
    expect(markup).toContain("Ordre habituel de la page Effectif.");
  });

  it("n’envoie jamais un entraîneur périmé dissimulé derrière Sans entraîneur", () => {
    const markup = renderToStaticMarkup(<TrainingPlansEditor
      trainerIds={[trainer.contractId]}
      initialPlans={[{ riderId: "rider-1", intensity: 58, domain: "stage_racer", trainerContractId: "expired-trainer" }]}
    ><RiderTrainingPlanFields riderId="rider-1" riderCountryCode="RW" trainers={[trainer]} /></TrainingPlansEditor>);
    expect(markup).not.toContain("expired-trainer");
    expect(markup).toContain('<option value="" selected="">Sans entraîneur</option>');
    expect(markup).not.toContain("Talents de l’entraîneur");
    expect(markup).toContain('name="plans" value="[]"');
  });
  it("affiche les raccourcis sur chaque coureur sans changer les valeurs personnalisées", () => {
    const markup = renderToStaticMarkup(<TrainingPlansEditor initialPlans={[
      { riderId: "a", intensity: 58, domain: "stage_racer", trainerContractId: null },
      { riderId: "b", intensity: 75, domain: "climber", trainerContractId: null },
    ]}>
      <RiderTrainingPlanFields riderId="a" riderCountryCode="RW" trainers={[]} />
      <RiderTrainingPlanFields riderId="b" riderCountryCode="FR" trainers={[]} />
    </TrainingPlansEditor>);
    expect(markup.match(/aria-label="Paliers d’intensité"/g)).toHaveLength(2);
    expect(markup.match(/aria-label="Régler l’intensité à /g)).toHaveLength(10);
    expect(markup.match(/type="range"/g)).toHaveLength(2);
    expect(markup).toContain('name="training-intensity-a"');
    expect(markup).toContain('value="58"');
    expect(markup).toContain('name="plans" value="[]"');
  });
});

describe("TrainingPlansSaveFeedback", () => {
  it("does not claim anything before submission", () => {
    expect(renderToStaticMarkup(<TrainingPlansSaveFeedback state={INITIAL_TRAINING_PLANS_SAVE_STATE} />)).toBe("");
  });
  it("shows accepted and rejected totals without saying the whole batch failed", () => {
    const markup = renderToStaticMarkup(<TrainingPlansSaveFeedback state={{
      status: "partial", message: "Validation partielle.",
      savedPlans: [{ riderId: "a", intensity: 60, domain: "climber", trainerContractId: null }],
      failures: [{ riderId: "b", message: "Quota dépassé." }],
    }} />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("1 programme enregistré.");
    expect(markup).toContain("1 programme à corriger.");
    expect(markup).toContain("les autres sont conservés");
  });
  it("keeps error text escaped and gives an accessible success message", () => {
    const markup = renderToStaticMarkup(<TrainingPlansSaveFeedback state={{
      status: "success", message: '<script>alert("unsafe")</script>', failures: [], savedPlans: [],
    }} />);
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('<script>alert(');
    expect(markup).toContain("&lt;script&gt;");
  });
});
