import {describe,expect,it} from "vitest";
import raw from "@/data/collector-album-pilot.json";
import source from "@/data/collector-album-intro-pilot.json";
import {createCycloStickersPreview} from "./cyclo-stickers-release";
import {getAlbumIntroductionLeaves,getAlbumProfileCards,getAlbumProfileLeaves} from "./collector-album-layout";
import {getAlbumBookTurn,type AlbumBookPosition} from "./collector-album-navigation";
import {createAlbumPilotState,getAlbumPilotPacks,readAlbumPilotState,updateAlbumPilot,type CollectorAlbumSnapshot} from "./collector-album";
const snapshot=createCycloStickersPreview(raw as CollectorAlbumSnapshot,source);
function traverse(start:AlbumBookPosition,single:boolean,direction:-1|1) {
  const pages:AlbumBookPosition[]=[start];
  for(let i=0;i<30;i++){
    const next=getAlbumBookTurn(snapshot.cards,pages.at(-1)!,single,direction);
    if(!next)return pages;
    pages.push(next);
  }
  throw new Error("Unbounded book");
}
describe("one bound Cyclo-Stickers book",()=>{
  it.each([false,true])("visits every sticker once, forward and back (mobile=%s)",single=>{
    const pages=traverse({section:"introduction",leaf:0},single,1);
    expect(traverse(pages.at(-1)!,single,-1)).toEqual([...pages].reverse());
    const cards=pages.flatMap(page=>page.section==="introduction"
      ?getAlbumIntroductionLeaves(snapshot.cards).slice(page.leaf,page.leaf+(single?1:2)).flat()
      :single?getAlbumProfileLeaves(getAlbumProfileCards(snapshot.cards,page.profile))[page.leaf-1]:getAlbumProfileCards(snapshot.cards,page.profile));
    expect(cards).toHaveLength(69);
    expect(new Set(cards.map(card=>card.number)).size).toBe(69);
    expect(cards.map(card=>card.number).sort((a,b)=>a-b)).toEqual(Array.from({length:69},(_,i)=>i+1));
  });
  it("returns to the last opening page from the first riders and rejects invalid edges",()=>{
    expect(getAlbumBookTurn(snapshot.cards,{section:"riders",profile:"tours",leaf:1},true,-1)).toEqual({section:"introduction",leaf:3});
    expect(getAlbumBookTurn(snapshot.cards,{section:"introduction",leaf:3},true,1)).toEqual({section:"riders",profile:"tours",leaf:1});
    expect(getAlbumBookTurn(snapshot.cards,{section:"introduction",leaf:0},false,-1)).toBeNull();
    for(const leaf of [-1,4,1.5,NaN]) expect(getAlbumBookTurn(snapshot.cards,{section:"introduction",leaf},true,1)).toBeNull();
  });
  it("adds the new private souvenir without losing an existing collage, trade or opened pack",()=>{
    const oldCards=snapshot.cards.filter(card=>card.kind!=="legend");
    let previous=createAlbumPilotState(4,oldCards);
    previous=updateAlbumPilot(previous,{type:"paste",card:51},oldCards);
    previous=updateAlbumPilot(previous,{type:"open-pack",id:getAlbumPilotPacks()[0].id,season:4,cards:[1,8]},oldCards);
    previous=updateAlbumPilot(previous,{type:"propose",give:[1],receive:9},oldCards);
    const migrated=readAlbumPilotState(JSON.stringify(previous),4,snapshot.cards);
    expect(migrated).toEqual({...previous,owned:[...previous.owned,69]});
    expect(readAlbumPilotState(JSON.stringify(migrated),4,snapshot.cards)).toEqual(migrated);
    expect(readAlbumPilotState(JSON.stringify({...previous,owned:[...previous.owned,51]}),4,snapshot.cards)).toEqual(createAlbumPilotState(4,snapshot.cards));
  });
});
