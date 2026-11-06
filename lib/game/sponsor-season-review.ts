import {calculateSponsorRenewalBudget, getSponsorRenewalBudgetAdjustmentPercent} from "./sponsor-renewal-budget";
import {getSponsorObjectiveStatusPresentation, type SponsorObjectiveAchievementLevel} from "./sponsor-objective-status";
import type {SponsorObjectiveTargetDetails, SponsorObjectiveStatus} from "@/types/sponsor-objective";
import {readSponsorPartialAchievements, type SponsorPartialAchievement} from "./sponsor-partial-achievements";

export type SponsorSeasonReviewObjective = {
  id: string; name: string; displayOrder: number; status: SponsorObjectiveStatus;
  targetDetails: SponsorObjectiveTargetDetails; currentValue: number | null;
  targetValue: number | null; satisfactionPoints: number;
  achievementLevel: SponsorObjectiveAchievementLevel | null;
  partialSatisfactionPoints: number; partialAchievements: SponsorPartialAchievement[];
};

export type SponsorSeasonReview = {
  gameYear: number; currentGameYear: number; sponsorName: string;
  currentSponsorName: string | null; sameContract: boolean;
  satisfactionScore: number | null;
  previousBudget: number; currentBudget: number | null;
  currencyCode: string; currentCurrencyCode: string;
  objectives: SponsorSeasonReviewObjective[]; objectivesAvailable: boolean;
};

export function readSponsorReviewNumber(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function readSponsorSeasonReviewObjective(row: {
  id: string; name: string; display_order: number; status: SponsorObjectiveStatus;
  satisfaction_points: number; target_details: SponsorObjectiveTargetDetails;
  objective_progress: {current_value: number | string | null; status: string; details: Record<string, unknown> | null}[] | null;
}): SponsorSeasonReviewObjective {
  const progress = row.objective_progress?.[0];
  const details = progress?.details;
  const level = details?.achievementLevel;
  return {
    id: row.id, name: row.name, displayOrder: row.display_order,
    status: row.status === "cancelled" ? "cancelled" : progress?.status === "achieved" ? "completed"
      : progress?.status === "failed" ? "failed" : row.status,
    targetDetails: row.target_details, currentValue: readSponsorReviewNumber(progress?.current_value),
    targetValue: readSponsorReviewNumber(details?.targetValue),
    satisfactionPoints: Math.max(0, readSponsorReviewNumber(row.satisfaction_points) ?? 0),
    achievementLevel: level === "full" || level === "partial" || level === "missed" ? level : null,
    partialSatisfactionPoints: Math.max(0, readSponsorReviewNumber(details?.partialSatisfactionPoints) ?? 0),
    partialAchievements: readSponsorPartialAchievements(details?.partialAchievements),
  };
}

export function getSponsorReviewObjectivePresentation(objective: SponsorSeasonReviewObjective) {
  if (objective.status === "cancelled") return getSponsorObjectiveStatusPresentation("cancelled");
  const presentation = getSponsorObjectiveStatusPresentation(objective.status, objective.achievementLevel);
  return presentation.status === "in_progress" ? {...presentation, label: "Résultat non archivé"} : presentation;
}

export function summarizeSponsorSeasonReview(report: SponsorSeasonReview) {
  const statuses = report.objectives.map(getSponsorReviewObjectivePresentation);
  const comparable = report.currentBudget !== null && report.previousBudget > 0 && report.currencyCode === report.currentCurrencyCode;
  const difference = comparable ? report.currentBudget! - report.previousBudget : null;
  const satisfactionAdjustment = report.sameContract && report.gameYear >= 3 && report.satisfactionScore !== null
    ? getSponsorRenewalBudgetAdjustmentPercent(report.satisfactionScore) : null;
  const budgetAfterSatisfaction = satisfactionAdjustment !== null ? calculateSponsorRenewalBudget({
    currentBudget: report.previousBudget, satisfactionScore: report.satisfactionScore!,
  }) : null;
  return {
    achieved: statuses.filter(s=>s.status === "achieved").length,
    partial: statuses.filter(s=>s.status === "partial").length,
    failed: statuses.filter(s=>s.status === "failed").length,
    neutralized: statuses.filter(s=>s.status === "neutralized").length,
    unrecorded: statuses.filter(s=>s.status === "in_progress").length,
    total: statuses.length, difference,
    changePercent: difference === null ? null : difference / report.previousBudget * 100,
    satisfactionAdjustment, budgetAfterSatisfaction,
    otherAdjustments: comparable && budgetAfterSatisfaction !== null ? report.currentBudget! - budgetAfterSatisfaction : null,
  };
}
