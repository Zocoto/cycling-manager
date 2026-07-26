import { describe, expect, it } from "vitest";

import { selectInstantAutoStartTutorialKey } from "@/lib/tutorial/instant-start";
import type {
  TutorialDefinition,
  TutorialProgressRow,
} from "@/types/tutorial";

const definition = {
  key: "onboarding-main",
  version: 1,
  type: "onboarding",
  title: "Premiers pas",
  description: "Découvrir le jeu.",
  autoStart: true,
  replayable: true,
  steps: [
    {
      key: "welcome",
      route: "/jeu",
      title: "Bienvenue",
      content: "Contenu de test.",
    },
  ],
} satisfies TutorialDefinition;

function createProgress(
  status: TutorialProgressRow["status"],
): TutorialProgressRow {
  return {
    id: "progress-id",
    sporting_director_id: "director-id",
    tutorial_key: definition.key,
    tutorial_type: definition.type,
    tutorial_version: 1,
    status,
    current_step_key:
      status === "not_started"
        ? null
        : "welcome",
    current_route:
      status === "not_started"
        ? null
        : "/jeu",
    started_at:
      status === "not_started"
        ? null
        : "2026-07-24T00:00:00.000Z",
    completed_at:
      status === "completed"
        ? "2026-07-24T00:05:00.000Z"
        : null,
    skipped_at:
      status === "skipped"
        ? "2026-07-24T00:01:00.000Z"
        : null,
    metadata: {},
    created_at: "2026-07-24T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
  };
}

describe("selectInstantAutoStartTutorialKey", () => {
  it("sélectionne un parcours autorisé sans progression", () => {
    expect(
      selectInstantAutoStartTutorialKey({
        autoStartTutorialKeys: [definition.key],
        progressRows: [],
        definitions: [definition],
      }),
    ).toBe(definition.key);
  });

  it("sélectionne un parcours encore non démarré", () => {
    expect(
      selectInstantAutoStartTutorialKey({
        autoStartTutorialKeys: [definition.key],
        progressRows: [createProgress("not_started")],
        definitions: [definition],
      }),
    ).toBe(definition.key);
  });

  it.each([
    "in_progress",
    "completed",
    "skipped",
  ] as const)(
    "n’affiche pas l’introduction instantanée pour le statut %s",
    (status) => {
      expect(
        selectInstantAutoStartTutorialKey({
          autoStartTutorialKeys: [definition.key],
          progressRows: [createProgress(status)],
          definitions: [definition],
        }),
      ).toBeNull();
    },
  );

  it("ignore un parcours non autorisé par le serveur", () => {
    expect(
      selectInstantAutoStartTutorialKey({
        autoStartTutorialKeys: [],
        progressRows: [],
        definitions: [definition],
      }),
    ).toBeNull();
  });
});
