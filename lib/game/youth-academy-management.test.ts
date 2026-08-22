import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const academyPage = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-formation/page.tsx"),
  "utf8",
);
const academyActions = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-formation/actions.ts"),
  "utf8",
);
const academyService = readFileSync(
  join(process.cwd(), "services/youth-development.ts"),
  "utf8",
);
const bulkEditor = readFileSync(
  join(process.cwd(), "components/game/youth-training-bulk-editor.tsx"),
  "utf8",
);

describe("gestion de l’école de cyclisme", () => {
  it("retire les notifications de l’école et de son compteur", () => {
    expect(academyPage).not.toContain("Notifications de l’école");
    expect(academyPage).not.toContain("markYouthNotificationsReadAction");
    expect(academyService).not.toContain(
      "notifications: YouthNotification[]",
    );
    expect(academyService).toContain(
      "const unreadCount = missions.filter((mission) => mission.unread).length",
    );
  });

  it("n’affiche que les passages pros programmés pour la saison suivante", () => {
    expect(academyPage).toContain("nextSeasonPromotions");
    expect(academyPage).toContain(
      'rider.promotionGameYear === overview.gameYear + 1',
    );
    expect(academyPage).toContain("Passage pro la saison prochaine");
  });

  it("reste dans le scouting après la signature d’un junior", () => {
    const actionStart = academyActions.indexOf(
      "export async function signYouthCandidateAction",
    );
    const actionEnd = academyActions.indexOf(
      "export async function saveYouthTrainingSettingsBulkAction",
    );
    const action = academyActions.slice(actionStart, actionEnd);

    expect(action).toContain(
      'redirectWithMessage("scouting", "succes"',
    );
    expect(action).not.toContain(
      'redirectWithMessage("ecole", "succes"',
    );
  });

  it("propose une validation groupée dans une barre flottante", () => {
    expect(academyPage).toContain("<YouthTrainingBulkEditor");
    expect(academyPage).toContain("<YouthTrainingSettingsFields");
    expect(academyPage).not.toContain("saveYouthTrainingSettingsAction");
    expect(bulkEditor).toContain(
      "mobile-dock-clearance fixed inset-x-3 bottom-",
    );
    expect(bulkEditor).toContain("Valider les entraînements");
    expect(bulkEditor).toContain("JSON.stringify(changedSettings)");
    expect(academyActions).toContain(
      '"save_current_youth_training_settings_bulk"',
    );
  });
});
