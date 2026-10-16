import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getProspectiveAchievement, getCareerOutfitObjective, PROSPECTIVE_ACHIEVEMENTS, PROSPECTIVE_ACHIEVEMENT_KEYS, CAREER_AVATAR_OUTFITS } from "./prospective-achievements";
import { getLockedTrophyTargets } from "./trophy-gallery";
import { ACHIEVEMENT_TROPHY_DEFINITIONS } from "./achievement-trophies";
import { applyEquipmentRatingBonuses, combineEquipmentEffects, hasEffectiveOwnResearchBonus, normalizeEquipmentEffects, scaleEquipmentEffect } from "./equipment";
import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStage } from "./race-simulation";

describe("prospective career achievements", () => {
  it("contains nine three-tier journeys and two secrets, matching the migration", () => {
    const sql = readFileSync("supabase/migrations/20261015130000_prospective_career_achievements.sql", "utf8") + readFileSync("supabase/migrations/20261016150000_rebalance_objectives_and_social_achievements.sql", "utf8");
    expect(PROSPECTIVE_ACHIEVEMENT_KEYS).toHaveLength(21);
    expect(Object.values(PROSPECTIVE_ACHIEVEMENTS).reduce((n,d) => n+d.targets.length,0)).toBe(50);
    for (const [key,definition] of Object.entries(PROSPECTIVE_ACHIEVEMENTS)) {
      expect(sql).toContain(`('${key}','${definition.group}','${definition.title}',array[${definition.targets.join(",")}]`);
    }
    expect(getProspectiveAchievement("random_gold")).toBeNull();
    expect(getProspectiveAchievement("journey_missing_gold")).toBeNull();
  });
  it("renders every objective independently without the extra journey interface", () => {
    const page = readFileSync("app/jeu/objectifs/page.tsx", "utf8");
    expect(page).toContain("objectives.map((objective)");
    expect(page).toContain("totalCount={objectives.length}");
    expect(page).not.toContain("groupProspectiveAchievementCards");
    expect(page).not.toContain("ProspectiveAchievementMilestones");
  });
  it("does not reveal secret trophies in the locked catalogue", () => {
    const targets = getLockedTrophyTargets([]);
    expect(targets.some(t => t.id === "locked:achievement:journey_shopkeeper")).toBe(true);
    expect(targets.some(t => t.id === "locked:achievement:journey_family_photo" || t.id === "locked:achievement:journey_upset")).toBe(false);
    expect(ACHIEVEMENT_TROPHY_DEFINITIONS.journey_family_photo.title).toBe("Photo de famille");
  });
  it("maps only the three exclusive outfits to their gold claims", () => {
    expect(CAREER_AVATAR_OUTFITS.map(getCareerOutfitObjective)).toEqual(["journey_shopkeeper_gold","journey_mentor_gold","journey_homegrown_gold"]);
    expect(getCareerOutfitObjective("unrelated")).toBeNull();
  });
});

describe("own-lab frozen provenance", () => {
  const ratings = createDemoSimulationInput("sprint-littoral", "career-test").riders[0].ratings;
  it("never doubles the real prototype bonus and combines provenance separately", () => {
    const normal = normalizeEquipmentEffects({ratingBonuses:{mountain:3}});
    const prototype = normalizeEquipmentEffects({ratingBonuses:{mountain:3},_careerResearch:{ratingKey:"mountain",delta:1}});
    expect(applyEquipmentRatingBonuses(ratings,prototype)).toEqual(applyEquipmentRatingBonuses(ratings,normal));
    const combined = combineEquipmentEffects([prototype,prototype]);
    expect(combined.ratingBonuses.mountain).toBe(6);
    expect(combined.ownResearchRatingBonuses?.mountain).toBe(2);
    expect(hasEffectiveOwnResearchBonus(ratings,prototype)).toBe(true);
    expect(hasEffectiveOwnResearchBonus(ratings,normal)).toBe(false);
  });
  it("rejects setbacks, invalid axes and nonfinite deltas", () => {
    for (const research of [{ratingKey:"mountain",delta:0},{ratingKey:"mountain",delta:-1},{ratingKey:"mountain",delta:Infinity},{ratingKey:"secret",delta:1},null]) {
      expect(normalizeEquipmentEffects({_careerResearch:research}).ownResearchRatingBonuses).toBeUndefined();
    }
  });
  it("preserves provenance through the calendar's staff adjustments without extra sporting effects", () => {
    const normal = normalizeEquipmentEffects({ratingBonuses:{mountain:3}});
    const prototype = normalizeEquipmentEffects({ratingBonuses:{mountain:3},_careerResearch:{ratingKey:"mountain",delta:1}});
    const scaled = scaleEquipmentEffect(prototype,10);
    expect(scaled.ownResearchRatingBonuses?.mountain).toBe(1.1);
    expect(applyEquipmentRatingBonuses(ratings,scaled)).toEqual(applyEquipmentRatingBonuses(ratings,scaleEquipmentEffect(normal,10)));
    expect(hasEffectiveOwnResearchBonus(ratings,combineEquipmentEffects([scaled]))).toBe(true);
  });
  it("uses the actual equipment calculation, including values above 100 and zero floors", () => {
    const effect = normalizeEquipmentEffects({ratingBonuses:{mountain:4},_careerResearch:{ratingKey:"mountain",delta:1}});
    expect(hasEffectiveOwnResearchBonus({...ratings,mountain:100},effect)).toBe(true);
    const ineffective = normalizeEquipmentEffects({ratingBonuses:{mountain:-100},_careerResearch:{ratingKey:"mountain",delta:1}});
    expect(hasEffectiveOwnResearchBonus({...ratings,mountain:50},ineffective)).toBe(false);
  });
  it("freezes effective provenance without changing the simulated race", () => {
    const input = createDemoSimulationInput("sprint-littoral", "career-provenance");
    const plain = simulateRaceStage({...input,riders:input.riders.map((rider,i)=>({...rider,
      equipmentEffects: i===0 ? normalizeEquipmentEffects({ratingBonuses:{sprint:3}}) : undefined,
    }))});
    const prototype = simulateRaceStage({...input,riders:input.riders.map((rider,i)=>({...rider,
      equipmentEffects: i===0 ? normalizeEquipmentEffects({ratingBonuses:{sprint:3},_careerResearch:{ratingKey:"sprint",delta:1}}) : undefined,
    }))});
    expect(prototype.results).toEqual(plain.results);
    expect(prototype.resolvedRiders.find(rider=>rider.id===input.riders[0].id)?.ownResearchBonusApplied).toBe(true);
    expect(plain.resolvedRiders.every(rider=>!rider.ownResearchBonusApplied)).toBe(true);
  });
});
