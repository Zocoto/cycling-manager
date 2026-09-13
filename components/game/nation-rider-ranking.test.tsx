import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { NationRiderRatings } from "@/lib/game/nation-rider-ranking";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";

import { NationRiderRanking } from "./nation-rider-ranking";

function ratings(value: number): NationRiderRatings {
  return {
    mountain: value,
    hills: value,
    flat: value,
    timeTrial: value,
    cobbles: value,
    sprint: value,
    acceleration: value,
    downhill: value,
    endurance: value,
    resistance: value,
    recovery: value,
    breakaway: value,
    prologue: value,
  };
}

describe("nation rider ranking", () => {
  it("affiche cinq coureurs par défaut et propose toutes les notes principales", () => {
    const riders = Array.from({ length: 6 }, (_, index) => {
      const value = 80 - index;
      return {
        id: `rider-${index + 1}`,
        firstName: `Prénom ${index + 1}`,
        lastName: `Nom ${index + 1}`,
        avatarProfileKey: null,
        avatarSeed: index + 1,
        age: 24,
        overall: value,
        ratings: ratings(value),
        teamName: null,
        jersey: FREE_AGENT_RIDER_JERSEY,
      };
    });

    const markup = renderToStaticMarkup(
      <NationRiderRanking riders={riders} />,
    );

    expect(markup).toContain("Prénom 1 Nom 1");
    expect(markup).toContain("Prénom 5 Nom 5");
    expect(markup).not.toContain("Prénom 6 Nom 6");
    expect(markup).toContain("Afficher les 5 suivants");
    expect(markup.match(/<option/g)).toHaveLength(7);
    expect(markup).toContain('value="mountain"');
    expect(markup).toContain('value="timeTrial"');
    expect(markup).toContain('value="cobbles"');
  });
});
