import { describe, expect, it } from "vitest";

import { getTutorialCenterEntryPresentation } from "@/lib/tutorial/tutorial-center";

describe("getTutorialCenterEntryPresentation", () => {
  it("propose de commencer un parcours inconnu", () => {
    expect(
      getTutorialCenterEntryPresentation(null),
    ).toEqual({
      statusLabel: "À découvrir",
      actionLabel: "Commencer",
      launchSource: "manual",
      restartFromBeginning: true,
      needsAttention: false,
    });
  });

  it("propose de commencer un parcours non démarré", () => {
    expect(
      getTutorialCenterEntryPresentation("not_started"),
    ).toMatchObject({
      actionLabel: "Commencer",
      launchSource: "manual",
      restartFromBeginning: true,
    });
  });

  it("reprend une progression en cours sans recommencer", () => {
    expect(
      getTutorialCenterEntryPresentation("in_progress"),
    ).toEqual({
      statusLabel: "En cours",
      actionLabel: "Reprendre",
      launchSource: "resume",
      restartFromBeginning: false,
      needsAttention: true,
    });
  });

  it("permet de revoir un parcours terminé", () => {
    expect(
      getTutorialCenterEntryPresentation("completed"),
    ).toMatchObject({
      statusLabel: "Terminé",
      actionLabel: "Revoir depuis le début",
      launchSource: "replay",
      restartFromBeginning: true,
    });
  });

  it("permet de découvrir un parcours précédemment ignoré", () => {
    expect(
      getTutorialCenterEntryPresentation("skipped"),
    ).toMatchObject({
      statusLabel: "Ignoré",
      actionLabel: "Découvrir maintenant",
      launchSource: "replay",
      restartFromBeginning: true,
    });
  });
});
