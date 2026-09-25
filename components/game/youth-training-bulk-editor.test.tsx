import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  YouthTrainingBulkEditor,
  YouthTrainingSettingsFields,
} from "@/components/game/youth-training-bulk-editor";

vi.mock("@/app/jeu/centre-de-formation/actions", () => ({
  dismissYouthRidersBulkAction: vi.fn(),
  saveYouthTrainingSettingsBulkAction: vi.fn(),
}));

describe("YouthTrainingSettingsFields", () => {
  it("affiche les statistiques et les poids du profil junior sélectionné", () => {
    const markup = renderToStaticMarkup(
      <YouthTrainingBulkEditor
        initialSettings={[
          {
            academyRiderId: "academy-rider-1",
            trainingMode: "automatic",
            trainingPriority: "northern_classics",
          },
        ]}
      >
        <YouthTrainingSettingsFields
          academyRiderId="academy-rider-1"
          pendingTrainingMode={null}
        />
      </YouthTrainingBulkEditor>,
    );

    expect(markup).toContain("Classiques du Nord · Pavés · PAV / RES / PLA");
    expect(markup).toContain("Répartition du gain · Classiques du Nord · Pavés");
    expect(markup).toContain("Gain prioritaire");
    expect(markup).toContain("Gain secondaire");
    expect(markup).toContain("Gain d’entretien");
    expect(markup).toContain("55 %");
  });
});
