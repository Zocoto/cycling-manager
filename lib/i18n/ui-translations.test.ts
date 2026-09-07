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
      "Affinités météo": "Weather affinities",
      "Trier par": "Sort by",
      "Météo fédérale · sans centre météo":
        "Federation weather · no weather centre required",
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
    expect(
      translateUiText(
        "Ce changement sera disponible en Saison 3 si votre équipe reste affiliée à cette fédération.",
      ),
    ).toBe(
      "This change will become available in Season 3 if your team remains affiliated with this federation.",
    );
  });
});
