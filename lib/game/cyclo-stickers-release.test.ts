import { describe, expect, it } from "vitest";
import raw from "@/data/collector-album-pilot.json";
import source from "@/data/collector-album-intro-pilot.json";
import { CYCLO_STICKERS_RELEASE, assertCycloStickersFinalSnapshot, canLaunchCycloStickers, createCycloStickersPreview } from "./cyclo-stickers-release";
import { ALBUM_ACHIEVEMENTS, createAlbumPilotState, drawAlbumBooster, getAlbumAchievementProgress, getAlbumBoosterOdds, getAlbumPilotPacks, getCollectorCardRarity, readAlbumPilotState, updateAlbumPilot, type CollectorAlbumSnapshot } from "./collector-album";
import { getAlbumProfileCards } from "./collector-album-layout";
const original=raw as CollectorAlbumSnapshot;
const snapshot=createCycloStickersPreview(original,source);

describe("S4 collection and S5 launch rehearsal",()=>{
  it("preserves every frozen S3 rider and isolates the new preview inventory",()=>{
    expect(snapshot.cards.slice(0,50)).toEqual(original.cards);
    expect(snapshot.sourceSeason).toBe(3);expect(snapshot.ratingsFrozenFromSeason).toBe(3);
    expect(snapshot.presentationSeason).toBe(4);expect(snapshot.launchSeason).toBe(5);
    expect(snapshot.edition).not.toBe(original.edition);
    expect(snapshot.cards).toHaveLength(68);
    expect(snapshot.cards.slice(50).map(card=>card.number)).toEqual(Array.from({length:18},(_,i)=>i+51));
    expect(snapshot.cards.filter(card=>card.kind==="team")).toHaveLength(5);
    expect(snapshot.cards.filter(card=>card.kind==="continental")).toHaveLength(10);
    expect(snapshot.cards.filter(card=>card.kind==="world")).toHaveLength(2);
    expect(snapshot.cards.filter(card=>card.kind==="games")).toHaveLength(1);
    expect(snapshot.cards.filter(card=>card.kind==="world").every(card=>!card.specimen)).toBe(true);
    expect(snapshot.cards.filter(card=>card.kind==="continental"||card.kind==="games").every(card=>card.specimen)).toBe(true);
    for(const profile of new Set(original.cards.map(card=>card.profileKey))) expect(getAlbumProfileCards(snapshot.cards,profile)).toEqual(getAlbumProfileCards(original.cards,profile));
  });
  it("keeps legacy saves untouched and persists bonus stickers without allowing invented copies",()=>{
    const initial=createAlbumPilotState(snapshot.collectionSeason,snapshot.cards);
    expect(initial.owned).toHaveLength(20);
    let state=updateAlbumPilot(initial,{type:"paste",card:68},snapshot.cards);
    state=updateAlbumPilot(state,{type:"open-pack",id:getAlbumPilotPacks()[0].id,season:4,cards:[68,51]},snapshot.cards);
    state=updateAlbumPilot(state,{type:"propose",give:[68,51],receive:9},snapshot.cards);
    expect(state.pending?.give).toEqual([68,51]);
    state=updateAlbumPilot(state,{type:"accept"},snapshot.cards);
    expect(state.pasted).toContain(68);
    expect(readAlbumPilotState(JSON.stringify(state),4,snapshot.cards)).toEqual(state);
    expect(readAlbumPilotState(JSON.stringify({...state,owned:[...state.owned,68]}),4,snapshot.cards)).toEqual(initial);
    expect(updateAlbumPilot(initial,{type:"open-pack",id:getAlbumPilotPacks()[0].id,season:4,cards:[69,51]},snapshot.cards)).toBe(initial);
    expect(createAlbumPilotState().owned).toEqual([1,8]);
  });
  it("requires all 68 stickers, not only the original 50, for the final trophy",()=>{
    const final=ALBUM_ACHIEVEMENTS.find(a=>a.trophy)!;
    const state={...createAlbumPilotState(4,snapshot.cards),pasted:original.cards.map(card=>card.number)};
    expect(getAlbumAchievementProgress(final,state,snapshot.cards)).toEqual({value:50,target:68});
    expect(updateAlbumPilot(state,{type:"claim-achievement",id:final.id},snapshot.cards)).toBe(state);
    expect(getAlbumAchievementProgress(final,{...state,pasted:snapshot.cards.map(card=>card.number)},snapshot.cards)).toEqual({value:68,target:68});
  });
  it("includes the ultra-holographic sticker in two-card test packs with explicit tier odds",()=>{
    expect(getAlbumBoosterOdds(snapshot.cards)).toEqual({bronze:80,silver:16.9,gold:3,holographic:.1});
    expect(drawAlbumBooster(snapshot.cards,[.999,0,.9999,0])).toEqual([68,68]);
    expect(.1).toBeLessThan(3/7);
    expect(3/7).toBeLessThan(16.9/30);
    expect(getCollectorCardRarity(snapshot.cards[67])).toBe("holographic");
    expect(getAlbumBoosterOdds(original.cards)).toEqual({bronze:80,silver:17,gold:3,holographic:0});
  });
  it("never arms the local demo automatically, including after S5 begins",()=>{
    expect(CYCLO_STICKERS_RELEASE.publicReady).toBe(false);
    expect(canLaunchCycloStickers(5,4,true)).toBe(false);
    expect(canLaunchCycloStickers(4,4,true,true)).toBe(false);
    expect(canLaunchCycloStickers(5,3,true,true)).toBe(false);
    expect(canLaunchCycloStickers(5,4,false,true)).toBe(false);
    expect(canLaunchCycloStickers(5,4,true,true)).toBe(true);
    expect(()=>assertCycloStickersFinalSnapshot(snapshot,"completed")).toThrow();
    expect(()=>assertCycloStickersFinalSnapshot({...snapshot,sourceSeason:4,ratingsFrozenFromSeason:4,collectionSeason:5},"active")).toThrow();
  });
  it("accepts a complete isolated S4 fixture but rejects duplicates and incorrect title jerseys",()=>{
    const fixture={...snapshot,sourceSeason:4,ratingsFrozenFromSeason:4,collectionSeason:5,cards:snapshot.cards.map(card=>({...card,specimen:false}))};
    expect(()=>assertCycloStickersFinalSnapshot(fixture,"completed")).not.toThrow();
    for(const broken of [
      {...fixture,cards:fixture.cards.slice(0,67)},
      {...fixture,cards:fixture.cards.map((card,i)=>i===67?{...card,number:67}:card)},
      {...fixture,cards:fixture.cards.map((card,i)=>i===67?{...card,id:fixture.cards[66].id}:card)},
      {...fixture,cards:fixture.cards.map(card=>card.kind==="games"?{...card,jersey:{...card.jersey,championshipType:"time_trial" as const}}:card)},
      {...fixture,cards:fixture.cards.map(card=>card.kind==="continental"?{...card,jersey:{...card.jersey,continentCode:"europe" as const}}:card)},
    ]) expect(()=>assertCycloStickersFinalSnapshot(broken,"completed")).toThrow();
  });
});
