import { describe, expect, it } from "vitest";

import {
  formatItemTargetValue,
  type ItemTargetRider,
} from "./item-target-values";

const rider = {
  id: "rider-1",
  firstName: "Erik",
  lastName: "Van Dijk",
  name: "Erik Van Dijk",
  countryName: "Pays-Bas",
  form: 82,
  experienceDays: 137,
  potentialSteps: 7,
  ratings: {
    mountain: 74,
    hills: 71,
    flat: 66,
    time_trial: 62,
    cobbles: 58,
    sprint: 49,
    acceleration: 77,
    downhill: 70,
    endurance: 73,
    resistance: 69,
    recovery: 68,
    breakaway: 72,
    prologue: 61,
  },
  abilityCodes: ["panache"],
} satisfies ItemTargetRider;

describe("item target values", () => {
  it("affiche la valeur réellement impactée par chaque famille d'objet", () => {
    expect(formatItemTargetValue(rider, { kind: "form" })).toBe(
      "Forme 82/100"
    );
    expect(formatItemTargetValue(rider, { kind: "experience" })).toBe(
      "Expérience 137 j"
    );
    expect(formatItemTargetValue(rider, { kind: "potential" })).toBe(
      "Potentiel 3,5/4 ★"
    );
    expect(
      formatItemTargetValue(rider, {
        kind: "rating",
        ratingKey: "acceleration",
      })
    ).toBe("ACC 77/100");
    expect(formatItemTargetValue(rider, { kind: "nationality" })).toBe(
      "Nationalité Pays-Bas"
    );
  });

  it("indique seulement si la capacité choisie est déjà acquise", () => {
    expect(
      formatItemTargetValue(rider, {
        kind: "ability",
        abilityCode: "panache",
      })
    ).toBe("Déjà acquise");
    expect(
      formatItemTargetValue(rider, {
        kind: "ability",
        abilityCode: "flahute",
      })
    ).toBe("Non acquise");
  });
});
