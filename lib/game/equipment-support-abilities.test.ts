import { describe, expect, it } from "vitest";
import { applyEquipmentRatingBonuses, combineEquipmentEffects, normalizeEquipmentEffects } from "./equipment";
import { getBottleCarrierSupportEnergyCostMultiplier, getLeaderProtectionContributionMultiplier, getLocomotiveEnergyCostMultiplier, getSupportAbilityMultiplier } from "./equipment-support-abilities";
import { HALLOWEEN_FINAL_FRAME_EFFECTS } from "./halloween-final-frame";
import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStage } from "./race-simulation";
import type { RiderSpecialAbility } from "./special-abilities";

const effects = normalizeEquipmentEffects(HALLOWEEN_FINAL_FRAME_EFFECTS);
const rider = { id: "leader", teamId: "team-a" };
const helper = { id: "helper", teamId: "team-a", specialAbilities: ["bottle_carrier", "locomotive"] as RiderSpecialAbility[] };

describe("exclusive support frame effects", () => {
  it("conserves les effets habituels sans cadre et double la réduction, pas le coût restant", () => {
    expect(getBottleCarrierSupportEnergyCostMultiplier(rider, [helper])).toBe(0.97);
    expect(getLocomotiveEnergyCostMultiplier(helper, true)).toBe(0.84);
    const equipped = { ...helper, equipmentEffects: effects };
    expect(getBottleCarrierSupportEnergyCostMultiplier(rider, [equipped])).toBe(0.94);
    expect(getLocomotiveEnergyCostMultiplier(equipped, true)).toBeCloseTo(0.68);
    expect(getLocomotiveEnergyCostMultiplier(equipped, false)).toBe(1);
  });

  it("ne donne aucune capacité au porteur qui ne la possède pas", () => {
    const unskilled = { ...rider, equipmentEffects: effects };
    expect(getSupportAbilityMultiplier(unskilled, "bottle_carrier")).toBe(0);
    expect(getSupportAbilityMultiplier(unskilled, "locomotive")).toBe(0);
    expect(getLocomotiveEnergyCostMultiplier(unskilled, true)).toBe(1);
    expect(getBottleCarrierSupportEnergyCostMultiplier(helper, [unskilled])).toBe(1);
  });

  it("réserve les bidons aux équipiers du groupe et ne cumule jamais plusieurs porteurs", () => {
    const equipped = { ...helper, equipmentEffects: effects };
    expect(getBottleCarrierSupportEnergyCostMultiplier(equipped, [equipped])).toBe(1);
    expect(getBottleCarrierSupportEnergyCostMultiplier(rider, [{ ...equipped, teamId: "rival" }])).toBe(1);
    expect(getBottleCarrierSupportEnergyCostMultiplier(rider, [])).toBe(1);
    expect(getBottleCarrierSupportEnergyCostMultiplier(rider, [helper, equipped, { ...equipped, id: "other" }])).toBe(0.94);
    expect(getBottleCarrierSupportEnergyCostMultiplier(rider, [helper, { ...helper, id: "other" }])).toBe(0.97);
  });

  it("conserve les quatre stats et les multiplicateurs après normalisation et combinaison du matériel", () => {
    const combined = combineEquipmentEffects([effects, { ratingBonuses: { downhill: 2 } }, effects]);
    expect(combined.ratingBonuses.downhill).toBe(8);
    expect(combined.specialAbilityMultipliers).toEqual({ bottle_carrier: 2, locomotive: 2 });
    expect(combined.leaderProtectionContributionMultiplier).toBe(1.15);
    const input = createDemoSimulationInput("sprint-littoral", 9);
    const ratings = input.riders[0].ratings;
    const adjusted = applyEquipmentRatingBonuses(ratings, effects);
    for (const stat of ["recovery", "resistance", "endurance", "downhill"] as const) expect(adjusted[stat]).toBe(ratings[stat] + 3);
    expect(adjusted.mountain).toBe(ratings.mountain);
  });

  it("ignore les valeurs invalides et les autres capacités et borne les multiplicateurs", () => {
    const normalized = normalizeEquipmentEffects({
      specialAbilityMultipliers: { bottle_carrier: 99, locomotive: -3, panache: 8 },
      leaderProtectionContributionMultiplier: Infinity,
    });
    expect(normalized.specialAbilityMultipliers).toEqual({ bottle_carrier: 2 });
    expect(getLeaderProtectionContributionMultiplier(normalized)).toBe(1);
    expect(getLeaderProtectionContributionMultiplier(effects)).toBe(1.15);
    expect(getLeaderProtectionContributionMultiplier()).toBe(1);
    expect(normalizeEquipmentEffects({ specialAbilityMultipliers: [], leaderProtectionContributionMultiplier: 9 }).leaderProtectionContributionMultiplier).toBe(1.15);
  });

  it.each(["sprint-littoral", "collines-ardennes", "haute-montagne"] as const)("ne modifie pas le comportement sportif sans amplification : %s", (scenario) => {
    const input = createDemoSimulationInput(scenario, 41);
    const baseline = simulateRaceStage(input);
    const neutral = simulateRaceStage({ ...input, riders: input.riders.map((entry) => ({
      ...entry,
      equipmentEffects: { ...normalizeEquipmentEffects(entry.equipmentEffects), specialAbilityMultipliers: { bottle_carrier: 1, locomotive: 1 }, leaderProtectionContributionMultiplier: 1 },
    })) });
    expect(neutral.results).toEqual(baseline.results);
    expect(neutral.timeline).toEqual(baseline.timeline);
    expect(neutral.primes).toEqual(baseline.primes);
    expect(neutral.mountainPoints).toEqual(baseline.mountainPoints);
    expect(neutral.sprintPoints).toEqual(baseline.sprintPoints);
  });

  it("applique le doublement aux relais d’un chrono par équipes dans le moteur complet", () => {
    const input = createDemoSimulationInput("sprint-littoral", 11);
    const riders = input.riders.slice(0, 4).map((entry, index) => ({ ...entry, teamId: "same-team", form: 100, specialAbility: null, specialAbilities: index === 0 ? ["bottle_carrier", "locomotive"] as RiderSpecialAbility[] : [] }));
    const context = { ...input, stageType: "team_time_trial" as const, riders };
    const baseline = simulateRaceStage(context);
    const amplified = simulateRaceStage({ ...context, riders: riders.map((entry, index) => ({ ...entry, equipmentEffects: normalizeEquipmentEffects(index === 0 ? { specialAbilityMultipliers: effects.specialAbilityMultipliers } : null) })) });
    for (const result of amplified.results) {
      const previous = baseline.results.find((entry) => entry.riderId === result.riderId)!;
      expect(result.energyAfter).toBeGreaterThan(previous.energyAfter);
    }
  });
});
