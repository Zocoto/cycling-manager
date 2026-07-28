import { describe, expect, it } from "vitest";

import {
  calculateYouthAutomaticTrainingGain,
  calculateYouthMiniGameScore,
  calculateYouthManualTrainingGain,
  getYouthAutomaticFirstDay,
  getYouthManualTrainingDivisor,
  getYouthManualTrainingSlot,
  getYouthTrainingGameType,
  isYouthAutomaticTrainingDue,
  projectYouthRating,
  unprojectYouthRating,
} from "./youth-training";

describe("youth training", () => {
  it("associe chaque profil junior au bon minijeu", () => {
    expect(getYouthTrainingGameType("climber")).toBe("rhythm");
    expect(getYouthTrainingGameType("puncheur")).toBe("rhythm");
    expect(getYouthTrainingGameType("northern_classics")).toBe("reflex");
    expect(getYouthTrainingGameType("breakaway")).toBe("reflex");
    expect(getYouthTrainingGameType("sprinter")).toBe("speed");
    expect(getYouthTrainingGameType("rouleur")).toBe("speed");
  });

  it("sépare les deux créneaux manuels à midi heure de Paris", () => {
    expect(getYouthManualTrainingSlot(0)).toBe("manual_am");
    expect(getYouthManualTrainingSlot(11)).toBe("manual_am");
    expect(getYouthManualTrainingSlot(12)).toBe("manual_pm");
    expect(getYouthManualTrainingSlot(23)).toBe("manual_pm");
  });

  it("ne rattrape pas les jours manuels après un passage en automatique", () => {
    expect(
      getYouthAutomaticFirstDay({
        automaticSinceSeasonId: "season-current",
        automaticSinceDayNumber: 12,
        currentSeasonId: "season-current",
      }),
    ).toBe(12);
    expect(
      getYouthAutomaticFirstDay({
        automaticSinceSeasonId: "season-previous",
        automaticSinceDayNumber: 12,
        currentSeasonId: "season-current",
      }),
    ).toBe(1);
  });

  it("déclenche la séance courante à partir de 8 h heure de Paris", () => {
    expect(
      isYouthAutomaticTrainingDue({
        dayNumber: 10,
        currentDayNumber: 10,
        parisHour: 7,
      }),
    ).toBe(false);
    expect(
      isYouthAutomaticTrainingDue({
        dayNumber: 10,
        currentDayNumber: 10,
        parisHour: 8,
      }),
    ).toBe(true);
    expect(
      isYouthAutomaticTrainingDue({
        dayNumber: 9,
        currentDayNumber: 10,
        parisHour: 0,
      }),
    ).toBe(true);
    expect(
      isYouthAutomaticTrainingDue({
        dayNumber: 11,
        currentDayNumber: 10,
        parisHour: 12,
      }),
    ).toBe(false);
  });

  it("applique les cinq paliers de difficulté demandés", () => {
    expect(getYouthManualTrainingDivisor(49.999)).toBe(1_000);
    expect(getYouthManualTrainingDivisor(50)).toBe(2_000);
    expect(getYouthManualTrainingDivisor(60)).toBe(4_000);
    expect(getYouthManualTrainingDivisor(65)).toBe(6_000);
    expect(getYouthManualTrainingDivisor(70)).toBe(10_000);
  });

  it("accorde quatre points principaux pour 1000 points et quatre étoiles sous 50", () => {
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 20,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBe(4);
  });

  it("réduit progressivement le gain selon la note et le poids de la statistique", () => {
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 55,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBe(2);
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 62,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBe(1);
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 55,
        domain: "climber",
        ratingKey: "hills",
      }),
    ).toBeCloseTo(1.1);
  });

  it("double la progression automatique sans bonus d’entraîneur", () => {
    const gain = calculateYouthAutomaticTrainingGain({
      age: 17,
      potentialSteps: 8,
      currentProjectedRating: 55,
      domain: "climber",
      ratingKey: "mountain",
    });

    expect(gain).toBeGreaterThan(0.7);
    expect(gain).toBeLessThan(1);
  });

  it("continue de faire progresser un junior au-delà de 65", () => {
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 80,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBeGreaterThan(0);
    expect(
      calculateYouthAutomaticTrainingGain({
        age: 18,
        potentialSteps: 8,
        currentProjectedRating: 80,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBeGreaterThan(0);
  });

  it("convertit les notes internes sans perdre la projection professionnelle", () => {
    expect(projectYouthRating(2)).toBe(50);
    expect(unprojectYouthRating(50)).toBe(2);
    expect(projectYouthRating(unprojectYouthRating(100))).toBe(100);
  });

  it("normalise les trois minijeux sur 1000 points", () => {
    expect(
      calculateYouthMiniGameScore({
        gameType: "rhythm",
        rhythmPoints: 28_000,
        rhythmTaps: 28,
        reflexHits: 0,
        reflexOpportunities: 0,
        speedTaps: 0,
      }),
    ).toBe(1_000);
    expect(
      calculateYouthMiniGameScore({
        gameType: "reflex",
        rhythmPoints: 0,
        rhythmTaps: 0,
        reflexHits: 43,
        reflexOpportunities: 43,
        speedTaps: 0,
      }),
    ).toBe(1_000);
    expect(
      calculateYouthMiniGameScore({
        gameType: "speed",
        rhythmPoints: 0,
        rhythmTaps: 0,
        reflexHits: 0,
        reflexOpportunities: 0,
        speedTaps: 180,
      }),
    ).toBe(1_000);
  });

  it("borne les scores et ne recompense pas une partie inactive", () => {
    expect(
      calculateYouthMiniGameScore({
        gameType: "rhythm",
        rhythmPoints: 0,
        rhythmTaps: 0,
        reflexHits: 0,
        reflexOpportunities: 0,
        speedTaps: 0,
      }),
    ).toBe(0);
    expect(
      calculateYouthMiniGameScore({
        gameType: "speed",
        rhythmPoints: 0,
        rhythmTaps: 0,
        reflexHits: 0,
        reflexOpportunities: 0,
        speedTaps: 999,
      }),
    ).toBe(1_000);
  });
});
