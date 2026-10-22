import { readFileSync, statSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RiderAvatar } from "./rider-avatar";
import { QuadrennialChampionJersey, QuadrennialChampionPrize } from "./quadrennial-champion-jersey";
import { SideRaceCyclist, TopRaceCyclist, getRaceCyclistJerseyVisual } from "./race-cyclist";
import { createQuadrennialChampionRiderJersey, createNationalTeamRiderJersey } from "@/lib/rider-jersey";
import { isQuadrennialGamesEdition, parseQuadrennialChampionshipType, QUADRENNIAL_CHAMPION_JERSEY, QUADRENNIAL_GAMES_EMBLEM } from "@/lib/game/quadrennial-games";
import { createDemoSimulationInput } from "@/lib/game/race-simulation-demo";
import { simulateRaceStage } from "@/lib/game/race-simulation";
import { resolveFormerChampionshipBorder } from "@/lib/game/rider-championship-border";

describe("Quadrennial champion jersey", () => {
  it.each(["detailed", "compact"] as const)("crops upper chest without squashing the jersey in %s portraits", renderMode => {
    const html = renderToStaticMarkup(<RiderAvatar profileKey="classic" seed={42} renderMode={renderMode} jersey={createQuadrennialChampionRiderJersey({ championshipType: "road" })} />);
    expect(html).toContain('data-avatar-jersey-viewport="upper-body"');
    expect(html).toContain('viewBox="0 120 900 318.75"');
    expect(html).toContain(`href="${QUADRENNIAL_CHAMPION_JERSEY}"`);
    expect(html).not.toContain('data-sponsor-jersey-artwork');
  });
  it.each(["road", "time_trial"] as const)("shows approved garment and correct %s prize", championshipType => {
    const html = renderToStaticMarkup(<><QuadrennialChampionJersey championshipType={championshipType} /><QuadrennialChampionPrize compact championshipType={championshipType} /></>);
    expect(html).toContain("jusqu’aux Jeux suivants");
    expect(html).toContain(championshipType === "road" ? "course en ligne" : "contre-la-montre");
    expect(html).toContain("data-quadrennial-champion-prize");
    expect(html).not.toContain("min-w-56");
  });
  it("limits award previews to the Games, leaving normal Nations Cup and juniors intact", () => {
    expect(isQuadrennialGamesEdition({ competitionType: "nations_cup", name: "Jeux quadriennaux · Contre-la-montre" })).toBe(true);
    expect(isQuadrennialGamesEdition({ competitionType: "nations_cup", name: "Nations Cup · Sprint" })).toBe(false);
    expect(isQuadrennialGamesEdition({ competitionType: "junior", name: "Jeux quadriennaux" })).toBe(false);
    expect(parseQuadrennialChampionshipType("world_road")).toBeNull();
    expect(parseQuadrennialChampionshipType("quadrennial_time_trial")).toBe("time_trial");
  });
  it("renders the distinctive logo in both live views and preserves national-selection and classification priorities", () => {
    const rider = { ...createDemoSimulationInput("sprint-littoral", "games-visual").riders[0], activeQuadrennialChampion: { championshipType: "road" as const }, activeWorldChampion: { championshipType: "road" as const } };
    expect(getRaceCyclistJerseyVisual(rider).status).toBe("quadrennial-champion");
    const html = renderToStaticMarkup(<><SideRaceCyclist rider={rider} /><TopRaceCyclist rider={rider} /></>);
    expect(html.match(/data-quadrennial-race-jersey/g)).toHaveLength(2);
    expect(getRaceCyclistJerseyVisual({ ...rider, teamJersey: createNationalTeamRiderJersey("FR") }).status).toBe("national-team");
    expect(getRaceCyclistJerseyVisual({ ...rider, classificationJersey: "general" }).status).toBe("classification-leader");
  });
  it("adds no racing advantage: result times, energy and incidents remain identical", () => {
    const input = createDemoSimulationInput("sprint-littoral", "games-cosmetic-only");
    const baseline = simulateRaceStage(input);
    const decorated = simulateRaceStage({ ...input, riders: input.riders.map(rider => ({ ...rider, quadrennialChampionships: { road: { championshipType: "road" } }, teamJersey: createQuadrennialChampionRiderJersey({ championshipType: "road" }) })) });
    expect(decorated.results).toEqual(baseline.results);
    expect(decorated.timeline).toEqual(baseline.timeline);
  });
  it("keeps the former champion distinction after the active jersey passes on", () => {
    const base = { nationalTitles: [], continentalTitles: [], worldTitles: [] };
    expect(resolveFormerChampionshipBorder({ ...base, quadrennialTitles: [{ type: "road", seasonName: "S4", isActive: true }] })).toBeNull();
    expect(resolveFormerChampionshipBorder({ ...base, quadrennialTitles: [{ type: "road", seasonName: "S4", isActive: false }] })).toMatchObject({ kind: "quadrennial", label: "Ancien champion des Jeux quadriennaux route" });
  });
  it("ships both optimized local assets with bounded sizes", () => {
    for (const path of [QUADRENNIAL_CHAMPION_JERSEY, QUADRENNIAL_GAMES_EMBLEM]) {
      const file = `public${path}`;
      expect(statSync(file).size).toBeLessThan(200_000);
      expect(readFileSync(file).subarray(8, 12).toString()).toBe("WEBP");
    }
  });
});
