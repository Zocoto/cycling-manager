import { describe, expect, it } from "vitest";
import { buildRaceReplayTiming, isRaceReplaySpeed } from "./race-replay-timing";
import { getFinalReplayFrame } from "./race-finish-visual";
import type { StageSimulationResult } from "./race-simulation";

function simulation(clocks: Array<number | undefined>, winnerSeconds?: number): Pick<StageSimulationResult, "timeline" | "results"> {
  return {
    timeline: clocks.map((clock, index) => ({
      segmentNumber: index + 1, completedDistanceKm: (index + 1) * 10,
      groups: [{id:"peloton",label:"Peloton",type:"peloton",riderIds:["winner"],gapToLeaderSeconds:0,averageEnergy:60,elapsedTimeSeconds:clock}],
      incidents:[],abandonments:[],commentary:[],
    })),
    results: winnerSeconds === undefined ? [] : [{riderId:"winner",rank:1,status:"finished",elapsedTimeSeconds:winnerSeconds,gapToWinnerSeconds:0,energyAfter:30,injury:null,abandonment:null}],
  };
}

describe("real-time race replay timing", () => {
  it("uses each recorded sector duration instead of a fixed six seconds", () => {
    const source=simulation([900,2100,3000],3000), before=structuredClone(source);
    const timing=buildRaceReplayTiming(source,[{distanceKm:10},{distanceKm:10},{distanceKm:10}]);
    expect(timing.segmentDurationsMs).toEqual([900_000,1_200_000,900_000]);
    expect(timing.segmentStartTimesMs).toEqual([0,900_000,2_100_000]);
    expect(timing.totalDurationMs).toBe(3_000_000);
    expect(timing.finalApproachDurationMs).toBe(810_000);
    expect(timing.finalKilometerDurationMs).toBe(90_000);
    expect(source).toEqual(before);
  });
  it("uses the leading clock even when the peloton is behind or group order differs", () => {
    const source=simulation([1050,2100],2100);
    source.timeline[0].groups.push({...source.timeline[0].groups[0],id:"breakaway",type:"breakaway",elapsedTimeSeconds:900});
    expect(buildRaceReplayTiming(source,[{distanceKm:10},{distanceKm:10}]).segmentDurationsMs).toEqual([900_000,1_200_000]);
  });
  it("interpolates historical missing clocks by distance between valid anchors", () => {
    expect(buildRaceReplayTiming(simulation([600,undefined,2400],2400),[{distanceKm:10},{distanceKm:5},{distanceKm:15}]).segmentDurationsMs)
      .toEqual([600_000,450_000,1_350_000]);
  });
  it("retains the real overall winning time when all historical group clocks are missing", () => {
    const timing=buildRaceReplayTiming(simulation([undefined,undefined],3600),[{distanceKm:10},{distanceKm:30}]);
    expect(timing.segmentDurationsMs).toEqual([900_000,2_700_000]);
    expect(timing.totalDurationMs).toBe(3_600_000);
  });
  it("does not let invalid or out-of-order historical clocks make the replay reverse or last indefinitely", () => {
    const timing=buildRaceReplayTiming(simulation([900,800,Number.NaN,Number.POSITIVE_INFINITY,5000],5000),Array.from({length:5},()=>({distanceKm:10})));
    expect(timing.totalDurationMs).toBe(5_000_000);
    expect(timing.segmentDurationsMs.every(value=>Number.isFinite(value)&&value>0)).toBe(true);
    expect(timing.segmentDurationsMs.reduce((a,b)=>a+b,0)).toBeCloseTo(5_000_000);
    expect(buildRaceReplayTiming(simulation([999_999,undefined],3600),[{distanceKm:10},{distanceKm:30}]).totalDurationMs).toBe(3_600_000);
  });
  it("uses a realistic distance-based fallback only when no saved clock exists", () => {
    expect(buildRaceReplayTiming(simulation([undefined,undefined]),[{distanceKm:10},{distanceKm:5}]).segmentDurationsMs).toEqual([900_000,450_000]);
    expect(buildRaceReplayTiming(simulation([],undefined),[]).totalDurationMs).toBe(0);
  });
  it("keeps a short final sector proportional without charging a full kilometre", () => {
    const timing=buildRaceReplayTiming(simulation([40],40),[{distanceKm:0.5}]);
    expect(timing.finalApproachDurationMs).toBe(0);
    expect(timing.finalKilometerDurationMs).toBe(80_000);
    expect(getFinalReplayFrame({startedWithMeters:500,finalSegmentMeters:500,elapsedMs:20_000,playbackSpeed:1,approachDurationMs:timing.finalApproachDurationMs,lastKilometerDurationMs:timing.finalKilometerDurationMs}).metersRemaining).toBe(250);
  });
  it.each([1,2,4,8,16,32,64,128])("preserves the final race pace and trailing finishers at ×%s", speed => {
    const timing=buildRaceReplayTiming(simulation([900],900),[{distanceKm:10}]);
    const parameters={startedWithMeters:10_000,finalSegmentMeters:10_000,playbackSpeed:speed,approachDurationMs:timing.finalApproachDurationMs,lastKilometerDurationMs:timing.finalKilometerDurationMs,finishPassageDurationMs:20_000};
    expect(getFinalReplayFrame({...parameters,elapsedMs:855_000/speed}).metersRemaining).toBe(500);
    expect(getFinalReplayFrame({...parameters,elapsedMs:900_000/speed})).toEqual({metersRemaining:0,finishPassageProgress:0,complete:false});
    expect(getFinalReplayFrame({...parameters,elapsedMs:920_000/speed}).complete).toBe(true);
  });
  it("supports only the documented acceleration values", () => {
    expect([1,2,4,8,16,32,64,128].every(isRaceReplaySpeed)).toBe(true);
    expect([0,-1,3,NaN,Infinity,256].some(isRaceReplaySpeed)).toBe(false);
  });
  it("resumes an approach at the current metre when changing speed", () => {
    const parameters={startedWithMeters:500,finalSegmentMeters:10_000,playbackSpeed:2,approachDurationMs:810_000,lastKilometerDurationMs:90_000};
    expect(getFinalReplayFrame({...parameters,elapsedMs:0}).metersRemaining).toBe(500);
    expect(getFinalReplayFrame({...parameters,elapsedMs:11_250}).metersRemaining).toBe(250);
    expect(getFinalReplayFrame({...parameters,elapsedMs:22_500}).metersRemaining).toBe(0);
  });
  it("resumes the remaining finish passage without replaying the winner or losing trailing riders", () => {
    const parameters={startedWithMeters:0,startedWithPassageProgress:0.4,finalSegmentMeters:10_000,playbackSpeed:4,approachDurationMs:810_000,lastKilometerDurationMs:90_000,finishPassageDurationMs:20_000};
    expect(getFinalReplayFrame({...parameters,elapsedMs:0}).finishPassageProgress).toBe(0.4);
    expect(getFinalReplayFrame({...parameters,elapsedMs:1_000}).finishPassageProgress).toBeCloseTo(0.6);
    expect(getFinalReplayFrame({...parameters,elapsedMs:3_000}).complete).toBe(true);
  });
});
