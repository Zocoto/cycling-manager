import {
  buildStackedBonusBreakdown,
  type BonusBreakdown,
  type BonusBreakdownItem,
} from "@/lib/game/bonus-breakdown";
import type { RiderRatingKey } from "@/lib/game/rider-profile";
import type { TrainerSpecialty } from "@/lib/game/staff";
import {
  FIRST_IN_CLASS_TRAINING_MULTIPLIER,
  TRAINER_NATIONALITY_BONUS_PERCENTAGE,
  trainerSpecialtySupportsRating,
} from "@/lib/game/training";

export function buildTrainingBonusBreakdown({
  ratingKey,
  trainerLevel,
  trainerSpecialty,
  trainerCountryMatch,
  trainerTalentSpecialties = [],
  trainerTalentNationalityMultiplier = 1,
  trainingCenterLevel = 0,
  trainingCenterEfficiencyBonusPercentage = 0,
  federationPerformanceLevel = 0,
  federationStaffInstituteLevel = 0,
  trainerMatchesFederation = false,
  dailyRewardMultiplier = 1,
  hasFirstInClass = false,
}: {
  ratingKey: RiderRatingKey;
  trainerLevel: number;
  trainerSpecialty: TrainerSpecialty | null;
  trainerCountryMatch: boolean;
  trainerTalentSpecialties?: readonly TrainerSpecialty[];
  trainerTalentNationalityMultiplier?: number;
  trainingCenterLevel?: number;
  trainingCenterEfficiencyBonusPercentage?: number;
  federationPerformanceLevel?: number;
  federationStaffInstituteLevel?: number;
  trainerMatchesFederation?: boolean;
  dailyRewardMultiplier?: number;
  hasFirstInClass?: boolean;
}): BonusBreakdown {
  const safeTrainerLevel = Math.min(5, Math.max(0, Math.trunc(trainerLevel)));
  const items: BonusBreakdownItem[] = [];

  if (trainerSpecialtySupportsRating(trainerSpecialty, ratingKey)) {
    items.push({
      key: "trainer-specialty",
      label: "Spécialité de l’entraîneur",
      percentage: safeTrainerLevel * 4,
      detail: `Niveau ${safeTrainerLevel} · bonus de base du domaine`,
      stackingGroup: "trainer-base",
    });
  }
  if (trainerCountryMatch) {
    items.push({
      key: "trainer-affinity",
      label: "Affinité de l’entraîneur",
      percentage: TRAINER_NATIONALITY_BONUS_PERCENTAGE,
      detail: "Nationalité, pays voisin ou continent rendu compatible par le Centre d’accueil",
      stackingGroup: "trainer-base",
    });
  }

  const matchingTalent = trainerTalentSpecialties.find((specialty) =>
    trainerSpecialtySupportsRating(specialty, ratingKey),
  );
  if (matchingTalent) {
    items.push({
      key: `trainer-talent-${matchingTalent}`,
      label: "Talent supplémentaire de l’entraîneur",
      percentage:
        safeTrainerLevel *
        4 *
        Math.min(1.1, Math.max(1, trainerTalentNationalityMultiplier)),
      detail: "Ligne de talent de l’Académie des métiers",
    });
  }

  const safeTrainingCenterLevel = Math.min(
    5,
    Math.max(0, Math.trunc(trainingCenterLevel)),
  );
  if (safeTrainingCenterLevel > 0) {
    items.push({
      key: "training-center",
      label: "Centre d’entraînement",
      percentage:
        safeTrainingCenterLevel *
        2 *
        (1 + Math.max(0, trainingCenterEfficiencyBonusPercentage) / 100),
      detail:
        trainingCenterEfficiencyBonusPercentage > 0
          ? `Niveau ${safeTrainingCenterLevel} · conception architecte +${trainingCenterEfficiencyBonusPercentage} %`
          : `Niveau ${safeTrainingCenterLevel}`,
    });
  }

  const safeFederationPerformanceLevel = Math.min(
    5,
    Math.max(0, Math.trunc(federationPerformanceLevel)),
  );
  if (safeFederationPerformanceLevel > 0) {
    items.push({
      key: "federation-performance",
      label: "Centre national de performance",
      percentage: safeFederationPerformanceLevel * 0.3,
      detail: `Infrastructure fédérale niveau ${safeFederationPerformanceLevel}`,
    });
  }

  const safeFederationStaffLevel = Math.min(
    5,
    Math.max(0, Math.trunc(federationStaffInstituteLevel)),
  );
  if (trainerMatchesFederation && safeFederationStaffLevel > 0) {
    items.push({
      key: "federation-staff",
      label: "Institut fédéral du staff",
      percentage: safeFederationStaffLevel * 0.5,
      detail: `Entraîneur de la nation · niveau ${safeFederationStaffLevel}`,
    });
  }

  const safeDailyRewardMultiplier = Math.min(
    3,
    Math.max(1, dailyRewardMultiplier),
  );
  if (safeDailyRewardMultiplier > 1) {
    items.push({
      key: "daily-reward",
      label: "Bonus d’entraînement activé",
      percentage: (safeDailyRewardMultiplier - 1) * 100,
      detail: "Objet consommé pour cette journée",
    });
  }

  if (hasFirstInClass) {
    items.push({
      key: "first-in-class",
      label: "Capacité Premier de la classe",
      percentage: (FIRST_IN_CLASS_TRAINING_MULTIPLIER - 1) * 100,
      detail: "Capacité spéciale permanente du coureur",
    });
  }

  return buildStackedBonusBreakdown(items);
}
