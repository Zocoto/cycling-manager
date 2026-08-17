import { describe, expect, it } from "vitest";

import {
  calculateCountryBoundNaturalizationDays,
  calculateInGameTenureDays,
  evaluateNaturalizationEligibility,
  findContinuousProfessionalTenureStart,
  PROFESSIONAL_NATURALIZATION_REQUIRED_DAYS,
  shouldDisplayNaturalizationCard,
  YOUTH_NATURALIZATION_REQUIRED_DAYS,
} from "./naturalization";

const france = { id: "france", name: "France", code: "FR" };
const belgium = { id: "belgium", name: "Belgique", code: "BE" };

describe("naturalization", () => {
  it("demande trois saisons complètes à un professionnel", () => {
    expect(PROFESSIONAL_NATURALIZATION_REQUIRED_DAYS).toBe(84);
    expect(
      calculateInGameTenureDays({
        startGameYear: 1,
        startDayNumber: 1,
        currentGameYear: 4,
        currentDayNumber: 1,
      }),
    ).toBe(84);
  });

  it("demande une saison complète à un junior, même arrivé en cours de saison", () => {
    expect(YOUTH_NATURALIZATION_REQUIRED_DAYS).toBe(28);
    expect(
      calculateInGameTenureDays({
        startGameYear: 3,
        startDayNumber: 12,
        currentGameYear: 4,
        currentDayNumber: 12,
      }),
    ).toBe(28);
  });

  it("conserve le compteur junior à la promotion et le remet à zéro pour un autre pays", () => {
    expect(
      calculateCountryBoundNaturalizationDays({
        trackedCountryId: "france",
        targetCountryId: "france",
        startGameYear: 3,
        startDayNumber: 13,
        currentGameYear: 3,
        currentDayNumber: 28,
      }),
    ).toBe(15);
    expect(
      calculateCountryBoundNaturalizationDays({
        trackedCountryId: "france",
        targetCountryId: "france",
        startGameYear: 3,
        startDayNumber: 13,
        currentGameYear: 4,
        currentDayNumber: 1,
      }),
    ).toBe(16);
    expect(
      calculateCountryBoundNaturalizationDays({
        trackedCountryId: "belgium",
        targetCountryId: "france",
        startGameYear: 3,
        startDayNumber: 13,
        currentGameYear: 4,
        currentDayNumber: 1,
      }),
    ).toBe(0);
  });

  it("cumule les contrats professionnels continus dans la même équipe", () => {
    expect(
      findContinuousProfessionalTenureStart({
        currentContract: {
          startGameYear: 4,
          endGameYear: 5,
          joinedDayNumber: 1,
        },
        contracts: [
          { startGameYear: 1, endGameYear: 2, joinedDayNumber: 9 },
          { startGameYear: 3, endGameYear: 3, joinedDayNumber: 1 },
          { startGameYear: 4, endGameYear: 5, joinedDayNumber: 1 },
        ],
      }),
    ).toEqual({ startGameYear: 1, joinedDayNumber: 9 });
  });

  it("ne reprend pas une ancienne période séparée par une saison sans contrat", () => {
    expect(
      findContinuousProfessionalTenureStart({
        currentContract: {
          startGameYear: 5,
          endGameYear: 6,
          joinedDayNumber: 1,
        },
        contracts: [
          { startGameYear: 1, endGameYear: 2, joinedDayNumber: 1 },
          { startGameYear: 5, endGameYear: 6, joinedDayNumber: 1 },
        ],
      }),
    ).toEqual({ startGameYear: 5, joinedDayNumber: 1 });
  });

  it("bloque définitivement un professionnel champion national", () => {
    expect(
      evaluateNaturalizationEligibility({
        level: "professional",
        elapsedDays: 120,
        currentCountry: belgium,
        targetCountry: france,
        hasNationalChampionshipTitle: true,
      }),
    ).toMatchObject({
      eligible: false,
      reason: "champion_locked",
      remainingDays: 0,
    });
  });

  it("rend le junior éligible après 28 jours et évite une naturalisation inutile", () => {
    expect(
      evaluateNaturalizationEligibility({
        level: "youth",
        elapsedDays: 28,
        currentCountry: belgium,
        targetCountry: france,
      }),
    ).toMatchObject({ eligible: true, reason: "eligible" });

    expect(
      evaluateNaturalizationEligibility({
        level: "youth",
        elapsedDays: 28,
        currentCountry: france,
        targetCountry: france,
      }),
    ).toMatchObject({ eligible: false, reason: "same_nationality" });
  });

  it("n'affiche la rubrique que si la naturalisation reste utile", () => {
    const eligibility = evaluateNaturalizationEligibility({
      level: "professional",
      elapsedDays: 84,
      currentCountry: belgium,
      targetCountry: france,
    });
    const waiting = evaluateNaturalizationEligibility({
      level: "professional",
      elapsedDays: 42,
      currentCountry: belgium,
      targetCountry: france,
    });
    const alreadyNaturalized = evaluateNaturalizationEligibility({
      level: "professional",
      elapsedDays: 84,
      currentCountry: france,
      targetCountry: france,
    });
    const permanentlyLocked = evaluateNaturalizationEligibility({
      level: "professional",
      elapsedDays: 84,
      currentCountry: belgium,
      targetCountry: france,
      hasNationalChampionshipTitle: true,
    });
    const unavailable = evaluateNaturalizationEligibility({
      level: "professional",
      elapsedDays: 84,
      currentCountry: belgium,
      targetCountry: france,
      available: false,
    });

    expect(shouldDisplayNaturalizationCard(eligibility)).toBe(true);
    expect(shouldDisplayNaturalizationCard(waiting)).toBe(true);
    expect(shouldDisplayNaturalizationCard(alreadyNaturalized)).toBe(false);
    expect(shouldDisplayNaturalizationCard(permanentlyLocked)).toBe(false);
    expect(shouldDisplayNaturalizationCard(unavailable)).toBe(false);
    expect(shouldDisplayNaturalizationCard(null)).toBe(false);
  });

  it("accepte un délai personnalisé par le Centre d’accueil", () => {
    const eligibility = evaluateNaturalizationEligibility({
      level: "youth",
      elapsedDays: 0,
      requiredDays: 0,
      currentCountry: france,
      targetCountry: belgium,
    });
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.requiredDays).toBe(0);
    expect(eligibility.remainingDays).toBe(0);
  });
});
