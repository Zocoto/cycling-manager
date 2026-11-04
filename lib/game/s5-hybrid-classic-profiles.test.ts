import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {getRaceProfileLabel} from "./race-calendar";
import {getStageDistance,type RaceStageSegment} from "./race-profiles";
import {getRoadFinishMode,isLikelyMassSprint} from "./race-simulation";
import {translateUiText} from "@/lib/i18n/ui-translations";

type HybridRoute={slug:string;category:string;distance:number;segments:[number,RaceStageSegment["terrain"],RaceStageSegment["surface"],number][]};
const routes:HybridRoute[]=JSON.parse(readFileSync(new URL("../../scripts/fixtures/s5-hybrid-classic-routes.json",import.meta.url),"utf8"));

describe("S5 hybrid classics",()=>{
  it.each(routes)("keeps $slug selective near the finish, with a reduced sprint still possible",route=>{
    const segments:RaceStageSegment[]=route.segments.map(([distanceKm,terrain,surface,averageGradientPct],i)=>({
      segmentNumber:i+1,distanceKm,terrain,surface,averageGradientPct,prime:null,
    }));
    expect(getStageDistance(segments)).toBe(route.distance);
    expect(segments.filter(s=>s.terrain==="climb").length).toBeGreaterThanOrEqual(5);
    expect(segments.filter(s=>s.terrain==="climb").every(s=>s.distanceKm<=3&&s.averageGradientPct<=7)).toBe(true);
    expect(segments.some(s=>s.terrain==="climb"&&s.surface==="cobbles")).toBe(true);
    expect(isLikelyMassSprint(segments)).toBe(false);
    expect(getRoadFinishMode(segments,8)).toBe("reduced_sprint");
    expect(getRoadFinishMode(segments,1)).toBe("selective");
  });
  it("labels both underlying sporting domains consistently in French and English",()=>{
    expect(getRaceProfileLabel({profileType:"hilly",profileVariant:"hilly_cobbles"})).toBe("Pavé / Vallonné");
    expect(getRaceProfileLabel({profileType:"cobbles",profileVariant:"hilly_cobbles"})).toBe("Pavé / Vallonné");
    expect(translateUiText("Pavé / Vallonné")).toBe("Cobbles / Hills");
    expect(new Set(routes.map(r=>r.category)).size).toBe(5);
  });
});
