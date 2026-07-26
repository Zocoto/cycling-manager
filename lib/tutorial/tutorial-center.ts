import type {
  TutorialProgressStatus,
  TutorialSessionLaunchSource,
} from "@/types/tutorial";

export type TutorialCenterEntryPresentation = {
  statusLabel: string;
  actionLabel: string;
  launchSource: TutorialSessionLaunchSource;
  restartFromBeginning: boolean;
  needsAttention: boolean;
};

export function getTutorialCenterEntryPresentation(
  status: TutorialProgressStatus | null,
): TutorialCenterEntryPresentation {
  switch (status) {
    case "in_progress":
      return {
        statusLabel: "En cours",
        actionLabel: "Reprendre",
        launchSource: "resume",
        restartFromBeginning: false,
        needsAttention: true,
      };

    case "completed":
      return {
        statusLabel: "Terminé",
        actionLabel: "Revoir depuis le début",
        launchSource: "replay",
        restartFromBeginning: true,
        needsAttention: false,
      };

    case "skipped":
      return {
        statusLabel: "Ignoré",
        actionLabel: "Découvrir maintenant",
        launchSource: "replay",
        restartFromBeginning: true,
        needsAttention: false,
      };

    case "not_started":
    case null:
      return {
        statusLabel: "À découvrir",
        actionLabel: "Commencer",
        launchSource: "manual",
        restartFromBeginning: true,
        needsAttention: false,
      };
  }
}
