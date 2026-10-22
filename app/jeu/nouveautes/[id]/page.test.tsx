import type {AnchorHTMLAttributes} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {gameNewsDocumentSchema} from "@/lib/game/game-product-news";
const mocks=vi.hoisted(()=>({client:vi.fn(),auth:vi.fn(),header:vi.fn(),news:vi.fn(),locale:vi.fn(),signOut:vi.fn(),gameHeader:vi.fn(),redirect:vi.fn((path:string)=>{throw Error(`redirect:${path}`);}),notFound:vi.fn(()=>{throw Error("not-found");})}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect,notFound:mocks.notFound}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("@/services/game-header-data",()=>({getGameHeaderData:mocks.header}));
vi.mock("@/services/game-product-news",()=>({getPublishedGameNewsById:mocks.news}));
vi.mock("@/lib/i18n/server",()=>({getRequestLocale:mocks.locale}));
vi.mock("@/components/game/game-header",()=>({GameHeader:(props:unknown)=>{mocks.gameHeader(props);return <header data-game-header="true">Interface du jeu</header>;}}));
vi.mock("@/components/ui/app-link",()=>({default:(props:AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}/> }));
import Page from "./page";

const id="00000000-0000-4000-8000-000000000001";
const article={id,document:gameNewsDocumentSchema.parse({title:"Une nouveauté pour les DS",category:"Nouveauté",summary:"Lisez cette nouvelle depuis votre partie.",body:"Un texte détaillé avec [le guide](/guide) et [les nouveautés](/nouveautes).",link_url:"/guide",link_label:"Consulter le guide"}),publishedAt:"2026-10-22T08:00:00Z",updatedAt:"2026-10-22T08:00:00Z",revision:3};
beforeEach(()=>{
  vi.clearAllMocks();mocks.client.mockResolvedValue({auth:{signOut:mocks.signOut}});mocks.auth.mockResolvedValue({data:{user:{id:"player",email:"player@example.invalid"}},error:null});
  mocks.header.mockResolvedValue({displayName:"Mon DS",teamSponsorVisual:null});mocks.news.mockResolvedValue(article);mocks.locale.mockResolvedValue("fr");
});
const render=async(articleId=id)=>renderToStaticMarkup(await Page({params:Promise.resolve({id:articleId})}));

describe("connected game news detail",()=>{
  it.each(["anonymous","expired"])("requires authentication before fetching the news or header: %s",async state=>{
    mocks.auth.mockResolvedValue({data:{user:state==="anonymous"?null:{id:"player"}},error:state==="expired"?{message:"expired"}:null});
    await expect(render()).rejects.toThrow("redirect:/connexion");
    expect(mocks.news).not.toHaveBeenCalled();expect(mocks.header).not.toHaveBeenCalled();expect(mocks.locale).not.toHaveBeenCalled();expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it.each(["bad-id","../admin","00000000-0000-0000-0000-not-a-uuid"])("rejects invalid ids before any news RPC: %s",async invalid=>{
    await expect(render(invalid)).rejects.toThrow("not-found");expect(mocks.news).not.toHaveBeenCalled();expect(mocks.header).not.toHaveBeenCalled();
  });
  it("returns 404 for drafts or missing published snapshots without rendering the private text",async()=>{
    mocks.news.mockResolvedValue(null);await expect(render()).rejects.toThrow("not-found");
    expect(mocks.news).toHaveBeenCalledExactlyOnceWith(id);expect(mocks.gameHeader).not.toHaveBeenCalled();expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("keeps the game header, office and protected news/guide destinations, including body links",async()=>{
    const html=await render();expect(html).toContain('data-game-header="true"');expect(html).toContain("Une nouveauté pour les DS");
    expect(html).toContain('href="/jeu"');expect(html).toContain('href="/jeu/nouveautes"');expect(html).toContain('href="/jeu/guide"');
    expect(html).not.toContain('href="/guide"');expect(html).not.toContain('href="/nouveautes"');expect(html).not.toContain('href="/connexion"');
    expect(mocks.news).toHaveBeenCalledExactlyOnceWith(id);expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("does not fall back to private editor data when published news loading fails",async()=>{
    mocks.news.mockRejectedValue(new Error("published service unavailable"));await expect(render()).rejects.toThrow("published service unavailable");
    expect(mocks.gameHeader).not.toHaveBeenCalled();expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
