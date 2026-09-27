import type { SponsorObjectiveTargetDetails } from "@/types/sponsor-objective";

export type SponsorObjectiveProgressDisplay = {
  label: string;
  currentValue: number;
  targetValue: number;
  percentage: number;
  unit: "count" | "percentage";
};

export function getSponsorObjectiveProgressDisplay({
  targetDetails,
  currentValue,
  persistedTargetValue,
}: {
  targetDetails: SponsorObjectiveTargetDetails;
  currentValue: number | null;
  persistedTargetValue: number | null;
}): SponsorObjectiveProgressDisplay | null {
  if (currentValue === null || !Number.isFinite(currentValue)) {
    return null;
  }

  const definition = getProgressDefinition(targetDetails);

  if (!definition) {
    return null;
  }

  const targetValue =
    persistedTargetValue !== null &&
    Number.isFinite(persistedTargetValue) &&
    persistedTargetValue > 0
      ? persistedTargetValue
      : definition.targetValue;

  if (targetValue <= 0) {
    return null;
  }

  const normalizedCurrentValue = Math.max(0, currentValue);

  return {
    label: definition.label,
    currentValue: normalizedCurrentValue,
    targetValue,
    percentage: Math.min(
      100,
      Math.max(0, (normalizedCurrentValue / targetValue) * 100),
    ),
    unit: definition.unit,
  };
}

function getProgressDefinition(
  targetDetails: SponsorObjectiveTargetDetails,
): Omit<SponsorObjectiveProgressDisplay, "currentValue" | "percentage"> | null {
  switch (targetDetails.kind) {
    case "nationality_quota":
      return {
        label: "Part de l’effectif",
        targetValue: targetDetails.minimumPercentage,
        unit: "percentage",
      };
    case "season_wins":
      return {
        label: getSeasonWinProgressLabel(targetDetails.winScope),
        targetValue: targetDetails.minimumWinCount,
        unit: "count",
      };
    case "national_championship":
      return {
        label: "Titres nationaux",
        targetValue: targetDetails.requiredTitleCount,
        unit: "count",
      };
    case "homegrown_roster":
      return {
        label: "Coureurs formés au club",
        targetValue: targetDetails.minimumPercentage,
        unit: "percentage",
      };
    case "youth_development":
      return {
        label: getYouthDevelopmentProgressLabel(targetDetails.metric),
        targetValue: targetDetails.minimumCount,
        unit: "count",
      };
    case "infrastructure":
      return {
        label: "Infrastructures terminées",
        targetValue: targetDetails.minimumCompletedCount,
        unit: "count",
      };
    default:
      return null;
  }
}

function getSeasonWinProgressLabel(
  scope: Extract<
    SponsorObjectiveTargetDetails,
    { kind: "season_wins" }
  >["winScope"],
): string {
  switch (scope) {
    case "one_day_races":
      return "Victoires sur classiques";
    case "stages":
      return "Victoires d’étape";
    case "stage_race_general":
      return "Victoires au classement général";
    default:
      return "Victoires cette saison";
  }
}

function getYouthDevelopmentProgressLabel(
  metric: Extract<
    SponsorObjectiveTargetDetails,
    { kind: "youth_development" }
  >["metric"],
): string {
  switch (metric) {
    case "promotions":
      return "Promotions de jeunes";
    case "development_roster":
      return "Coureurs en équipe de développement";
    case "junior_race_wins":
      return "Victoires juniors";
    case "homegrown_sales":
      return "Ventes de coureurs formés";
  }
}
