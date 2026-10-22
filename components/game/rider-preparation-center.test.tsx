import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/jeu/entrainement/actions", () => ({
  startRiderPerformancePreparationAction: vi.fn(),
}));

import { RiderPreparationCenter } from "@/components/game/rider-preparation-center";
import type { TeamRiderPreparationOverview } from "@/services/team-rider-preparation";

function createOverview(level = 3): TeamRiderPreparationOverview {
  return {
    teamName: "Équipe Test",
    seasonName: "Saison 4",
    currentDayNumber: 5,
    currentGameDayIndex: 100,
    facilities: {
      indoor_track: { level, activePreparationId: null, activePreparationIds: [] },
      wind_tunnel: { level, activePreparationId: null, activePreparationIds: [] },
      cobbles_center: { level, activePreparationId: null, activePreparationIds: [] },
      hills_circuit: { level, activePreparationId: null, activePreparationIds: [] },
      mountain_base: { level, activePreparationId: null, activePreparationIds: [] },
    },
    riders: [
      { id: "a", firstName: "Alpha", lastName: "Sprinteur", countryCode: "FR" },
      { id: "b", firstName: "Bravo", lastName: "Lanceur", countryCode: "BE" },
      { id: "c", firstName: "Charlie", lastName: "Rouleur", countryCode: "CH" },
      { id: "d", firstName: "Delta", lastName: "Chrono", countryCode: "IT" },
    ],
    preparations: [],
  };
}

function preparation(
  overrides: Partial<TeamRiderPreparationOverview["preparations"][number]> = {},
): TeamRiderPreparationOverview["preparations"][number] {
  return {
    id: "prep-a",
    riderId: "a",
    type: "indoor_track",
    riderName: "Alpha Sprinteur",
    buildingLevel: 3,
    preparationStartGameDay: 101,
    preparationEndGameDay: 102,
    bonusStartGameDay: 103,
    bonusEndGameDay: 106,
    ratingBonus: 2,
    status: "planned",
    ...overrides,
  };
}

function facilityMarkup(overview: TeamRiderPreparationOverview, type = "indoor_track") {
  const markup = renderToStaticMarkup(<RiderPreparationCenter overview={overview} />);
  return markup.match(new RegExp(`<article data-preparation-facility="${type}"[\\s\\S]*?</article>`))?.[0] ?? "";
}

describe("RiderPreparationCenter", () => {
  it.each([
    [1, "1", 3, 1],
    [2, "1,5", 4, 1],
    [3, "2", 4, 2],
    [4, "2,5", 5, 2],
    [5, "3", 6, 3],
  ])("shows the shared level %i policy without extending the preparation", (level, bonus, days, capacity) => {
    const markup = facilityMarkup(createOverview(level));
    expect(markup).toContain(`Après 2 jours : +${bonus} sur SPR · ACC pendant ${days} jours.`);
    expect(markup).toContain(`Places occupées : 0/${capacity}`);
    expect(markup).toContain("Bonus de base, avant l’effet éventuel de l’architecte");
    expect(markup).toContain("Envoyer pendant 2 jours");
    expect(markup).toContain("ne se cumulent pas sur un coureur");
  });

  it("keeps the next rider form open while some places are occupied", () => {
    const overview = createOverview(3);
    overview.preparations = [preparation()];
    overview.facilities.indoor_track.activePreparationId = "prep-a";
    overview.facilities.indoor_track.activePreparationIds = ["prep-a"];
    const markup = facilityMarkup(overview);
    expect(markup).toContain("Places occupées : 1/2");
    expect(markup).toContain("Alpha Sprinteur");
    expect(markup).toContain('<form');
    expect(markup).not.toContain('<option value="a">');
    expect(markup).toContain('<option value="b">');
  });

  it.each([[1, 1], [3, 2], [5, 3]])("blocks only when all places at level %i are used", (level, capacity) => {
    const overview = createOverview(level);
    overview.preparations = Array.from({ length: capacity }, (_, index) => preparation({
      id: `prep-${index}`,
      riderId: String(index),
      riderName: `Coureur ${index}`,
    }));
    overview.facilities.indoor_track.activePreparationIds = overview.preparations.map((row) => row.id);
    const markup = facilityMarkup(overview);
    expect(markup).toContain(`Places occupées : ${capacity}/${capacity}`);
    expect(markup).toContain("Toutes les places sont occupées");
    expect(markup).not.toContain("<form");
    for (let index = 0; index < capacity; index++) expect(markup).toContain(`Coureur ${index}`);
  });

  it("never offers preparations without the building", () => {
    const markup = facilityMarkup(createOverview(0));
    expect(markup).toContain("Construisez cette installation");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("Après 2 jours");
  });

  it("allows renewal when the old bonus ends before the new one starts", () => {
    const overview = createOverview(3);
    overview.preparations = [
      preparation({ status: "completed", preparationStartGameDay: 96, preparationEndGameDay: 97, bonusStartGameDay: 98, bonusEndGameDay: 102 }),
      preparation({ id: "prep-b", riderId: "b", status: "completed", preparationStartGameDay: 97, preparationEndGameDay: 98, bonusStartGameDay: 99, bonusEndGameDay: 103 }),
      preparation({ id: "prep-c", riderId: "c", type: "wind_tunnel", status: "completed", preparationStartGameDay: 97, preparationEndGameDay: 98, bonusStartGameDay: 99, bonusEndGameDay: 106 }),
    ];
    const markup = facilityMarkup(overview);
    expect(markup).toContain('<option value="a">');
    expect(markup).not.toContain('<option value="b">');
    expect(markup).toContain('<option value="c">');
  });

  it("excludes a rider preparing in the other facility during the same two days", () => {
    const overview = createOverview(5);
    overview.preparations = [preparation({ type: "wind_tunnel" })];
    expect(facilityMarkup(overview)).not.toContain('<option value="a">');
  });

  it("retains the actual decimal architect bonus in history", () => {
    const overview = createOverview(2);
    overview.preparations = [preparation({ buildingLevel: 2, ratingBonus: 1.65 })];
    const markup = renderToStaticMarkup(<RiderPreparationCenter overview={overview} />);
    expect(markup).toContain("N2 · +1,65");
    expect(markup).toContain("+1,5 sur SPR · ACC pendant 4 jours");
  });
});
