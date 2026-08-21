import { describe, expect, it } from "vitest";

import { translateUiText, UI_TRANSLATIONS } from "@/lib/i18n/ui-translations";

describe("French to English UI catalog", () => {
  it("covers the reviewed cycling vocabulary", () => {
    expect(UI_TRANSLATIONS).toMatchObject({
      Coureur: "Rider",
      Effectif: "Roster",
      "Centre de soin": "Medical centre",
      "Centre de formation": "Youth development centre",
      "Fanclub / Boutique": "Fan Club / Shop",
      Pavés: "Cobblestones",
      "Contre-la-montre": "Time trial",
    });
  });

  it("preserves whitespace while translating exact interface labels", () => {
    expect(translateUiText("  Statistiques primaires\n")).toBe(
      "  Primary attributes\n",
    );
  });

  it("translates dynamic interface fragments without touching player names", () => {
    expect(translateUiText("Erik Van Dijk")).toBe("Erik Van Dijk");
    expect(translateUiText("Coureur · Moyenne générale")).toBe(
      "Rider · Overall average",
    );
  });
});
