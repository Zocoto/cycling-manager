import { describe, expect, it } from "vitest";

import {
  formatCyclogazetteStageLabel,
  getParisDateKey,
  getParisHour,
  isFrenchGrandTourGazetteDay,
  isItalianGrandTourGazetteDay,
  isSpanishGrandTourGazetteDay,
  repairCyclogazetteText,
  repairCyclogazetteValue,
  selectLatestCyclogazetteEveningStages,
  selectLatestCyclogazetteTourSummaries,
  sortCyclogazetteStoriesByPrestige,
} from "@/lib/game/cyclogazette";

describe("horaire de publication de La Cyclogazette", () => {
  it("reconnaît 20 h à Paris pendant l’heure d’été", () => {
    expect(getParisHour(new Date("2026-08-01T18:00:00Z"))).toBe(20);
    expect(getParisDateKey(new Date("2026-08-01T22:30:00Z"))).toBe("2026-08-02");
  });

  it("reconnaît 20 h à Paris pendant l’heure d’hiver", () => {
    expect(getParisHour(new Date("2026-01-10T19:00:00Z"))).toBe(20);
  });
});

describe("édition rose du Grand Tour italien", () => {
  it("active le thème de J2 à J7 inclus à chaque saison", () => {
    expect(isItalianGrandTourGazetteDay(2)).toBe(true);
    expect(isItalianGrandTourGazetteDay(5)).toBe(true);
    expect(isItalianGrandTourGazetteDay(7)).toBe(true);
  });

  it("conserve le thème classique avant le Tour et à partir de J8", () => {
    expect(isItalianGrandTourGazetteDay(1)).toBe(false);
    expect(isItalianGrandTourGazetteDay(8)).toBe(false);
    expect(isItalianGrandTourGazetteDay(28)).toBe(false);
  });
});

describe("édition spéciale du Grand Tour français", () => {
  it("active le thème de J9 à J15 inclus à chaque saison", () => {
    expect(isFrenchGrandTourGazetteDay(9)).toBe(true);
    expect(isFrenchGrandTourGazetteDay(10)).toBe(true);
    expect(isFrenchGrandTourGazetteDay(12)).toBe(true);
    expect(isFrenchGrandTourGazetteDay(15)).toBe(true);
  });

  it("conserve les autres thèmes avant le Tour et à partir de J16", () => {
    expect(isFrenchGrandTourGazetteDay(8)).toBe(false);
    expect(isFrenchGrandTourGazetteDay(16)).toBe(false);
    expect(isFrenchGrandTourGazetteDay(28)).toBe(false);
    expect(isFrenchGrandTourGazetteDay(10.5)).toBe(false);
  });
});

describe("édition rouge du Grand Tour espagnol", () => {
  it("active le thème de J17 à J22 inclus à chaque saison", () => {
    expect(isSpanishGrandTourGazetteDay(17)).toBe(true);
    expect(isSpanishGrandTourGazetteDay(20)).toBe(true);
    expect(isSpanishGrandTourGazetteDay(22)).toBe(true);
  });

  it("conserve la maquette classique en dehors de la Vuelta", () => {
    expect(isSpanishGrandTourGazetteDay(16)).toBe(false);
    expect(isSpanishGrandTourGazetteDay(23)).toBe(false);
    expect(isSpanishGrandTourGazetteDay(17.5)).toBe(false);
  });
});

describe("hiérarchie éditoriale des courses", () => {
  it("place la catégorie la plus prestigieuse en Une avant la récence", () => {
    const stories = [
      {
        id: "national-recent",
        happenedAt: "2026-08-30T18:30:00.000Z",
        prestigeRank: 4,
      },
      {
        id: "elite-older",
        happenedAt: "2026-08-30T14:00:00.000Z",
        prestigeRank: 1,
      },
      {
        id: "unknown",
        happenedAt: "2026-08-30T19:00:00.000Z",
      },
      {
        id: "elite-recent",
        happenedAt: "2026-08-30T18:00:00.000Z",
        prestigeRank: 1,
      },
    ];

    expect(
      sortCyclogazetteStoriesByPrestige(stories).map((story) => story.id),
    ).toEqual([
      "elite-recent",
      "elite-older",
      "national-recent",
      "unknown",
    ]);
  });
});

describe("textes de La Cyclogazette", () => {
  it("compose un libellé d’étape avec un tiret cadratin propre", () => {
    expect(formatCyclogazetteStageLabel("Mekong Delta Tour", "Étape 3")).toBe(
      "Mekong Delta Tour — Étape 3",
    );
  });

  it("répare les textes réencodés plusieurs fois dans les éditions archivées", () => {
    expect(
      repairCyclogazetteText(
        "Mekong Delta Tour ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Étape 3",
      ),
    ).toBe("Mekong Delta Tour — Étape 3");
    expect(repairCyclogazetteText("Maillot ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  pois")).toBe(
      "Maillot à pois",
    );
    expect(
      repairCyclogazetteValue({
        question: "Quel enseignement retenez-vous de cette journÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e ?",
      }),
    ).toEqual({
      question: "Quel enseignement retenez-vous de cette journée ?",
    });
  });

  it("ne modifie pas un texte français déjà valide", () => {
    expect(repairCyclogazetteText("SÃO Paulo — Étape 2")).toBe(
      "SÃO Paulo — Étape 2",
    );
  });
});

describe("récapitulatif des tours à 20 h", () => {
  it("écarte le point de 14 h et conserve seulement la dernière étape de 18 h par tour", () => {
    const stages = selectLatestCyclogazetteEveningStages([
      {
        id: "tour-a-early",
        raceEditionId: "tour-a",
        stageNumber: 3,
        daySlot: "early" as const,
      },
      {
        id: "tour-a-late-old",
        raceEditionId: "tour-a",
        stageNumber: 3,
        daySlot: "late" as const,
      },
      {
        id: "tour-a-late",
        raceEditionId: "tour-a",
        stageNumber: 4,
        daySlot: "late" as const,
      },
      {
        id: "tour-b-late",
        raceEditionId: "tour-b",
        stageNumber: 12,
        daySlot: "late" as const,
      },
    ]);

    expect(stages.map((stage) => stage.id)).toEqual([
      "tour-a-late",
      "tour-b-late",
    ]);
  });

  it("nettoie aussi les doublons des éditions déjà publiées", () => {
    const summary = (raceName: string, stageNumber: number) => ({
      raceName,
      stageLabel: `${raceName} — Étape ${stageNumber}`,
      href: `/jeu/resultats/${raceName.toLowerCase()}/${stageNumber}`,
      generalLeader: null,
      jerseys: [],
    });

    expect(
      selectLatestCyclogazetteTourSummaries([
        summary("Mekong", 3),
        summary("Mekong", 4),
        summary("Ruta", 11),
        summary("Ruta", 12),
      ]).map(({ raceName, stageLabel }) => ({ raceName, stageLabel })),
    ).toEqual([
      { raceName: "Mekong", stageLabel: "Mekong — Étape 4" },
      { raceName: "Ruta", stageLabel: "Ruta — Étape 12" },
    ]);
  });
});
