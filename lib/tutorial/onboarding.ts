import type {
  TutorialProgressRow,
  TutorialStepRequirement,
} from "@/types/tutorial";

export const ONBOARDING_TUTORIAL_KEY =
  "onboarding-core";

export type TutorialOnboardingState = {
  profileComplete: boolean;
  teamCreated: boolean;
  riderCount: number;
};

export function shouldAutoStartOnboarding({
  state,
  progress,
}: {
  state: TutorialOnboardingState;
  progress: TutorialProgressRow | null;
}): boolean {
  if (progress?.status === "completed" || progress?.status === "skipped") {
    return false;
  }

  if (progress?.status === "in_progress") {
    return true;
  }

  return !state.profileComplete || !state.teamCreated;
}

export function getTutorialRequirementError({
  requirement,
  state,
}: {
  requirement: TutorialStepRequirement | undefined;
  state: TutorialOnboardingState;
}): string | null {
  if (!requirement) {
    return null;
  }

  if (requirement === "profile_complete" && !state.profileComplete) {
    return "Finalisez et enregistrez d’abord le profil de votre Directeur Sportif. La nationalité doit être validée et un avatar doit être choisi.";
  }

  if (requirement === "team_created" && !state.teamCreated) {
    return "Fondez d’abord votre équipe amateur. Son pays d’affiliation doit être validé et son premier effectif doit avoir été généré.";
  }

  return null;
}
