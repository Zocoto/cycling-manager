import {describe,expect,it} from "vitest";
import {createHash} from "node:crypto";
import raw from "@/data/collector-album-pilot.json";
import {ALBUM_DEMO_COLLECTORS,canOfferAlbumCards,createAlbumPilotState,getAlbumPilotPacks,getLooseAlbumCardCount,readAlbumPilotState,updateAlbumPilot,type AlbumPilotState} from "./collector-album";
const pack=getAlbumPilotPacks()[0];
const open=()=>updateAlbumPilot(createAlbumPilotState(),{type:"open-pack",id:pack.id,season:4,cards:[21,8]});
const supply=(s:AlbumPilotState)=>[...s.owned,...Object.values(s.partners).flat()].sort((a,b)=>a-b);

describe("private multi-card exchange",()=>{
  it.each([[8],[8,21],[8,21,8]].map(give=>({give})))("reserves and transfers $give atomically for one card",({give})=>{
    const initial=open();
    const pending=updateAlbumPilot(initial,{type:"propose",give,receive:9,partnerId:"collector-demo"});
    expect(pending.pending).toEqual({give,receive:9,partnerId:"collector-demo"});
    expect(pending.owned).toEqual(initial.owned);
    for(const id of give)expect(getLooseAlbumCardCount(pending,id)).toBe(initial.owned.filter(n=>n===id).length-give.filter(n=>n===id).length);
    const accepted=updateAlbumPilot(pending,{type:"accept"});
    expect(supply(accepted)).toEqual(supply(initial));
    expect(accepted.owned).toHaveLength(initial.owned.length-give.length+1);
    expect(accepted.partners["collector-demo"]).toEqual(give);
    expect(accepted.partners["collector-sprints"]).toEqual(initial.partners["collector-sprints"]);
    expect(updateAlbumPilot(accepted,{type:"accept"})).toBe(accepted);
    expect(readAlbumPilotState(JSON.stringify(accepted))).toEqual(accepted);
  });
  it("protects the pasted copy while allowing up to three loose duplicates",()=>{
    let state=open();state=updateAlbumPilot(state,{type:"paste",card:8});
    expect(canOfferAlbumCards(state,{give:[8,8],receive:9,partnerId:"collector-demo"})).toBe(false);
    state=updateAlbumPilot(state,{type:"propose",give:[8,21],receive:9});
    expect(updateAlbumPilot(state,{type:"paste",card:21})).toBe(state);
    const accepted=updateAlbumPilot(state,{type:"accept"});
    expect(accepted.pasted).toEqual([8]);expect(accepted.owned.filter(n=>n===8)).toHaveLength(1);
  });
  it.each([[],[8,8,8],[1,8,21,8],[0],[51],[9],[9,8]].map(give=>({give})))("rejects invalid or unavailable offer $give",({give})=>{
    const state=open();expect(updateAlbumPilot(state,{type:"propose",give,receive:9})).toBe(state);
  });
  it("checks recipient ownership and never reserves a second pending offer",()=>{
    const state=open();
    expect(updateAlbumPilot(state,{type:"propose",give:[8],receive:12,partnerId:"collector-demo"})).toBe(state);
    expect(updateAlbumPilot(state,{type:"propose",give:[8],receive:9,partnerId:"__proto__"})).toBe(state);
    const pending=updateAlbumPilot(state,{type:"propose",give:[8,21],receive:12,partnerId:"collector-cols"});
    expect(updateAlbumPilot(pending,{type:"propose",give:[1],receive:9})).toBe(pending);
    expect(readAlbumPilotState(JSON.stringify(pending))).toEqual(pending);
  });
  it.each(["decline","cancel"] as const)("%s releases all reservations without transfers",type=>{
    const state=open(),pending=updateAlbumPilot(state,{type:"propose",give:[1,8,21],receive:9});
    const result=updateAlbumPilot(pending,{type});
    expect(result.owned).toEqual(state.owned);expect(result.partners).toEqual(state.partners);
    for(const id of [1,8,21])expect(getLooseAlbumCardCount(result,id)).toBe(getLooseAlbumCardCount(state,id));
  });
  it("migrates deployed v2 pending offers, pack receipts, claims and pasted cards",()=>{
    const legacy={version:2,season:4,owned:[1,8,21,8],partner:[9],pasted:[1],pending:{give:8,receive:9},history:[],openedPacks:[{id:pack.id,cards:[21,8]}],claimedAchievements:["count-1"],acceptedTradeCount:0};
    const result=readAlbumPilotState(JSON.stringify(legacy));
    expect(result.version).toBe(3);expect(result.owned).toEqual(legacy.owned);expect(result.pasted).toEqual([1]);expect(result.claimedAchievements).toEqual(["count-1"]);
    expect(result.pending).toEqual({give:[8],receive:9,partnerId:"collector-demo"});
    expect(ALBUM_DEMO_COLLECTORS.every(p=>Array.isArray(result.partners[p.id]))).toBe(true);
  });
  it("rejects forged stocks and malformed histories on reload",()=>{
    const initial=createAlbumPilotState();
    for(const corrupt of [{...initial,partners:{...initial.partners,"collector-cols":[12,27,50]}},{...initial,pending:{give:[8,8],receive:9,partnerId:"collector-demo"}},{...initial,history:[{give:[8,9,12,27],receive:42,partnerId:"collector-cols",outcome:"accepted"}]}])expect(readAlbumPilotState(JSON.stringify(corrupt))).toEqual(initial);
  });
  it("freezes source-season stats and includes genuine honours, not provisional jerseys",()=>{
    expect(raw.sourceSeason).toBe(3);expect(raw.ratingsFrozenFromSeason).toBe(3);expect(raw.sourceSeasonId).toMatch(/^[a-f0-9-]{36}$/);
    expect(createHash("sha256").update(JSON.stringify(raw.cards.map(c=>({id:c.id,ratings:c.ratings})))).digest("hex")).toBe("bd43335b64b69d5b7169df1a90280a3924f5fa04232a5cceb58a308db9051765");
    for(const card of raw.cards){for(const h of card.honours){expect(h.count).toBeGreaterThan(0);expect(h.raceEditionId).toMatch(/^[a-f0-9-]{36}$/);if(h.kind==="race")expect(h.rank).toBeGreaterThan(0);}expect(new Set(card.honours.map(h=>`${h.raceEditionId}:${h.kind}:${h.rank??0}`)).size).toBe(card.honours.length);}
    expect(raw.cards.filter(c=>c.worldTitles.length).map(c=>c.name)).toEqual(["Mathieu Laurent"]);
  });
});
