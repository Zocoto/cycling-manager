import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/jeu/objectifs/actions", () => ({
  claimDailyRewardAction: vi.fn(),
  redeemDailyRewardAction: vi.fn(),
}));

import { DailyRewardsPanel } from "@/components/game/daily-rewards-panel";
import type { DailyRewardOverview } from "@/lib/game/daily-rewards";

describe("DailyRewardsPanel", () => {
  it("shows the extended cycle and its next reward level", () => {
    const markup = renderToStaticMarkup(
      <DailyRewardsPanel overview={createOverview()} />,
    );

    expect(markup).toContain("Cycle");
    expect(markup).toContain("4/40");
    expect(markup).toContain(">Prochain<");
    expect(markup).toContain(">Saison<");
    expect(markup).toContain("Niv. 8");
    expect(markup).toContain("cadeau de niveau 10");
    expect(markup).toContain("même après une ou plusieurs");
    expect(markup).not.toContain("le remet au jour 1");
  });

  it("never offers equipment redemption from the rewards reserve", () => {
    const markup = renderToStaticMarkup(
      <DailyRewardsPanel overview={createOverview()} />,
    );

    expect(markup).toContain("Bonus forme");
    expect(markup).toContain("× 2");
    expect(markup).toContain("Quantité à utiliser");
    expect(markup).toContain('name="quantity"');
    expect(markup).toContain('min="1" max="2"');
    expect(markup).toContain("les effets seront cumulés");
    expect(markup).not.toContain("Casque cadeau");
    expect(markup).not.toContain("Ajouter à l’inventaire");
  });

  it("offers the constrained inputs for both instant recruitment rewards", () => {
    const overview = createOverview();
    overview.inventory = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        quantity: 1,
        key: "instant-youth-contract",
        name: "Contrat Espoir immédiat",
        description: "Promotion immédiate.",
        effectSummary: "Promotion professionnelle immédiate",
        importance: 8,
        effectKind: "instant_youth_promotion",
        iconKey: "contract",
        payload: {},
        acquiredAt: "2026-08-01T09:00:00.000Z",
        expiresAfterGameYear: 2,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        quantity: 1,
        key: "custom-staff-mandate",
        name: "Mandat de recrutement sur mesure",
        description: "Recrutement sur mesure.",
        effectSummary: "20 % par niveau",
        importance: 10,
        effectKind: "custom_staff_recruitment",
        iconKey: "staff",
        payload: {},
        acquiredAt: "2026-08-01T09:00:00.000Z",
        expiresAfterGameYear: 2,
      },
    ];
    overview.academyRiders = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Lina Martin",
        age: 17,
        promotionGameYear: 2,
      },
    ];
    overview.countries = [
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "France",
        code: "FR",
      },
    ];

    const markup = renderToStaticMarkup(
      <DailyRewardsPanel overview={overview} />,
    );

    expect(markup).toContain('name="academyRiderId"');
    expect(markup).toContain("Lina Martin · 17 ans");
    expect(markup).toContain('name="staffRole"');
    expect(markup).toContain(
      '<option value="educator" disabled="">Formateur · Académie des métiers requise</option>',
    );
    expect(markup).toContain('name="countryId"');
    expect(markup).toContain("exactement 20");
    expect(markup).toContain("Signer le junior maintenant");
    expect(markup).toContain("Générer et signer ce staff");

    overview.staffAcademyBuilt = true;
    const unlockedMarkup = renderToStaticMarkup(
      <DailyRewardsPanel overview={overview} />,
    );
    expect(unlockedMarkup).toContain(
      '<option value="educator">Formateur</option>',
    );
  });

  it("offers only active construction projects and staff below five stars", () => {
    const overview = createOverview();
    overview.inventory = [
      {
        id: "55555555-5555-4555-8555-555555555555",
        quantity: 1,
        key: "precision-architect-tee",
        name: "Té d’architecte de précision",
        description: "Accélérateur de chantier.",
        effectSummary: "Retire 7 jours",
        importance: 7,
        effectKind: "construction_time_reduction",
        iconKey: "architect",
        payload: { days: 7 },
        acquiredAt: "2026-08-01T09:00:00.000Z",
        expiresAfterGameYear: 2,
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        quantity: 1,
        key: "staff-expertise-badge",
        name: "Insigne d’expertise",
        description: "Progression du staff.",
        effectSummary: "+1 étoile",
        importance: 10,
        effectKind: "staff_level_boost",
        iconKey: "staff",
        payload: {},
        acquiredAt: "2026-08-01T09:00:00.000Z",
        expiresAfterGameYear: 2,
      },
    ];
    overview.constructionProjects = [
      {
        id: "77777777-7777-4777-8777-777777777777",
        name: "Soufflerie",
        targetLevel: 3,
        remainingDays: 12,
      },
    ];
    overview.staffMembers = [
      {
        contractId: "88888888-8888-4888-8888-888888888888",
        name: "Anna Martin",
        roleLabel: "Architecte",
        level: 4,
      },
    ];

    const markup = renderToStaticMarkup(
      <DailyRewardsPanel overview={overview} />,
    );

    expect(markup).toContain('name="constructionProjectId"');
    expect(markup).toContain("Soufflerie · niveau 3 · 12 jours restants");
    expect(markup).toContain("Accélérer ce chantier");
    expect(markup).toContain('name="staffContractId"');
    expect(markup).toContain("Anna Martin · Architecte · 4★ → 5★");
    expect(markup).toContain("Attribuer l’étoile");
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
        quantity: 1,
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
        quantity: 2,
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
    academyRiders: [],
    countries: [],
    staffAcademyBuilt: false,
    constructionProjects: [],
    staffMembers: [],
    scoutingSupervision: {
      currentPercentage: 0,
      stableThroughDayNumber: null,
      remainingDays: 0,
      effects: [],
    },
  };
}
