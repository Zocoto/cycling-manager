import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ProgressionStatFilters,
  RiderProgressionChart,
  toggleProgressionStat,
} from "@/components/game/rider-progression-chart";
import {
  DEFAULT_RIDER_PROGRESSION_STATS,
  createProgressionValues,
  type RiderProgressionSeason,
} from "@/lib/game/rider-progression";

const ratings = {
  mountain: 70,
  hills: 65,
  flat: 62,
  timeTrial: 68,
  cobbles: 55,
  sprint: 60,
  acceleration: 64,
  downhill: 61,
  endurance: 67,
  resistance: 66,
  recovery: 63,
  breakaway: 58,
  prologue: 59,
};

describe("RiderProgressionChart", () => {
  it("renders current and selected previous seasons distinctly", () => {
    const seasons: RiderProgressionSeason[] = [
      {
        seasonId: "current",
        seasonName: "Saison 2027",
        gameYear: 2027,
        isCurrent: true,
        points: [
          { dayNumber: 0, values: createProgressionValues(ratings) },
          {
            dayNumber: 14,
            values: createProgressionValues({ ...ratings, mountain: 72 }),
          },
        ],
      },
      {
        seasonId: "previous",
        seasonName: "Saison 2026",
        gameYear: 2026,
        isCurrent: false,
        points: [
          {
            dayNumber: 0,
            values: createProgressionValues({ ...ratings, mountain: 66 }),
          },
          { dayNumber: 28, values: createProgressionValues(ratings) },
        ],
      },
    ];

    const markup = renderToStaticMarkup(
      <RiderProgressionChart
        seasons={seasons}
        selectedStats={["average", "mountain"]}
      />,
    );

    expect(markup).toContain("Saison actuelle");
    expect(markup).toContain("Saison précédente");
    expect(markup).toContain('stroke-dasharray="8 6"');
    expect(markup).toContain("Moyenne générale");
    expect(markup).toContain("Montagne");
  });

  it("never hides the last visible statistic", () => {
    expect(toggleProgressionStat(["average"], "average")).toEqual(["average"]);
    expect(toggleProgressionStat(["average"], "mountain")).toEqual([
      "average",
      "mountain",
    ]);
    expect(toggleProgressionStat(["average", "mountain"], "average")).toEqual([
      "mountain",
    ]);
  });

  it("keeps the compact graph responsive and preserves vertical touch navigation", () => {
    const season: RiderProgressionSeason = {
      seasonId: "current",
      seasonName: "Saison 2027",
      gameYear: 2027,
      isCurrent: true,
      points: [{ dayNumber: 0, values: createProgressionValues(ratings) }],
    };

    const markup = renderToStaticMarkup(
      <RiderProgressionChart
        seasons={[season]}
        selectedStats={["mountain"]}
        compact
      />,
    );

    expect(markup).toContain('viewBox="0 0 640 240"');
    expect(markup).toContain("touch-pan-y");
    expect(markup).toContain("touch-action:pan-y");
    expect(markup).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("groups primary and optional statistics while keeping every series selectable", () => {
    const markup = renderToStaticMarkup(
      <ProgressionStatFilters
        selectedStats={[...DEFAULT_RIDER_PROGRESSION_STATS]}
        onChange={() => undefined}
        compact
      />,
    );

    expect(markup).toContain("Statistiques primaires");
    expect(markup).toContain("Moyenne &amp; stats secondaires");
    expect(markup).toContain('aria-label="Masquer Montagne"');
    expect(markup).toContain('aria-label="Afficher Récupération"');
  });
});
