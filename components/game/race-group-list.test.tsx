import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RaceGroupSnapshot, RiderSimulationInput, StageSimulationResult } from "@/lib/game/race-simulation";
import { createDemoSimulationInput } from "@/lib/game/race-simulation-demo";
import { RaceGapLine, buildLiveClassificationRows } from "./race-live-lab";

const template = createDemoSimulationInput("collines-ardennes", "group-list-test").riders[0];
const riders = new Map<string, RiderSimulationInput>(["other-1", "own-2", "other-2", "own-1"].map(id => [id, {
  ...template, id, name: id, teamId: "national-team", teamName: "Sélection nationale",
}]));
const group = (id: string, riderIds: string[], gap = 0): RaceGroupSnapshot => ({
  id, label: id, type: gap ? "chase" : "breakaway", riderIds,
  gapToLeaderSeconds: gap, averageEnergy: 65,
});
const displayedIds = (markup: string) => [...markup.matchAll(/data-race-group-rider="([^"]+)"/g)].map(match => match[1]);

describe("group membership lists", () => {
  it("prioritizes only owned rider IDs, even when everyone wears the same national jersey", () => {
    const groups = [group("head", ["other-1", "own-2", "other-2", "own-1"])];
    const markup = renderToStaticMarkup(<RaceGapLine groups={groups} riderById={riders} ownRiderIds={new Set(["own-1", "own-2"])} />);
    expect(displayedIds(markup)).toEqual(["own-2", "own-1", "other-1", "other-2"]);
    expect(markup.match(/data-race-group-own-rider="true"/g)).toHaveLength(2);
    expect(groups[0].riderIds).toEqual(["other-1", "own-2", "other-2", "own-1"]);
  });
  it("does not reorder groups or provisional/official ranks to favor the viewer", () => {
    const groups = [group("head", ["other-1", "own-2"]), group("chase", ["other-2", "own-1"], 45)];
    const markup = renderToStaticMarkup(<RaceGapLine groups={groups} riderById={riders} ownRiderIds={new Set(["own-1", "own-2"])} />);
    expect(displayedIds(markup)).toEqual(["own-2", "other-1", "own-1", "other-2"]);
    const snapshot = { segmentNumber: 1, completedDistanceKm: 15, groups, incidents: [], abandonments: [], commentary: [] };
    expect(buildLiveClassificationRows({ snapshot, officialResults: [], isRaceFinished: false }).map(row => row.riderId))
      .toEqual(["other-1", "own-2", "other-2", "own-1"]);
    const officialResults: StageSimulationResult["results"] = ["other-2", "own-1", "other-1", "own-2"].map((riderId, i) => ({
      riderId, rank: i + 1, status: "finished", elapsedTimeSeconds: 1000 + i,
      gapToWinnerSeconds: i, energyAfter: 40, injury: null, abandonment: null,
    }));
    expect(buildLiveClassificationRows({ snapshot, officialResults, isRaceFinished: true }).map(row => row.riderId))
      .toEqual(["other-2", "own-1", "other-1", "own-2"]);
  });
  it("keeps spectator order and tolerates riders missing from an old replay", () => {
    const groups = [group("head", ["other-2", "missing", "own-1", "other-1"])];
    expect(displayedIds(renderToStaticMarkup(<RaceGapLine groups={groups} riderById={riders} />)))
      .toEqual(["other-2", "own-1", "other-1"]);
  });
});
