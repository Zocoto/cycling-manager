import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),header:vi.fn(),client:vi.fn(),publicReady:false,publicAlbum:vi.fn(),redirect:vi.fn((url:string)=>{throw new Error(`redirect:${url}`);}),notFound:vi.fn(()=>{throw new Error("not-found");})}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect,notFound:mocks.notFound}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/services/game-header-data",()=>({getGameHeaderData:mocks.header}));
vi.mock("@/components/game/game-header",()=>({GameHeader:()=>null}));
vi.mock("@/components/game/collector-album",()=>({CollectorAlbum:()=>null}));
vi.mock("@/components/game/cyclo-stickers-persistent-album",()=>({CycloStickersPersistentAlbum:()=>null}));
vi.mock("@/services/cyclo-stickers-album",()=>({getPublicCycloStickersAlbum:mocks.publicAlbum}));
vi.mock("@/lib/game/cyclo-stickers-leaderboard",()=>({getCycloStickersLeaderboard:vi.fn().mockResolvedValue(null)}));
vi.mock("@/lib/game/cyclo-stickers-release",async importOriginal=>{
  const original=await importOriginal<typeof import("@/lib/game/cyclo-stickers-release")>();
  return {...original,CYCLO_STICKERS_RELEASE:{...original.CYCLO_STICKERS_RELEASE,get publicReady(){return mocks.publicReady;}}};
});
import Page from "./page";
describe("collector album server-side authorization",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.publicReady=false;mocks.publicAlbum.mockReset().mockResolvedValue(null);mocks.client.mockResolvedValue({});mocks.header.mockResolvedValue({displayName:"owner",teamSponsorVisual:null});});
  it("redirects unauthenticated users before loading the album",async()=>{
    mocks.auth.mockResolvedValue({data:{user:null},error:null});
    await expect(Page({})).rejects.toThrow("redirect:/connexion");
    expect(mocks.header).not.toHaveBeenCalled();
  });
  it("is unavailable to every other player, even with the direct URL",async()=>{
    mocks.auth.mockResolvedValue({data:{user:{id:"another-player",email:"paul.leblanc22@gmail.com"}},error:null});
    await expect(Page({})).rejects.toThrow("not-found");
    expect(mocks.header).not.toHaveBeenCalled();
  });
  it("loads the private snapshot for the authenticated owner without a new DB service",async()=>{
    mocks.auth.mockResolvedValue({data:{user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}},error:null});
    expect(await Page({})).toBeTruthy();
    expect(mocks.header).toHaveBeenCalledTimes(1);
  });
  it("serves all 72 genuine provisional S4 cards without falling back to the S3 catalogue",async()=>{
    mocks.auth.mockResolvedValue({data:{user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}},error:null});
    const page=await Page({searchParams:Promise.resolve({saison:"4",onglet:"introduction"})});
    const children=page.props.children;
    expect(children[0].props.collectorAlbumAvailable).toBe(true);
    expect(children[1].props.initialTab).toBe("album");
    expect(children[1].props.initialIntroduction).toBe(true);
    expect(children[1].props.snapshot).toMatchObject({sourceSeason:4,ratingsFrozenFromSeason:4,presentationSeason:4,collectionSeason:5,launchSeason:5,sourceSeasonStatus:"active"});
    expect(children[1].props.snapshot.cards).toHaveLength(72);
    expect(children[1].props.snapshot.cards.slice(69).every((card:{kind?:string;profileKey:string;rank:number})=>!card.kind&&card.profileKey==="breakaway"&&card.rank>50)).toBe(true);
    expect(children[1].props.snapshot.cards.some((card:{specimen?:boolean})=>card.specimen)).toBe(false);
  });
  it("accepts source-season edition S3 and the legacy S4 URL without mixing another catalogue",async()=>{
    mocks.auth.mockResolvedValue({data:{user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}},error:null});
    await expect(Page({searchParams:Promise.resolve({saison:"5"})})).rejects.toThrow("not-found");
    expect(mocks.header).not.toHaveBeenCalled();
    expect(await Page({searchParams:Promise.resolve({saison:"3",onglet:"boosters"})})).toBeTruthy();
    expect(await Page({searchParams:Promise.resolve({saison:"4",onglet:"boosters"})})).toBeTruthy();
    expect(mocks.header).toHaveBeenCalledTimes(2);
  });
  it.each(["3", "4"])("keeps the private owner guard for edition URL %s",async(saison)=>{
    mocks.auth.mockResolvedValue({data:{user:{id:"another-player"}},error:null});
    await expect(Page({searchParams:Promise.resolve({saison})})).rejects.toThrow("not-found");
    expect(mocks.header).not.toHaveBeenCalled();
  });
  it("routes the owner's S4 incoming trade mail to the persistent collection only after public approval",async()=>{
    mocks.auth.mockResolvedValue({data:{user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}},error:null});
    const searchParams=Promise.resolve({saison:"4",onglet:"echanges"});
    const preview=await Page({searchParams});
    expect(preview.props.children[1].props.snapshot.sourceSeason).toBe(4);
    expect(mocks.publicAlbum).not.toHaveBeenCalled();
    mocks.publicReady=true;
    const album={snapshot:{edition:"final-s4",sourceSeason:4,collectionSeason:5},state:{directorId:"real-owner"}};
    mocks.publicAlbum.mockResolvedValue(album);
    const page=await Page({searchParams});
    expect(mocks.publicAlbum).toHaveBeenCalledTimes(1);
    expect(page.props.children[1].props.initialState).toBe(album.state);
    expect(page.props.children[1].props.snapshot).toBe(album.snapshot);
    expect(page.props.children[1].props.initialTab).toBe("trades");
  });
  it("loads S3 only from its explicit owner URL and uses genuine S4 while publication is pending",async()=>{
    mocks.publicReady=true;
    mocks.auth.mockResolvedValue({data:{user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}},error:null});
    const legacy=await Page({searchParams:Promise.resolve({saison:"3",onglet:"echanges"})});
    expect(legacy.props.children[1].props.snapshot.sourceSeason).toBe(3);
    const preview=await Page({searchParams:Promise.resolve({saison:"4"})});
    expect(preview.props.children[1].props.snapshot.sourceSeason).toBe(4);
    expect(mocks.publicAlbum).toHaveBeenCalledTimes(1);
  });
  it.each(["58140add-54c6-40af-9528-f823d0051d0f","another-player"])("uses the real collection by default for every player after DB publication: %s",async userId=>{
    mocks.publicReady=true;
    mocks.auth.mockResolvedValue({data:{user:{id:userId}},error:null});
    const album={snapshot:{edition:"final-s4",sourceSeason:4,collectionSeason:5},state:{directorId:"real-owner"}};
    mocks.publicAlbum.mockResolvedValue(album);
    const page=await Page({});
    expect(mocks.publicAlbum).toHaveBeenCalledTimes(1);
    expect(page.props.children[1].props.initialState).toBe(album.state);
    expect(page.props.children[1].props.snapshot).toBe(album.snapshot);
  });
  it("keeps the explicit S3 owner archive out of the public collection even after publication",async()=>{
    mocks.publicReady=true;
    mocks.auth.mockResolvedValue({data:{user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}},error:null});
    mocks.publicAlbum.mockResolvedValue({snapshot:{edition:"final-s4",sourceSeason:4},state:{directorId:"real-owner"}});
    const page=await Page({searchParams:Promise.resolve({saison:"3"})});
    expect(page.props.children[1].props.snapshot.sourceSeason).toBe(3);
    expect(page.props.children[1].props.snapshot.cards).toHaveLength(50);
    expect(mocks.publicAlbum).not.toHaveBeenCalled();
  });
  it("refuses incoming mail if the public catalogue is unavailable instead of falling back to the demo",async()=>{
    mocks.publicReady=true;
    mocks.auth.mockResolvedValue({data:{user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}},error:null});
    mocks.publicAlbum.mockResolvedValue(null);
    await expect(Page({searchParams:Promise.resolve({saison:"4",onglet:"echanges"})})).rejects.toThrow("not-found");
    expect(mocks.header).not.toHaveBeenCalled();
  });
});
