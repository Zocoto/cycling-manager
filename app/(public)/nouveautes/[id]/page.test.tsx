import type {AnchorHTMLAttributes} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {gameNewsDocumentSchema} from "@/lib/game/game-product-news";
const mocks=vi.hoisted(()=>({news:vi.fn(),locale:vi.fn(),notFound:vi.fn(()=>{throw Error("not-found");})}));
vi.mock("next/navigation",()=>({notFound:mocks.notFound}));
vi.mock("@/services/game-product-news",()=>({getPublishedGameNewsById:mocks.news}));
vi.mock("@/lib/i18n/server",()=>({getRequestLocale:mocks.locale}));
vi.mock("@/components/ui/app-link",()=>({default:(props:AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}/> }));
import Page,{generateMetadata} from "./page";
const id="00000000-0000-4000-8000-000000000001";
const article={id,document:gameNewsDocumentSchema.parse({title:"Une nouveauté publique",category:"Nouveauté",summary:"Une description de cette actualité.",body:"Un texte pour présenter cette nouvelle aux visiteurs.",title_en:"A public game update",summary_en:"A description of this game update."}),publishedAt:"2026-10-22T08:00:00Z",updatedAt:"2026-10-22T08:00:00Z",revision:1};
beforeEach(()=>{vi.clearAllMocks();mocks.news.mockResolvedValue(article);mocks.locale.mockResolvedValue("fr");});
const params=(articleId=id)=>({params:Promise.resolve({id:articleId})});

describe("public game news detail",()=>{
  it("keeps the public article accessible without a gameplay session",async()=>{
    const html=renderToStaticMarkup(await Page(params()));expect(html).toContain("Une nouveauté publique");expect(html).toContain('href="/nouveautes"');expect(html).not.toContain("Interface du jeu");
    expect(mocks.news).toHaveBeenCalledExactlyOnceWith(id);
  });
  it("rejects invalid ids before the published RPC",async()=>{
    await expect(Page(params("invalid"))).rejects.toThrow("not-found");expect(mocks.news).not.toHaveBeenCalled();
    expect(await generateMetadata(params("invalid"))).toMatchObject({title:"Actualité introuvable"});expect(mocks.news).not.toHaveBeenCalled();
  });
  it("never exposes unpublished drafts through the public URL or metadata",async()=>{
    mocks.news.mockResolvedValue(null);await expect(Page(params())).rejects.toThrow("not-found");
    expect(await generateMetadata(params())).toMatchObject({title:"Actualité introuvable"});
  });
  it("uses localized published text and a canonical public URL for metadata",async()=>{
    mocks.locale.mockResolvedValue("en");expect(await generateMetadata(params())).toEqual({title:"A public game update",description:"A description of this game update.",alternates:{canonical:`/nouveautes/${id}`}});
  });
});
