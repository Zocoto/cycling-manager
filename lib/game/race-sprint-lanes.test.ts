import { describe, expect, it } from "vitest";

import {
  buildSprintVisualRoster,
  getFinishSameTimeOrderIndex,
  getFinishVisualCrossingTimeSeconds,
  orderSprintVisualLanes,
  type SprintVisualRosterTeam,
} from "./race-finish-visual";

function createTeams(count: number): SprintVisualRosterTeam[] {
  return Array.from({ length: count }, (_, index) => ({
    teamId: `team-${index}`,
    contenderRiderId: `sprinter-${index}`,
    leadoutRiderIds: [`leadout-${index}`],
    riderIds: [`leadout-${index}`, `sprinter-${index}`],
  }));
}

describe("mass sprint visual lanes", () => {
  it("keeps a course's lanes stable regardless of the incoming finish order", () => {
    const roster = createTeams(10);
    const seed = "same-course-replay";
    const expected = orderSprintVisualLanes({ roster, seed });

    expect(orderSprintVisualLanes({ roster, seed })).toEqual(expected);
    expect(orderSprintVisualLanes({ roster: [...roster].reverse(), seed }))
      .toEqual(expected);
    expect(orderSprintVisualLanes({
      roster: [...roster.slice(4), ...roster.slice(0, 4)],
      seed,
    })).toEqual(expected);
  });

  it("varies the winner's lane and the whole formation across courses", () => {
    const roster = createTeams(10);
    const winnerLanes = new Set<number>();
    const formations = new Set<string>();

    for (let course = 0; course < 128; course += 1) {
      const lanes = orderSprintVisualLanes({ roster, seed: `course-${course}` });
      winnerLanes.add(lanes.findIndex((team) => team.teamId === "team-0"));
      formations.add(lanes.map((team) => team.teamId).join(","));
    }

    expect(winnerLanes.size).toBeGreaterThanOrEqual(8);
    expect(formations.size).toBeGreaterThanOrEqual(64);
  });

  it.each([0, 1, 10])("preserves all %i teams without adding or duplicating riders", (count) => {
    const roster = createTeams(count);
    const lanes = orderSprintVisualLanes({ roster, seed: "roster-boundaries" });

    expect(lanes).toHaveLength(count);
    expect(new Set(lanes.map((team) => team.teamId)).size).toBe(count);
    expect(lanes.map((team) => team.teamId).sort())
      .toEqual(roster.map((team) => team.teamId).sort());
    const riderIds = lanes.flatMap((team) => team.riderIds);
    expect(new Set(riderIds).size).toBe(riderIds.length);
    expect([...riderIds].sort())
      .toEqual(roster.flatMap((team) => team.riderIds).sort());
  });

  it("does not mutate its input and keeps the actual teams and trains intact", () => {
    const roster = Object.freeze(createTeams(10));
    const before = JSON.stringify(roster);
    const lanes = orderSprintVisualLanes({ roster, seed: "preserve-trains" });

    expect(lanes).not.toBe(roster);
    expect(JSON.stringify(roster)).toBe(before);
    for (const lane of lanes) {
      const originalTeam = roster.find((team) => team.teamId === lane.teamId)!;
      expect(lane).toBe(originalTeam);
      expect(lane.riderIds).toBe(originalTeam.riderIds);
      expect(lane.leadoutRiderIds).toBe(originalTeam.leadoutRiderIds);
      expect(lane.contenderRiderId).toBe(originalTeam.contenderRiderId);
    }
  });

  it("retains a podium of teammates, including a leadout who really finished second", () => {
    const roster = buildSprintVisualRoster({
      riders: [
        { id: "first", teamId: "podium-team", role: "sprinter" },
        { id: "second", teamId: "podium-team", role: "leadout" },
        { id: "third", teamId: "podium-team", role: "leader" },
        { id: "helper", teamId: "podium-team", role: "leadout" },
        { id: "opponent", teamId: "other-team", role: "sprinter" },
      ],
      favoriteRiderIds: ["first", "opponent"],
      requiredRiderIds: ["first", "second", "third"],
    });
    const originalTeam = roster.find((team) => team.teamId === "podium-team")!;
    const lanes = orderSprintVisualLanes({ roster, seed: "shared-podium" });
    const podiumTeam = lanes.find((team) => team.teamId === "podium-team")!;

    expect(podiumTeam).toBe(originalTeam);
    expect(podiumTeam.contenderRiderIds)
      .toEqual(expect.arrayContaining(["first", "second", "third"]));
    expect(podiumTeam.leadoutRiderIds).toEqual(["helper"]);
    expect(podiumTeam.riderIds)
      .toEqual(expect.arrayContaining(["first", "second", "third", "helper"]));
    expect(lanes.filter((team) => team.teamId === "podium-team")).toHaveLength(1);
  });

  it("keeps official finish crossings ordered when the winner is in a lower lane", () => {
    const roster = createTeams(10);
    const results = roster.map((team, index) => ({
      riderId: team.contenderRiderId,
      rank: index + 1,
      gapToWinnerSeconds: index < 5 ? 0 : 2,
    }));
    const before = JSON.stringify(results);
    const crossingTimes = (lanes: SprintVisualRosterTeam[]) => lanes
      .map((team) => results.find((result) => result.riderId === team.contenderRiderId)!)
      .sort((first, second) => first.rank - second.rank)
      .map((result) => getFinishVisualCrossingTimeSeconds({
        rank: result.rank,
        gapToWinnerSeconds: result.gapToWinnerSeconds,
        sameTimeOrderIndex: getFinishSameTimeOrderIndex({ ...result, results }),
      }));
    const lowerWinnerLanes = Array.from({ length: 32 }, (_, index) =>
      orderSprintVisualLanes({ roster, seed: `crossing-course-${index}` }))
      .find((lanes) => lanes.findIndex((team) => team.teamId === "team-0") >= 5);

    expect(lowerWinnerLanes).toBeDefined();
    const times = crossingTimes(lowerWinnerLanes!);
    expect(times).toEqual(crossingTimes(roster));
    expect(times[0]).toBe(0);
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index]).toBeGreaterThan(times[index - 1]);
    }
    expect(JSON.stringify(results)).toBe(before);
  });
});
