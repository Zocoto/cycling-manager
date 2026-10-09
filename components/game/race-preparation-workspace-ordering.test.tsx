import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RacePreparationWorkspace, type RacePreparationWorkspaceEdition, type RacePreparationWorkspaceNavigationEdition } from "./race-preparation-workspace";

const selected: RacePreparationWorkspaceEdition = {
  id: "selected", slug: "selected", name: "Course sélectionnée", shortName: null,
  countryCode: "FR", categoryCode: "continental", categoryName: "Continental",
  raceFormat: "one_day", competitionType: "standard", pendingWildcard: false,
  stages: [], equipmentPlanning: null,
  plan: { editionId: "selected", registrationId: "registration", teamId: "team", riders: [], stages: {} },
};
function navigation(slug: string, day: number, departure: string): RacePreparationWorkspaceNavigationEdition {
  return { id: slug, slug, name: slug, shortName: null, categoryCode: "continental",
    categoryName: "Continental", pendingWildcard: false,
    startDayNumber: day, endDayNumber: day, startDepartureAt: departure, endDepartureAt: departure,
    pendingCount: 1, scheduledStageCount: 1 };
}

describe("ordre affiché du menu de préparation", () => {
  it("trie réellement les liens de navigation, sans muter leurs données", () => {
    const menu = [
      navigation("lointaine", 12, "2026-10-20T18:00:00Z"),
      navigation("meme-jour-tard", 2, "2026-10-10T18:00:00Z"),
      navigation("plus-proche", 1, "2026-10-09T18:00:00Z"),
      navigation("meme-jour-tot", 2, "2026-10-10T12:00:00Z"),
    ];
    const original = [...menu];
    const action = async () => undefined;
    const html = renderToStaticMarkup(<RacePreparationWorkspace editions={[selected]} navigationEditions={menu}
      action={action} tacticalAction={action} timeTrialAction={action} gameYear={4}
      tacticalCenterLevel={0} tacticalBriefingsByStageId={{}} tacticalError={false}
      nowIso="2026-10-09T08:00:00Z" equipmentError={false} />);
    const links = [...html.matchAll(/href="\/jeu\/preparation-course\?course=([^"]+)"/g)]
      .map(match => match[1]);
    expect(links).toEqual(["plus-proche", "meme-jour-tot", "meme-jour-tard", "lointaine"]);
    expect(menu).toEqual(original);
  });
});
