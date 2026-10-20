import {describe,expect,it} from "vitest";
import raw from "@/data/collector-album-pilot.json";
import { ALBUM_ACHIEVEMENTS, ALBUM_BOOSTER_ODDS, ALBUM_PILOT_EDITION, ALBUM_PILOT_SEASON, createAlbumPilotState, drawAlbumBooster, getAlbumAchievementProgress, getAlbumPilotPacks, getCardRarity, getLooseAlbumCardCount, readAlbumPilotState, updateAlbumPilot, type CollectorAlbumSnapshot } from "./collector-album";
const snapshot=raw as CollectorAlbumSnapshot;
const packs=getAlbumPilotPacks();
describe("seasonal booster preview",()=>{
  it("keeps the inventory entry, route and catalogue on the same edition",()=>{
    expect(snapshot.edition).toBe(ALBUM_PILOT_EDITION);
    expect(snapshot.collectionSeason).toBe(ALBUM_PILOT_SEASON);
    expect(getAlbumPilotPacks(5).every(p=>p.season===5 && p.id.startsWith('s5-'))).toBe(true);
  });
  it("draws exactly two independent cards and permits duplicates",()=>{
    expect(drawAlbumBooster(snapshot.cards,[0,0,0,0])).toEqual([21,21]);
    expect(drawAlbumBooster(snapshot.cards,[.8,0,.97,0])).toEqual([6,1]);
    expect(drawAlbumBooster(snapshot.cards,[.969999,.999999,.999999,.999999])).toEqual([20,5]);
    for(const rolls of [[0,0],[1,0,0,0],[-.1,0,0,0],[NaN,0,0,0],[Infinity,0,0,0]]) expect(()=>drawAlbumBooster(snapshot.cards,rolls)).toThrow();
  });
  it("uses 80/17/3 tier odds, with each gold card rarer than each silver, then bronze",()=>{
    expect(Object.values(ALBUM_BOOSTER_ODDS).reduce((a,b)=>a+b,0)).toBe(100);
    const count={bronze:0,silver:0,gold:0};
    for(let i=0;i<10000;i++) count[getCardRarity(snapshot.cards.find(c=>c.number===drawAlbumBooster(snapshot.cards,[i/10000,0,0,0])[0])!.rank)]++;
    expect(count).toEqual({bronze:8000,silver:1700,gold:300});
    expect(3/5).toBeLessThan(17/15);expect(17/15).toBeLessThan(80/30);
  });
  it("consumes one season-bound pack exactly once, never creating extra copies on retries",()=>{
    const initial=createAlbumPilotState();
    const open=updateAlbumPilot(initial,{type:"open-pack",id:packs[0].id,season:4,cards:[21,21]});
    expect(open.owned).toEqual([1,8,21,21]);expect(open.openedPacks).toHaveLength(1);
    expect(updateAlbumPilot(open,{type:"open-pack",id:packs[0].id,season:4,cards:[1,2]})).toBe(open);
    expect(updateAlbumPilot(initial,{type:"open-pack",id:packs[0].id,season:5,cards:[1,2]})).toBe(initial);
    expect(updateAlbumPilot(initial,{type:"open-pack",id:"invented",season:4,cards:[1,2]})).toBe(initial);
    expect(updateAlbumPilot(initial,{type:"open-pack",id:packs[0].id,season:4,cards:[0,51]})).toBe(initial);
    expect(readAlbumPilotState(JSON.stringify(open))).toEqual(open);
    expect(readAlbumPilotState(JSON.stringify(open),5)).toEqual(createAlbumPilotState(5));
  });
  it("preserves the previously deployed v1 album and exchange state when migrating",()=>{
    const legacy={version:1,owned:[1,9],partner:[8],pasted:[1],pending:null,history:[{give:8,receive:9,outcome:"accepted"}]};
    const migrated=readAlbumPilotState(JSON.stringify(legacy));
    expect(migrated.version).toBe(3);expect(migrated.pasted).toEqual([1]);expect(migrated.owned).toEqual([1,9]);expect(migrated.openedPacks).toEqual([]);expect(migrated.acceptedTradeCount).toBe(1);
  });
  it("keeps the pasted copy when a spare is traded, and never trades both duplicates",()=>{
    let state=updateAlbumPilot(createAlbumPilotState(),{type:"open-pack",id:packs[0].id,season:4,cards:[8,21]});
    state=updateAlbumPilot(state,{type:"paste",card:8});
    expect(getLooseAlbumCardCount(state,8)).toBe(1);
    state=updateAlbumPilot(state,{type:"propose",give:8,receive:9});
    expect(getLooseAlbumCardCount(state,8)).toBe(0);
    state=updateAlbumPilot(state,{type:"accept"});
    expect(state.owned.filter(id=>id===8)).toHaveLength(1);expect(state.pasted).toEqual([8]);expect(state.owned).toHaveLength(4);
    expect(readAlbumPilotState(JSON.stringify(state))).toEqual(state);
  });
  it("rejects corrupted supply, duplicate pack receipts, and unrecognised claims",()=>{
    const state=updateAlbumPilot(createAlbumPilotState(),{type:"open-pack",id:packs[0].id,season:4,cards:[21,22]});
    for(const corrupt of [{...state,owned:[...state.owned,50]},{...state,openedPacks:[...state.openedPacks,...state.openedPacks]},{...state,claimedAchievements:["not-known"]},{...state,acceptedTradeCount:-1}]) expect(readAlbumPilotState(JSON.stringify(corrupt))).toEqual(createAlbumPilotState());
  });
  it("does not treat two identical cards as a meaningful trade",()=>{
    const state=updateAlbumPilot(createAlbumPilotState(),{type:"open-pack",id:packs[0].id,season:4,cards:[9,21]});
    expect(updateAlbumPilot(state,{type:"propose",give:9,receive:9})).toBe(state);
    expect(state.acceptedTradeCount).toBe(0);
  });
});
describe("seasonal collection achievement preview",()=>{
  it("has 19 unique achievements and an explicit large final reward, without rewarding cards or boosters",()=>{
    expect(ALBUM_ACHIEVEMENTS).toHaveLength(19);expect(new Set(ALBUM_ACHIEVEMENTS.map(a=>a.id)).size).toBe(19);
    const final=ALBUM_ACHIEVEMENTS.find(a=>a.id==='count-50')!;
    expect(final).toMatchObject({cash:250000,xp:1000,reputation:100,trophy:true});
    expect(ALBUM_ACHIEVEMENTS.reduce((sum,a)=>sum+a.cash,0)).toBe(712500);
    expect(ALBUM_ACHIEVEMENTS.some(a=>'booster' in a || 'cards' in a)).toBe(false);
  });
  it("counts distinct pasted cards rather than copies, and claims an unlocked preview once",()=>{
    let state=updateAlbumPilot(createAlbumPilotState(),{type:"open-pack",id:packs[0].id,season:4,cards:[1,1]});
    const first=ALBUM_ACHIEVEMENTS[0];
    expect(updateAlbumPilot(state,{type:"claim-achievement",id:first.id},snapshot.cards)).toBe(state);
    state=updateAlbumPilot(state,{type:"paste",card:1});
    expect(getAlbumAchievementProgress(first,state,snapshot.cards)).toEqual({value:1,target:1});
    state=updateAlbumPilot(state,{type:"claim-achievement",id:first.id},snapshot.cards);
    expect(state.claimedAchievements).toEqual([first.id]);
    expect(updateAlbumPilot(state,{type:"claim-achievement",id:first.id},snapshot.cards)).toBe(state);
    expect(updateAlbumPilot(state,{type:"claim-achievement",id:'count-50'},snapshot.cards)).toBe(state);
  });
  it("evaluates each profile and rarity against the actual seasonal catalogue",()=>{
    const state={...createAlbumPilotState(),owned:snapshot.cards.map(c=>c.number),pasted:snapshot.cards.map(c=>c.number),acceptedTradeCount:1};
    for(const achievement of ALBUM_ACHIEVEMENTS){const progress=getAlbumAchievementProgress(achievement,state,snapshot.cards);expect(progress.value).toBeGreaterThanOrEqual(progress.target);}
    const final=updateAlbumPilot(state,{type:"claim-achievement",id:'count-50'},snapshot.cards);
    expect(final.claimedAchievements).toContain('count-50');
    expect(Object.keys(final)).not.toContain('balance');
  });
  it("retains first-trade progress after the bounded history rolls over",()=>{
    let state=updateAlbumPilot(updateAlbumPilot(createAlbumPilotState(),{type:"propose",give:8,receive:9}),{type:"accept"});
    for(let i=0;i<20;i++) state=updateAlbumPilot(updateAlbumPilot(state,{type:"propose",give:9,receive:8}),{type:"cancel"});
    expect(state.history.some(h=>h.outcome==='accepted')).toBe(false);
    expect(getAlbumAchievementProgress(ALBUM_ACHIEVEMENTS.find(a=>a.id==='trade')!,state,snapshot.cards).value).toBe(1);
  });
});
