import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),header:vi.fn(),client:vi.fn(),redirect:vi.fn((url:string)=>{throw new Error(`redirect:${url}`);}),notFound:vi.fn(()=>{throw new Error("not-found");})}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect,notFound:mocks.notFound}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/services/game-header-data",()=>({getGameHeaderData:mocks.header}));
vi.mock("@/components/game/game-header",()=>({GameHeader:()=>null}));
vi.mock("@/components/game/collector-album",()=>({CollectorAlbum:()=>null}));
import Page from "./page";
describe("collector album server-side authorization",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.client.mockResolvedValue({});mocks.header.mockResolvedValue({displayName:"owner",teamSponsorVisual:null});});
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
  it("serves the S4 cover with the S3 test catalogue and never enables another account",async()=>{
    mocks.auth.mockResolvedValue({data:{user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}},error:null});
    const page=await Page({searchParams:Promise.resolve({saison:"4",onglet:"introduction"})});
    const children=page.props.children;
    expect(children[0].props.collectorAlbumAvailable).toBe(true);
    expect(children[1].props.initialTab).toBe("introduction");
    expect(children[1].props.snapshot).toMatchObject({sourceSeason:3,presentationSeason:4,launchSeason:5});
    expect(children[1].props.snapshot.cards).toHaveLength(68);
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
});
