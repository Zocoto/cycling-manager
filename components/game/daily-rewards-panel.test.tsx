import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DailyRewardsPanel } from "@/components/game/daily-rewards-panel";
import type { DailyRewardOverview } from "@/lib/game/daily-rewards";

describe("DailyRewardsPanel", () => {
  it("keeps the streak visible without exposing reward levels", () => {
    const markup = renderToStaticMarkup(
      <DailyRewardsPanel overview={createOverview()} />,
    );

    expect(markup).toContain("Série");
    expect(markup).toContain("3 j");
    expect(markup).not.toContain(">Prochain<");
    expect(markup).not.toContain(">Saison<");
    expect(markup).not.toContain("Niv.");
    expect(markup).not.toContain("Importance");
    expect(markup).not.toContain("cadeau niveau");
  });

  it("never offers equipment redemption from the rewards reserve", () => {
    const markup = renderToStaticMarkup(
      <DailyRewardsPanel overview={createOverview()} />,
    );

    expect(markup).toContain("Bonus forme");
    expect(markup).not.toContain("Casque cadeau");
    expect(markup).not.toContain("Ajouter à l’inventaire");
  });
});

function createOverview(): DailyRewardOverview {
  return {
    seasonId: "season-1",
    seasonName: "Saison 1",
    gameYear: 1,
    currentDayNumber: 3,
    seasonLength: 28,
    claimedToday: false,
    availableToday: true,
    consecutiveDays: 3,
    prospectiveStreakDay: 4,
    importance: 8,
    claimedSeasonDays: [1, 2],
    offers: [
      {
        key: "daily-equipment",
        name: "Surprise matérielle",
        description: "Un équipement rejoint votre équipe.",
        effectSummary: "Un objet de matériel aléatoire.",
        importance: 8,
        effectKind: "equipment",
        iconKey: "equipment",
        payload: { rarity: "rare" },
      },
    ],
    inventory: [
      {
        id: "inventory-equipment",
        key: "daily-equipment",
        name: "Casque cadeau",
        description: "Ancien cadeau matériel.",
        effectSummary: "+1 équipement",
        importance: 4,
        effectKind: "equipment",
        iconKey: "equipment",
        payload: { rarity: "rare" },
        acquiredAt: "2026-08-01T08:00:00.000Z",
        expiresAfterGameYear: 2,
      },
      {
        id: "inventory-form",
        key: "daily-form",
        name: "Bonus forme",
        description: "Un bonus à appliquer plus tard.",
        effectSummary: "+5 forme",
        importance: 3,
        effectKind: "form_boost",
        iconKey: "form",
        payload: { amount: 5 },
        acquiredAt: "2026-08-01T09:00:00.000Z",
        expiresAfterGameYear: 2,
      },
    ],
    riders: [],
    eligibleRaces: [],
    abilities: [],
  };
}
