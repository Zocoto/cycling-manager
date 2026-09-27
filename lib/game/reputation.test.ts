import { describe, expect, it } from "vitest";

import {
  getAvailableReputation,
  getNextReputationTier,
  getReputationTier,
  isReputationFeatureEnabled,
} from "./reputation";

describe("reputation", () => {
  it("débloque les usages avancés à partir de la saison 4", () => {
    expect(isReputationFeatureEnabled(3)).toBe(false);
    expect(isReputationFeatureEnabled(4)).toBe(true);
  });

  it("conserve une progression lisible au-delà de 1 000 points", () => {
    expect(getReputationTier(1_000).label).toBe("Icône");
    expect(getReputationTier(1_250).label).toBe("Institution");
    expect(getReputationTier(2_400).label).toBe("Légende");
    expect(getNextReputationTier(1_250)?.minimum).toBe(1_500);
    expect(getNextReputationTier(1_500)).toBeNull();
  });

  it("distingue la réputation actuelle de la réputation disponible", () => {
    expect(getAvailableReputation(820, 75)).toBe(745);
    expect(getAvailableReputation(30, 75)).toBe(0);
  });
});
