import { describe, expect, it } from "vitest";
import { GALA_EVENTS } from "./season-four-gala";
import { getSeasonFourGalaPrize, seasonFourGalaResultsSchema } from "./season-four-gala-rewards";
import { getTrainingRewardMultiplierForDay, type TrainingRewardEffect } from "./training-reward-multiplier";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const galaResultFixture = () => ({ eventKey: "world-tour:mountain", results: Array.from({ length: 10 }, (_, index) => ({ rank: index + 1, riderId: id(index + 1), teamId: id(100) })) });

describe("dotations effectives du gala S4", () => {
  it.each(GALA_EVENTS)("définit le top 10 de $key sans roue", ({ profile }) => {
    const prizes = Array.from({ length: 10 }, (_, index) => getSeasonFourGalaPrize(profile,index + 1));
    expect(prizes.slice(0,3).map(prize => prize.equipmentKey)).toEqual([`gala-s4-${profile}-bib_shorts`,`gala-s4-${profile}-helmet`,`gala-s4-${profile}-shoes`]);
    expect(prizes.slice(3).flatMap(prize => prize.consumables).reduce((count, row) => count + row.quantity,0)).toBe(25);
    expect(prizes[3].consumables).toContainEqual({rewardKey:"secondary-technique",quantity:1});
    expect(prizes[4].consumables).toContainEqual({rewardKey:"collective-training-200",quantity:3});
  });
  it.each([0,11,1.5,NaN])("refuse une place invalide %s", rank => expect(() => getSeasonFourGalaPrize("mountain",rank)).toThrow());
  it("refuse les résultats incomplets, doublons, programmes invalides et champs arbitraires", () => {
    const fixture = galaResultFixture();
    expect(seasonFourGalaResultsSchema.safeParse(fixture).success).toBe(true);
    for (const input of [
      {...fixture,eventKey:"continental:cobbles"}, {...fixture,results:fixture.results.slice(0,9)},
      {...fixture,results:fixture.results.map(row=>({...row,rank:1}))},
      {...fixture,results:fixture.results.map(row=>({...row,riderId:id(1)}))},
      {...fixture,results:fixture.results.map(row=>({...row,quantity:50}))},
    ]) expect(seasonFourGalaResultsSchema.safeParse(input).success).toBe(false);
  });
});

describe("bonus d’entraînement en file d’attente", () => {
  const effect = (multiplier: number, consumedDay: number|null = null): TrainingRewardEffect => ({effect_payload:{multiplier},starts_day_number:1,ends_day_number:28,consumed_day_number:consumedDay,status:consumedDay===null?"active":"consumed"});
  it("ne multiplie pas plusieurs objets entre eux", () => expect(getTrainingRewardMultiplierForDay([effect(2),effect(2),effect(2)],1)).toBe(2));
  it("choisit le meilleur bonus en attente, dans la limite ×3", () => expect(getTrainingRewardMultiplierForDay([effect(1.5),effect(4)],1)).toBe(3));
  it("conserve la séance déjà consommée et réserve un nouveau bonus plus fort pour le lendemain", () => {
    expect(getTrainingRewardMultiplierForDay([effect(2,1),effect(3)],1)).toBe(2);
    expect(getTrainingRewardMultiplierForDay([effect(2,1),effect(3)],2)).toBe(3);
  });
  it("n’applique pas les bonus hors de leur période", () => {
    expect(getTrainingRewardMultiplierForDay([effect(2)],29)).toBe(1);
    expect(getTrainingRewardMultiplierForDay([{...effect(2),starts_day_number:5}],4)).toBe(1);
  });
});
