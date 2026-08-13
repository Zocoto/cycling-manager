import type { SponsorObjectiveStatus } from "@/types/sponsor-objective";

export type SponsorObjectiveVisualStatus =
  | "achieved"
  | "failed"
  | "neutralized"
  | "in_progress";

export type SponsorObjectiveStatusPresentation = {
  status: SponsorObjectiveVisualStatus;
  label: string;
};

export function getSponsorObjectiveStatusPresentation(
  status: SponsorObjectiveStatus,
): SponsorObjectiveStatusPresentation {
  if (status === "completed") {
    return { status: "achieved", label: "Objectif atteint" };
  }

  if (status === "failed") {
    return { status: "failed", label: "Objectif non atteint" };
  }

  if (status === "cancelled") {
    return { status: "neutralized", label: "Neutralisé — sans impact" };
  }

  return { status: "in_progress", label: "Objectif en cours" };
}
