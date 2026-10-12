import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RacePreparationWorkspace, type RacePreparationWorkspaceEdition, type RacePreparationWorkspaceNavigationEdition } from "./race-preparation-workspace";
import { DEFAULT_RACE_TEAM_STRATEGY } from "@/lib/game/race-strategy";

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
  function renderTour(initialStageNumber?: number, initialSlug = "selected") {
    const edition: RacePreparationWorkspaceEdition = {
      ...selected, raceFormat: "stage_race",
      stages: [1, 2, 3].map((stageNumber) => ({
        id: `stage-${stageNumber}`, dayNumber: 2, stageNumber, name: `Étape ${stageNumber}`,
        stageType: "road", status: "planned", profileType: "flat", distanceKm: 100,
        daySlot: "early", departureAt: "2026-10-10T12:00:00Z", segments: [],
      })),
      plan: { ...selected.plan, stages: {
        "stage-1": { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: "team", objective: "sprint",
          updatedAt: "2026-10-09T09:00:00Z", timeTrialUpdatedAt: null },
      } },
    };
    const action = async () => undefined;
    return renderToStaticMarkup(<RacePreparationWorkspace editions={[edition]}
      action={action} tacticalAction={action} timeTrialAction={action} gameYear={4}
      tacticalCenterLevel={0} tacticalBriefingsByStageId={{}} tacticalError={false}
      nowIso="2026-10-09T08:00:00Z" equipmentError={false}
      initialSlug={initialSlug} initialStageNumber={initialStageNumber} />);
  }
  const openedFormStages = (html: string) => [...html.matchAll(/name="stageId" value="([^"]+)"/g)].map((match) => match[1]);
  it("rouvre l’étape sauvegardée au lieu de montrer le plan neutre de l’étape suivante", () => {
    expect(openedFormStages(renderTour())).toEqual(["stage-2"]);
    const savedStep = renderTour(1);
    expect(openedFormStages(savedStep)).toEqual(["stage-1"]);
    expect(savedStep).toContain('value="sprint" selected=""');
  });
  it("permet de consulter une étape explicite et conserve le choix automatique pour un lien invalide", () => {
    expect(openedFormStages(renderTour(3))).toEqual(["stage-3"]);
    expect(openedFormStages(renderTour(99))).toEqual(["stage-2"]);
    expect(openedFormStages(renderTour(1, "other-course"))).toEqual(["stage-2"]);
  });
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
