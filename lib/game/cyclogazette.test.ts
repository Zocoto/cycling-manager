import { describe, expect, it } from "vitest";

import {
  formatCyclogazetteStageLabel,
  getParisDateKey,
  getParisHour,
  repairCyclogazetteText,
  repairCyclogazetteValue,
  selectLatestCyclogazetteEveningStages,
  selectLatestCyclogazetteTourSummaries,
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
