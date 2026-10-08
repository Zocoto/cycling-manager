import { describe, it, expect } from "vitest";
import { createRunnerPreview, stepRunnerPreview, runnerSnapshot } from "./halloween-runner";
import { validateHalloweenRun, halloweenParisDay, HALLOWEEN_START, HALLOWEEN_END } from "./halloween-event";
import { halloweenAvatarArts, originalHalloweenAvatarKey } from "./halloween-avatar";
import { resolveSportingDirectorAvatar, isSportingDirectorAvatarKey } from "../sporting-director-avatar";

describe("Halloween production proof", () => {
  for (const seed of [1, 42, 20261009, 4294967295]) it(`replays a complete deterministic run ${seed}`, () => {
    const run=createRunnerPreview(seed);const commands=[];let duck=false;
    while(!run.ended && run.tick<100000){
      const jump=run.tick%90===0, nextDuck=run.tick%240>180;
      if(jump||nextDuck!==duck) commands.push({tick:run.tick,...(jump?{jump:true}:{}),...(duck!==nextDuck?{duck:nextDuck}:{})});
      duck=nextDuck;stepRunnerPreview(run,jump,duck);
    }
    expect(run.ended).toBe(true);
    const proof={ticks:run.tick,commands};
    expect(validateHalloweenRun(seed,proof,run.tick/60+1)).toEqual(runnerSnapshot(run));
    expect(()=>validateHalloweenRun(seed,proof,0)).toThrow(/Durée/);
    expect(()=>validateHalloweenRun(seed,{...proof,ticks:run.tick+1},run.tick/60+1)).toThrow(/dépasse/);
  });
  it("rejects unfinished, oversized and impossible commands",()=>{
    expect(()=>validateHalloweenRun(1,{ticks:1,commands:[]},10)).toThrow(/terminée/);
    for(const commands of [[{tick:-1,jump:true}],[{tick:0,jump:false}],[{tick:0,duck:"yes"}],[{tick:0,jump:true},{tick:0,duck:true}],[{tick:0,jump:true,coins:999}]]) expect(()=>validateHalloweenRun(1,{ticks:20,commands},10)).toThrow(/Commandes/);
    expect(()=>validateHalloweenRun(1,{ticks:108001,commands:[]},2000)).toThrow(/Durée/);
    expect(()=>validateHalloweenRun(1,{ticks:20000,commands:Array(12001).fill({tick:0,jump:true})},400)).toThrow(/Commandes/);
  });
  it("uses Paris days through midnight and the clock change",()=>{
    expect(halloweenParisDay(new Date(HALLOWEEN_START))).toBe("2026-10-09");
    expect(halloweenParisDay(new Date(HALLOWEEN_END))).toBe("2026-11-03");
    expect(halloweenParisDay(new Date("2026-10-24T22:01Z"))).toBe("2026-10-25");
    expect(halloweenParisDay(new Date("2026-10-25T22:01Z"))).toBe("2026-10-25");
    expect(halloweenParisDay(new Date("2026-10-25T23:01Z"))).toBe("2026-10-26");
  });
});
describe("Halloween portraits",()=>{
  it("preserves the original native appearance",()=>{
    const key="director_f_02~halloween~vlad,cap,web";
    expect(resolveSportingDirectorAvatar(key)).toEqual(resolveSportingDirectorAvatar("director_f_02"));
    expect(isSportingDirectorAvatarKey(key)).toBe(true);
    expect(originalHalloweenAvatarKey(key)).toBe("director_f_02");
    expect(halloweenAvatarArts(key)).toEqual(["vlad","cap","web"]);
    expect(halloweenAvatarArts("director_f_02~halloween~unknown,vlad,vlad")).toEqual(["vlad"]);
    expect(halloweenAvatarArts("director_f_02")).toEqual([]);
  });
});
