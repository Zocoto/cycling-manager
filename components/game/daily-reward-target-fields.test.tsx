import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  DailyRewardInventoryItem,
  DailyRewardRider,
} from "@/lib/game/daily-rewards";

import { DailyRewardTargetFields } from "./daily-reward-target-fields";

const rider = {
  id: "11111111-1111-4111-8111-111111111111",
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
} satisfies DailyRewardRider;

describe("DailyRewardTargetFields", () => {
  it("affiche la forme courante directement dans la liste des coureurs", () => {
    const markup = renderToStaticMarkup(
      <DailyRewardTargetFields
        item={buildItem("form_boost")}
        riders={[rider]}
        abilities={[]}
      />
    );

    expect(markup).toContain("Erik Van Dijk · Forme 82/100");
  });

  it("demande la statistique avant d'activer la liste des coureurs", () => {
    const markup = renderToStaticMarkup(
      <DailyRewardTargetFields
        item={buildItem("rating_boost")}
        riders={[rider]}
        abilities={[]}
      />
    );

    expect(markup).toContain("Choisir une statistique");
    expect(markup).toContain("Choisir d’abord une statistique");
    expect(markup).toMatch(/name="riderId"[^>]*disabled=""/);
  });

  it("demande la capacité avant de comparer les coureurs", () => {
    const markup = renderToStaticMarkup(
      <DailyRewardTargetFields
        item={buildItem("special_ability")}
        riders={[rider]}
        abilities={[
          { code: "panache", name: "Panache", effectSummary: "Audace" },
        ]}
      />
    );

    expect(markup).toContain("Choisir une capacité");
    expect(markup).toContain("Panache · Audace");
    expect(markup).toContain("Choisir d’abord une capacité");
  });
});

function buildItem(
  effectKind: DailyRewardInventoryItem["effectKind"]
): DailyRewardInventoryItem {
  return {
    id: "inventory-1",
    quantity: 1,
    key: "reward-1",
    name: "Cadeau",
    description: "",
    effectSummary: "",
    importance: 4,
    effectKind,
    iconKey: "gift",
    payload: { statScope: "secondary" },
    acquiredAt: "2026-08-08T00:00:00Z",
    expiresAfterGameYear: 2027,
  };
}
