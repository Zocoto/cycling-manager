import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getFederationSelectionSlots } from "@/components/game/federation-selection-workbench";
import { isFederationSelectionSlotAvailable, isOlympicSeason, getProfessionalNationsEventCount } from "./federation-olympic-programme";
import { getRaceFavoriteScore } from "./race-favorites";
import { simulateRaceStage, type RiderSimulationInput } from "./race-simulation";
import { createDemoSimulationInput } from "./race-simulation-demo";
import type { RaceCalendarStage } from "./race-calendar";
import type { RaceStageSegment } from "./race-profiles";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261012130000_single_hybrid_olympic_road_event.sql"), "utf8");
const segments: RaceStageSegment[] = Array.from(migration.matchAll(/\((\d+)::smallint, ([\d.]+)::numeric, '(flat|climb|descent)', '(asphalt|cobbles)', (-?[\d.]+)::numeric\)/g), match => ({
  segmentNumber: Number(match[1]), distanceKm: Number(match[2]), terrain: match[3] as RaceStageSegment["terrain"],
  surface: match[4] as RaceStageSegment["surface"], averageGradientPct: Number(match[5]), prime: null,
}));
const stage: RaceCalendarStage = {
  id: "olympic-road", name: "Jeux quadriennaux", dayNumber: 24, stageNumber: 1, stageType: "road", status: "planned",
  profileType: "mixed", distanceKm: 194, daySlot: "late", departureAt: null, segments,
};
const demo = createDemoSimulationInput("sprint-littoral", "olympic-test");
const rider = (id: string, overrides: Partial<RiderSimulationInput["ratings"]> = {}): RiderSimulationInput => ({
  ...demo.riders[0], id, name: id, teamId: id, teamName: id, form: 90, role: "leader", equipmentEffects: undefined,
  ratings: { ...Object.fromEntries(Object.keys(demo.riders[0].ratings).map(key => [key, 78])) as RiderSimulationInput["ratings"], ...overrides },
});

describe("single Olympic road programme", () => {
  it("requires a frozen national quota instead of a hardcoded selection limit", () => {
    for (const quota of [0,2,4,8]) {
      expect(getFederationSelectionSlots(4,quota).find(slot=>slot.id==='nc-hills')?.limit).toBe(quota);
    }
    expect(getFederationSelectionSlots(4).find(slot=>slot.id==='nc-hills')?.limit).toBe(0);
    expect(getFederationSelectionSlots(5,8).find(slot=>slot.id==='nc-hills')?.limit).toBe(1);
  });
  it("retains five professional disciplines outside Olympic seasons", () => {
    for (const year of [3,5,6,7]) {
      expect(isOlympicSeason(year)).toBe(false);
      expect(getProfessionalNationsEventCount(year)).toBe(5);
      expect(getFederationSelectionSlots(year).filter(slot => slot.competitionId === "nations-pro")).toHaveLength(5);
    }
  });
  it("exposes one hybrid slot, with no Olympic time trial, without touching juniors/CC/CM", () => {
    for (const year of [4,8]) {
      const slots = getFederationSelectionSlots(year, 8);
      expect(slots.filter(slot => slot.competitionId === "nations-pro")).toMatchObject([
        {id:"nc-hills",label:"Jeux quadriennaux · Course en ligne",limit:8,nationsCupProfile:"Polyvalent"},
      ]);
      expect(getProfessionalNationsEventCount(year)).toBe(1);
      expect(slots.filter(slot => slot.competitionId !== "nations-pro")).toEqual(getFederationSelectionSlots(3).filter(slot => slot.competitionId !== "nations-pro"));
      expect(isFederationSelectionSlotAvailable("nc-time-trial",year)).toBe(false);
      expect(isFederationSelectionSlotAvailable("nc-junior-road",year)).toBe(true);
    }
  });
  it("authors a continuous 194km course, three long climbs, repeated hills and distributed cobbles", () => {
    expect(segments).toHaveLength(21);
    expect(segments.map(s => s.segmentNumber)).toEqual(Array.from({length:21},(_,i)=>i+1));
    expect(segments.reduce((n,s)=>n+s.distanceKm,0)).toBe(194);
    expect(segments.filter(s=>s.terrain==='climb' && s.distanceKm>=8 && s.averageGradientPct>=6)).toHaveLength(3);
    expect(segments.filter(s=>s.terrain==='climb' && s.distanceKm<8)).toHaveLength(3);
    expect(segments.filter(s=>s.surface==='cobbles')).toHaveLength(3);
    expect(segments.filter(s=>s.surface==='cobbles').reduce((n,s)=>n+s.distanceKm,0)).toBe(19);
    expect(segments.at(-1)).toMatchObject({terrain:'flat',surface:'asphalt',distanceKm:8,averageGradientPct:0});
    expect(segments.reduce((n,s)=>n+s.distanceKm*s.averageGradientPct,0)).toBeCloseTo(0);
  });
  it("actually values climbing, cobbles, endurance and sprint on this authored course", () => {
    const edition = {raceFormat:"one_day" as const,stages:[stage]};
    const base = rider("complete");
    const baseline = getRaceFavoriteScore(edition, base);
    for (const stat of ['mountain','hills','cobbles','endurance','sprint'] as const) {
      expect(getRaceFavoriteScore(edition,rider(stat,{[stat]:88}))).toBeGreaterThan(baseline);
    }
    expect(getRaceFavoriteScore(edition,rider('pure-sprinter',{mountain:40,hills:48,cobbles:42,endurance:60,sprint:99,acceleration:94}))).toBeLessThan(baseline);
  });
  it("runs the authored route in the unchanged engine with every rider accounted for", () => {
    let completeRanks=0, specialistRanks=0;
    for (let seed=0;seed<6;seed++) {
      const riders=Array.from({length:16},(_,i)=>i<8 ? rider(`complete-${i}`) : rider(`sprint-${i}`,{mountain:40,hills:48,cobbles:42,endurance:60,sprint:99,acceleration:94}));
      const simulation=simulateRaceStage({id:stage.id,name:stage.name,stageType:'road',profileType:'mixed',isStageRace:false,seed:`olympic-${seed}`,segments,riders});
      expect(new Set(simulation.results.map(r=>r.riderId)).size).toBe(riders.length);
      expect(simulation.results.every(r=>Number.isFinite(r.elapsedTimeSeconds) && r.gapToWinnerSeconds>=0)).toBe(true);
      expect(simulation.results.filter(r=>r.rank===1)).toHaveLength(1);
      for (const result of simulation.results) {
        if (result.riderId.startsWith('complete')) completeRanks+=result.rank ?? 30;
        else specialistRanks+=result.rank ?? 30;
      }
    }
    expect(completeRanks).toBeLessThan(specialistRanks);
  });
  it("handles the full 220-rider Olympic field without losing or duplicating starters", () => {
    const riders = Array.from({ length: 60 }, (_, nation) => {
      const quota = nation < 10 ? 8 : nation < 30 ? 4 : 2;
      return Array.from({ length: quota }, (_, index) => ({
        ...rider(`nation-${nation}-rider-${index}`),
        teamId: `nation-${nation}`, teamName: `nation-${nation}`,
        role: index === 0 ? "leader" as const : "domestique" as const,
      }));
    }).flat();
    const simulation = simulateRaceStage({ id: stage.id, name: stage.name, stageType: "road", profileType: "mixed", isStageRace: false, seed: "olympic-full-field", segments, riders });
    expect(riders).toHaveLength(220);
    expect(simulation.results).toHaveLength(220);
    expect(new Set(simulation.results.map(result => result.riderId)).size).toBe(220);
    expect(simulation.results.filter(result => result.rank === 1)).toHaveLength(1);
    expect(simulation.results.every(result => Number.isFinite(result.elapsedTimeSeconds) && result.gapToWinnerSeconds >= 0)).toBe(true);
  });
});
