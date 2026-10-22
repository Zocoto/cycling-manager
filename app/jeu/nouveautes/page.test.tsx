import type {AnchorHTMLAttributes} from "react";
import {readFileSync} from "node:fs";
import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {gameNewsDocumentSchema} from "@/lib/game/game-product-news";

const mocks=vi.hoisted(()=>({client:vi.fn(),auth:vi.fn(),header:vi.fn(),news:vi.fn(),locale:vi.fn(),signOut:vi.fn(),gameHeader:vi.fn(),redirect:vi.fn((path:string)=>{throw Error(`redirect:${path}`);})}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("@/services/game-header-data",()=>({getGameHeaderData:mocks.header}));
vi.mock("@/services/game-product-news",()=>({getPublishedGameNews:mocks.news}));
vi.mock("@/lib/i18n/server",()=>({getRequestLocale:mocks.locale}));
vi.mock("@/components/game/game-header",()=>({GameHeader:(props:unknown)=>{mocks.gameHeader(props);return <header data-game-header="true">Interface du jeu</header>;}}));
vi.mock("@/components/game/game-release-history",()=>({GameReleaseHistory:()=> <section>Historique des versions</section>}));
vi.mock("@/components/ui/app-link",()=>({default:(props:AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}/> }));
import Page from "./page";

const id="00000000-0000-4000-8000-000000000001";
const article={id,document:gameNewsDocumentSchema.parse({title:"Une nouveauté pour les DS",category:"Nouveauté",summary:"Lisez cette nouvelle depuis votre partie.",body:"Un texte suffisamment détaillé pour cette annonce."}),publishedAt:"2026-10-22T08:00:00Z",updatedAt:"2026-10-22T08:00:00Z",revision:1};
beforeEach(()=>{
  vi.clearAllMocks();mocks.client.mockResolvedValue({auth:{signOut:mocks.signOut}});mocks.auth.mockResolvedValue({data:{user:{id:"player",email:"player@example.invalid"}},error:null});
  mocks.header.mockResolvedValue({displayName:"Mon DS",teamSponsorVisual:null});mocks.news.mockResolvedValue([article]);mocks.locale.mockResolvedValue("fr");
});
const render=async()=>renderToStaticMarkup(await Page());

describe("connected game news index",()=>{
  it.each(["anonymous","expired"])("checks authentication before loading any news or header: %s",async state=>{
    mocks.auth.mockResolvedValue({data:{user:state==="anonymous"?null:{id:"player"}},error:state==="expired"?{message:"expired"}:null});
    await expect(render()).rejects.toThrow("redirect:/connexion");
    expect(mocks.news).not.toHaveBeenCalled();expect(mocks.header).not.toHaveBeenCalled();expect(mocks.locale).not.toHaveBeenCalled();expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("keeps the game header, office return and all article/guide links inside the game",async()=>{
    const html=await render();
    expect(html).toContain('data-game-header="true"');expect(html).toContain("Retour au bureau du DS");expect(html).toContain('href="/jeu"');
    expect(html).toContain(`href="/jeu/nouveautes/${id}"`);expect(html).toContain('href="/jeu/guide"');
    expect(html).not.toContain(`href="/nouveautes/${id}"`);expect(html).not.toContain('href="/guide"');expect(html).not.toContain('href="/connexion"');
    expect(mocks.gameHeader).toHaveBeenCalledWith(expect.objectContaining({displayName:"Mon DS",simulatorEmail:"player@example.invalid"}));
    expect(mocks.news).toHaveBeenCalledOnce();expect(mocks.header).toHaveBeenCalledOnce();expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("keeps the connected shell and guide available when no news are published",async()=>{
    mocks.news.mockResolvedValue([]);const html=await render();expect(html).toContain("Aucune actualité publiée");
    expect(html).toContain('data-game-header="true"');expect(html).toContain('href="/jeu/guide"');expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("does not connect these game routes to the public layout or logout",()=>{
    for(const path of ["app/jeu/nouveautes/page.tsx","app/jeu/nouveautes/[id]/page.tsx","app/jeu/guide/page.tsx"]){
      const source=readFileSync(path,"utf8");
      expect(source).not.toMatch(/from\s+["'][^"']*\(public\)\/layout/u);
      expect(source).not.toMatch(/auth\.signOut|\bsignOut\s*\(/u);
      expect(source.indexOf("getAuthenticatedUser(supabase)")).toBeLessThan(source.indexOf("getGameHeaderData(supabase,"));
    }
  });
});
