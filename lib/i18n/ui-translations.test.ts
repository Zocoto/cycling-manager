import { describe, expect, it } from "vitest";

import { translateUiText, UI_TRANSLATIONS } from "@/lib/i18n/ui-translations";

describe("French to English UI catalog", () => {
  it.each([
    ["Parrainage", "Referrals"], ["Sponsor secondaire", "Secondary sponsor"],
    ["Soufflerie", "Wind tunnel"], ["Poisson pilote", "Lead-out rider"],
    ["Étape", "Stage"], ["Arrivée au sommet", "Summit finish"],
    ["Ingénieur R&D disponible", "Available R&D engineer"],
    ["Maillot de sélection nationale", "National team jersey"],
    ["3 coureurs engagés par votre équipe", "3 riders entered by your team"],
    ["1 coureur engagé par votre équipe", "1 rider entered by your team"],
    ["2 jours restants", "2 days remaining"],
    ["samedi 17 octobre 2026", "Saturday 17 October 2026"],
    ["2 mai 2026", "2 May 2026"],
    ["Maillot officiel de Abbaye du Lion", "Abbaye du Lion's official jersey"],
    ["2 inscriptions ont dû être retirées et devront être recomposées.", "2 registrations have had to be withdrawn and will need to be entered again."],
    ["a", "a"], ["Course profile", "Course profile"],
    ["Chandler Davis", "Chandler Davis"], ["Nisos Energiaia", "Nisos Energiaia"],
  ])("translates %s consistently", (source, target) => expect(translateUiText(source)).toBe(target));

  it("keeps proper names intact inside generated messages", () => {
    expect(translateUiText("Que représente cette victoire de Chandler Davis pour Abbaye du Lion ?")).toBe("What does Chandler Davis's victory mean for Abbaye du Lion?");
    expect(translateUiText("Que représente cette victoire de peut pour ont ?")).toBe("What does peut's victory mean for ont?");
  });

  it("does not replace French fragments inside longer words", () => {
    expect(translateUiText("Surplus · Springfield · Encore")).toBe("Surplus · Springfield · Encore");
  });

  it("contains no model tokenizer artefacts or broken dynamic variables", () => {
    for (const [source, target] of Object.entries(UI_TRANSLATIONS)) {
      expect(target, source).not.toMatch(/▁|ZXQ\d+QXZ/);
    }
  });
  it("translates actionable weight-cutting alerts in singular and plural", () => {
    expect(translateUiText("affûtage possible pour coureur en surpoids")).toBe("weight cutting available for an overweight rider");
    expect(translateUiText("affûtage possible pour coureurs en surpoids")).toBe("weight cutting available for overweight riders");
  });
  it("translates the staff market minimum-level threshold", () => {
    expect(translateUiText("Niveau minimum")).toBe("Minimum level");
    expect(translateUiText("Niveau 3 et plus")).toBe("Level 3 and above");
  });

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
      "Masquer les courses": "Hide race chats",
      "Courses masquées": "Race chats hidden",
      "Discussions de courses": "Race discussions",
      "Affichées dans le chat général": "Shown in the general chat",
      "Masquées du chat général": "Hidden from the general chat",
      Réafficher: "Show again",
      "Voir les Directeurs Sportifs en ligne":
        "View online Sporting Directors",
      "Répartition du gain": "Progress distribution",
      "Gain prioritaire": "Primary progress",
      "Gain secondaire": "Secondary progress",
      "Gain d’entretien": "Maintenance progress",
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
      "Rider · Overall rating",
    );
    expect(translateUiText("Répartition du gain · Grimpeur")).toBe(
      "Progress distribution · Climber",
    );
    expect(
      translateUiText(
        "Ce changement sera disponible en Saison 3 si votre équipe reste affiliée à cette fédération.",
      ),
    ).toBe(
      "This change will be available in Season 3 if your team remains affiliated with this federation.",
    );
  });
});
