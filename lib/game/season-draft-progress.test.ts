import {describe, expect, it} from "vitest";
import {getSeasonDraftProgress} from "./season-draft";
import {createDraftFixture} from "@/test/fixtures/season-draft";

describe("draft progress presentation",()=>{
  it("counts pending managers before the viewer, excluding picks and passes",()=>{
    const view=createDraftFixture();view.mine!.position=4;view.mine!.teamId="t3";
    view.edition!.status="running";view.edition!.currentPosition=2;
    view.participants![0].status="picked";view.participants![2].status="passed";
    const progress=getSeasonDraftProgress(view);
    expect(progress.current?.position).toBe(2);expect(progress.ahead).toBe(1);expect(progress.resolvedCount).toBe(2);
  });
  it("shows zero on the viewer's actual turn",()=>{
    const view=createDraftFixture();view.edition!.status="running";view.edition!.currentPosition=view.mine!.position;
    expect(getSeasonDraftProgress(view).ahead).toBe(0);
  });
  it("reports a next choice between worker bursts without claiming it is active",()=>{
    const view=createDraftFixture();view.edition!.status="running";view.edition!.currentPosition=null;
    view.participants![0].status="passed";
    expect(getSeasonDraftProgress(view)).toMatchObject({current:null,nextPosition:2,ahead:0});
  });
  it.each(["picked","passed"] as const)("hides waiting count after the viewer has %s",status=>{
    const view=createDraftFixture();view.mine!.status=status;
    expect(getSeasonDraftProgress(view).ahead).toBeNull();
  });
  it("does not invent counts from incomplete data or an already-passed position",()=>{
    const view=createDraftFixture();view.participants=[];expect(getSeasonDraftProgress(view).ahead).toBeNull();
    const running=createDraftFixture();running.edition!.status="running";running.edition!.currentPosition=3;
    expect(getSeasonDraftProgress(running).ahead).toBeNull();
  });
  it("uses saved names first, and the existing pool snapshot as fallback",()=>{
    const view=createDraftFixture();const p=view.participants![0];p.status="picked";p.selectedRiderId=view.riders![0].id;
    expect(getSeasonDraftProgress(view).selectedNames.get(p.teamId)).toBe("Alex Exemple 1");
    p.selectedName="Nom conservé";expect(getSeasonDraftProgress(view).selectedNames.get(p.teamId)).toBe("Nom conservé");
  });
  it("keeps six latest resolved choices in reverse order, including passes, without mutating the queue",()=>{
    const view=createDraftFixture();const seed=view.participants![0];
    view.participants=Array.from({length:9},(_,i)=>({...seed,teamId:`t${i}`,position:i+1,status:i===8?("pending" as const):("picked" as const)}));
    const order=view.participants.map(p=>p.position);
    expect(getSeasonDraftProgress(view).recentChoices.map(p=>p.position)).toEqual([8,7,6,5,4,3]);
    expect(view.participants.map(p=>p.position)).toEqual(order);
  });
  it("does not expose a current or next turn after completion or cancellation",()=>{
    for(const status of ["completed","cancelled"] as const){const view=createDraftFixture();view.edition!.status=status;
      expect(getSeasonDraftProgress(view)).toMatchObject({current:null,nextPosition:null,ahead:null});}
  });
});
