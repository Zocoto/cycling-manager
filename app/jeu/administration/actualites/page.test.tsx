import type {ReactNode} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({client:vi.fn(),auth:vi.fn(),role:vi.fn(),header:vi.fn(),articles:vi.fn(),members:vi.fn(),editor:vi.fn(),management:vi.fn(),redirect:vi.fn((path:string)=>{throw Error(`redirect:${path}`);}),notFound:vi.fn(()=>{throw Error("not-found");})}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect,notFound:mocks.notFound}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("@/services/game-staff-access",()=>({getCurrentGameStaffRole:mocks.role}));
vi.mock("@/services/game-header-data",()=>({getGameHeaderData:mocks.header}));
vi.mock("@/services/game-product-news",()=>({getGameNewsEditorArticles:mocks.articles,getGameStaffMembers:mocks.members}));
vi.mock("@/components/game/game-header",()=>({GameHeader:()=>null}));
vi.mock("@/components/game/back-to-office-link",()=>({BackToOfficeLink:()=>null}));
vi.mock("@/components/game/game-news-editor",()=>({GameNewsEditor:(props:unknown)=>{mocks.editor(props);return <div>Éditeur de nouveauté</div>;}}));
vi.mock("@/components/game/game-staff-management",()=>({GameStaffManagement:(props:unknown)=>{mocks.management(props);return <div>Gestion des membres habilités</div>;}}));
vi.mock("@/components/ui/app-link",()=>({default:({children,...props}:{children:ReactNode})=><a {...props}>{children}</a>}));
vi.mock("./actions",()=>({saveGameNewsAction:vi.fn()}));
import Page from "./page";
const article={id:"news-id",draft:{title:"Un titre de brouillon"},published:null,publishedAt:null,updatedAt:"2026-10-22",revision:4,hasUnpublishedChanges:true};
beforeEach(()=>{
  vi.clearAllMocks();mocks.client.mockResolvedValue({});mocks.auth.mockResolvedValue({data:{user:{id:"user",email:"staff@example.invalid"}},error:null});
  mocks.role.mockResolvedValue("game_staff");mocks.header.mockResolvedValue({displayName:"Équipier",teamSponsorVisual:null});mocks.articles.mockResolvedValue([article]);mocks.members.mockResolvedValue([]);
});
const render=async(id?:string)=>renderToStaticMarkup(await Page({searchParams:Promise.resolve({id})}));

describe("protected in-game news editor page",()=>{
  it.each(["missing","invalid"])("redirects unauthenticated sessions before any role or draft lookup: %s",async state=>{
    mocks.auth.mockResolvedValue({data:{user:state==="missing"?null:{id:"user"}},error:state==="invalid"?{message:"expired"}:null});
    await expect(render()).rejects.toThrow("redirect:/connexion");
    expect(mocks.role).not.toHaveBeenCalled();expect(mocks.articles).not.toHaveBeenCalled();expect(mocks.header).not.toHaveBeenCalled();
  });
  it("refuses ordinary or revoked users before loading private data",async()=>{
    mocks.role.mockResolvedValue(null);await expect(render()).rejects.toThrow("not-found");
    expect(mocks.articles).not.toHaveBeenCalled();expect(mocks.members).not.toHaveBeenCalled();expect(mocks.header).not.toHaveBeenCalled();
  });
  it("fails closed when role verification fails",async()=>{
    mocks.role.mockRejectedValue(new Error("permission service unavailable"));
    await expect(render()).rejects.toThrow("permission service unavailable");expect(mocks.articles).not.toHaveBeenCalled();
  });
  it("allows staff to create and edit news, but never fetches owner-only role data",async()=>{
    const html=await render();
    expect(html).toContain("Gérer les actualités");expect(html).toContain("Éditeur de nouveauté");expect(html).not.toContain("Gestion des membres habilités");
    expect(mocks.articles).toHaveBeenCalledOnce();expect(mocks.members).not.toHaveBeenCalled();
    expect(mocks.editor).toHaveBeenCalledWith(expect.objectContaining({initialArticle:null}));
  });
  it("restores the selected article revision rather than starting a duplicate draft",async()=>{
    const html=await render("news-id");expect(html).toContain('aria-current="page"');
    expect(mocks.editor).toHaveBeenCalledWith(expect.objectContaining({initialArticle:article}));
  });
  it("creates a distinct new-article navigation on every render without carrying the selected id",async()=>{
    const first=await render("news-id");
    const second=await render("news-id");
    const creationHref=(html:string)=>html.match(/href="([^"]+)"[^>]*>\+ Nouvelle actualité<\/a>/u)?.[1];
    const firstHref=creationHref(first);
    const secondHref=creationHref(second);
    const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
    expect(firstHref).toBeDefined();expect(secondHref).toBeDefined();expect(firstHref).not.toBe(secondHref);
    for(const href of [firstHref,secondHref]){
      const url=new URL(href!,"https://example.invalid");
      expect(url.pathname).toBe("/jeu/administration/actualites");
      expect([...url.searchParams.keys()]).toEqual(["nouvelle"]);
      expect(url.searchParams.get("nouvelle")).toMatch(uuidV4);
      expect(url.searchParams.has("id")).toBe(false);
    }
  });
  it("uses a valid creation UUID for the empty editor and never adopts an invalid draft id",async()=>{
    const creationId="22a00000-0000-4000-8000-000000000001";
    renderToStaticMarkup(await Page({searchParams:Promise.resolve({nouvelle:creationId})}));
    expect(mocks.editor).toHaveBeenLastCalledWith(expect.objectContaining({initialArticle:null,newDraftId:creationId}));
    const invalidId="not-a-valid-hidden-draft-id";
    renderToStaticMarkup(await Page({searchParams:Promise.resolve({nouvelle:invalidId})}));
    expect(mocks.editor).toHaveBeenLastCalledWith(expect.objectContaining({
      initialArticle:null,
      newDraftId:expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu),
    }));
    expect(mocks.editor).not.toHaveBeenCalledWith(expect.objectContaining({newDraftId:invalidId}));
  });
  it("keeps the news editor free of role management even for the founder",async()=>{
    mocks.role.mockResolvedValue("owner");const html=await render();
    expect(html).toContain("Gérer les actualités");expect(html).toContain("Éditeur de nouveauté");
    expect(html).not.toContain("Gestion des membres habilités");
    expect(mocks.members).not.toHaveBeenCalled();expect(mocks.management).not.toHaveBeenCalled();
    expect(mocks.articles).toHaveBeenCalledOnce();
    expect(mocks.editor).toHaveBeenCalledWith(expect.objectContaining({initialArticle:null}));
  });
  it("does not silently create a new article for an unknown selected id",async()=>{
    await expect(render("unknown-id")).rejects.toThrow("not-found");expect(mocks.editor).not.toHaveBeenCalled();
  });
});
