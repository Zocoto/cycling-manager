import type { SponsorObjectiveStatus } from "@/types/sponsor-objective";

export type SponsorObjectiveVisualStatus =
  | "achieved"
  | "partial"
  | "failed"
  | "neutralized"
  | "in_progress";

export type SponsorObjectiveAchievementLevel =
  | "full"
  | "partial"
  | "missed";

export type SponsorObjectiveStatusPresentation = {
  status: SponsorObjectiveVisualStatus;
  label: string;
};

export function getSponsorObjectiveStatusPresentation(
  status: SponsorObjectiveStatus,
  achievementLevel: SponsorObjectiveAchievementLevel | null = null,
): SponsorObjectiveStatusPresentation {
  if (status === "completed") {
    return { status: "achieved", label: "Objectif atteint" };
  }

  if (achievementLevel === "partial") {
    return { status: "partial", label: "Réussite partielle" };
  }

  if (status === "failed") {
    return { status: "failed", label: "Objectif non atteint" };
  }

  if (status === "cancelled") {
    return { status: "neutralized", label: "Neutralisé — sans impact" };
  }

  return { status: "in_progress", label: "Objectif en cours" };
}
