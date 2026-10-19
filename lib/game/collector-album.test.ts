import { describe, expect, it } from "vitest";
import snapshot from "@/data/collector-album-pilot.json";
import { canAccessCollectorAlbum } from "./collector-album-access";
import { ALBUM_PROFILES, albumPilotStorageKey, createAlbumPilotState, getCardRarity, readAlbumPilotState, updateAlbumPilot } from "./collector-album";

describe("private collector pilot", () => {
  it("is bound to the owner's authenticated UUID, not team names or an email", () => {
    expect(canAccessCollectorAlbum("58140add-54c6-40af-9528-f823d0051d0f")).toBe(true);
    for (const id of [undefined, null, "", "Abbaye du Lion", "paul.leblanc22@gmail.com", "f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57", "58140add-54c6-40af-9528-f823d0051d0f "]) expect(canAccessCollectorAlbum(id)).toBe(false);
  });
  it("contains exactly 50 distinct, truthful source-season snapshots and complete native stats", () => {
    expect(snapshot.sourceSeason).toBe(3);
    expect(snapshot.collectionSeason).toBe(4);
    expect(snapshot.cards).toHaveLength(50);
    expect(new Set(snapshot.cards.map(c=>c.id)).size).toBe(50);
    expect(snapshot.cards.map(c=>c.number)).toEqual(Array.from({length:50},(_,i)=>i+1));
    for (const c of snapshot.cards) {
      expect(ALBUM_PROFILES.some(p=>p.id === c.profileKey)).toBe(true);
      expect(c.jersey.imagePath).toMatch(/^\/images\/sponsors\//);
      expect(c.rank).toBeGreaterThan(0);
      expect(c.points).toBeGreaterThan(0);
      expect(c.victories).toBeGreaterThanOrEqual(0);
      expect(Object.keys(c.ratings)).toHaveLength(13);
      for (const value of Object.values(c.ratings)) {expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(100);}
    }
    expect([5,6,20,21,50].map(getCardRarity)).toEqual(["gold","silver","silver","bronze","bronze"]);
  });
  it("has only two owned demo cards; sticking never creates another copy", () => {
    const initial=createAlbumPilotState();
    expect(initial.owned).toEqual([1,8]);
    const pasted=updateAlbumPilot(initial,{type:"paste",card:1});
    expect(pasted.pasted).toEqual([1]);
    expect(updateAlbumPilot(pasted,{type:"paste",card:1})).toBe(pasted);
    expect(updateAlbumPilot(pasted,{type:"paste",card:9})).toBe(pasted);
    expect(updateAlbumPilot(pasted,{type:"unpaste",card:1}).owned).toEqual(initial.owned);
  });
  it("reserves an offer without moving cards; prevents sticking or offering it twice", () => {
    const pending=updateAlbumPilot(createAlbumPilotState(),{type:"propose",give:8,receive:9});
    expect(pending.owned).toEqual([1,8]);
    expect(pending.partners["collector-demo"]).toEqual([9]);
    expect(pending.pending).toEqual({give:[8],receive:9,partnerId:"collector-demo"});
    expect(updateAlbumPilot(pending,{type:"paste",card:8})).toBe(pending);
    expect(updateAlbumPilot(pending,{type:"propose",give:1,receive:9})).toBe(pending);
  });
  it("never trades pasted, unowned, or unavailable cards", () => {
    let state=updateAlbumPilot(createAlbumPilotState(),{type:"paste",card:8});
    expect(updateAlbumPilot(state,{type:"propose",give:8,receive:9})).toBe(state);
    state=createAlbumPilotState();
    expect(updateAlbumPilot(state,{type:"propose",give:9,receive:8})).toBe(state);
    expect(updateAlbumPilot(state,{type:"propose",give:8,receive:50})).toBe(state);
  });
  it("accepts atomically, is idempotent and preserves exactly two cards for the owner", () => {
    const pending=updateAlbumPilot(createAlbumPilotState(),{type:"propose",give:8,receive:9});
    const accepted=updateAlbumPilot(pending,{type:"accept"});
    expect(accepted.owned).toEqual([1,9]);
    expect(accepted.partners["collector-demo"]).toEqual([8]);
    expect(accepted.pending).toBeNull();
    expect(updateAlbumPilot(accepted,{type:"accept"})).toBe(accepted);
    expect(accepted.history[0].outcome).toBe("accepted");
    expect(readAlbumPilotState(JSON.stringify(accepted))).toEqual(accepted);
  });
  it.each(["cancel","decline"] as const)("%s releases the reserved card without transferring ownership", type=>{
    const result=updateAlbumPilot(updateAlbumPilot(createAlbumPilotState(),{type:"propose",give:8,receive:9}),{type});
    expect(result.owned).toEqual([1,8]);
    expect(result.partners["collector-demo"]).toEqual([9]);
    expect(result.pending).toBeNull();
    expect(updateAlbumPilot(result,{type:"paste",card:8}).pasted).toEqual([8]);
  });
  it("bounds history and supports fully reversible resets", () => {
    let state=createAlbumPilotState();
    for(let i=0;i<20;i++) state=updateAlbumPilot(updateAlbumPilot(state,{type:"propose",give:8,receive:9}),{type:"cancel"});
    expect(state.history).toHaveLength(10);
    expect(updateAlbumPilot(state,{type:"reset"})).toEqual(createAlbumPilotState());
  });
  it("ignores corrupt or inflated local previews", () => {
    const initial=createAlbumPilotState();
    for(const raw of [null,"bad","null","{}",JSON.stringify({...initial,owned:[1,8,9]}),JSON.stringify({...initial,owned:[1,1]}),JSON.stringify({...initial,pasted:[9]}),JSON.stringify({...initial,pasted:[1,1]}),JSON.stringify({...initial,pending:{give:1,receive:50}}),JSON.stringify({...initial,history:[{}]})]) expect(readAlbumPilotState(raw)).toEqual(initial);
    expect(albumPilotStorageKey("owner","edition")).not.toBe(albumPilotStorageKey("another","edition"));
  });
});
