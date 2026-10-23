import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderSeasonPlanning } from "@/components/game/rider-season-planning";
import { RACE_CATEGORY_CODES, RACE_CATEGORY_STYLE } from "@/lib/game/race-calendar";
import {
  RIDER_PLANNING_EVENT_TYPES,
  type RiderPlanningEvent,
  type RiderPlanningEventStatus,
  type TeamRiderSeasonPlanning,
} from "@/lib/game/rider-season-planning";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";

const colors = {
  race: "#2457C5",
  form_camp: "#278B70",
  reconnaissance: "#C77A1B",
  injury: "#D94F4F",
};

function renderPlanning({
  variant,
  status,
  showEventDetails = false,
}: {
  variant: "team" | "rider";
  status: RiderPlanningEventStatus;
  showEventDetails?: boolean;
}) {
  const base: RiderPlanningEvent = {
    id: "event",
    riderId: "rider",
    type: "race",
    title: "Course test",
    detail: "Programme test",
    startDay: 5,
    endDay: 5,
    status,
    href: null,
    raceCategoryCode: null,
  };
  const planning: TeamRiderSeasonPlanning = {
    teamId: "team",
    teamName: "Equipe test",
    seasonId: "season",
    seasonName: "Saison test",
    currentDayNumber: 5,
    days: [],
    riders: [{
      id: "rider",
      firstName: "Luc",
      lastName: "Martin",
      countryName: "France",
      countryCode: "FR",
      avatarProfileKey: null,
      avatarSeed: 42,
      age: 25,
      events: [
        base,
        ...RACE_CATEGORY_CODES.map((category): RiderPlanningEvent => ({
          ...base,
          id: category,
          title: `Course ${category}`,
          raceCategoryCode: category,
          href: `/jeu/courses/${category}`,
        })),
        ...RIDER_PLANNING_EVENT_TYPES.filter((type) => type !== "race").map(
          (type): RiderPlanningEvent => ({ ...base, id: type, title: type, type }),
        ),
      ],
    }],
  };
  return renderToStaticMarkup(
    <RiderSeasonPlanning
      planning={planning}
      jersey={FREE_AGENT_RIDER_JERSEY}
      variant={variant}
      showEventDetails={showEventDetails}
    />,
  );
}

describe("couleurs des activités du programme", () => {
  for (const variant of ["team", "rider"] as const) {
    for (const status of ["completed", "active", "upcoming"] as const) {
      it(`${variant}/${status}: respecte la légende pour toutes les catégories`, () => {
        const markup = renderPlanning({ variant, status });
        const bars = [...markup.matchAll(/<(?:a|div)\b[^>]*data-planning-event-type="([^"]+)"[^>]*>/g)];
        expect(bars).toHaveLength(RACE_CATEGORY_CODES.length + 4);
        const legend = [...markup.matchAll(/<span\b[^>]*data-planning-legend-type="([^"]+)"[^>]*>/g)];
        expect(legend).toHaveLength(4);
        for (const type of RIDER_PLANNING_EVENT_TYPES) {
          const swatch = legend.find(([, kind]) => kind === type)?.[0];
          expect(swatch).toContain(`background-color:${colors[type]}`);
          const activityBars = bars.filter(([, kind]) => kind === type);
          expect(activityBars).toHaveLength(type === "race" ? RACE_CATEGORY_CODES.length + 1 : 1);
          for (const [tag] of activityBars) {
            expect(tag).toContain(`background-color:${colors[type]}`);
            expect(tag).not.toContain("saturate-");
            expect(tag.includes("opacity-75")).toBe(status === "completed");
          }
        }
        expect(new Set(Object.values(colors)).size).toBe(4);
      });
    }
  }

  it("réutilise les mêmes couleurs dans les détails sans changer les catégories du calendrier", () => {
    const calendarStylesBefore = structuredClone(RACE_CATEGORY_STYLE);
    const markup = renderPlanning({ variant: "rider", status: "active", showEventDetails: true });
    const detailMarkup = markup.slice(markup.indexOf("Détail du programme"));
    for (const [type, background] of Object.entries(colors)) {
      const expectedCount = type === "race" ? RACE_CATEGORY_CODES.length + 1 : 1;
      expect(detailMarkup.split(`background-color:${background}`).length - 1).toBe(expectedCount);
    }
    expect(RACE_CATEGORY_STYLE).toEqual(calendarStylesBefore);
  });
});
