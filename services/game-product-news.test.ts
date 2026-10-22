import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({admin:vi.fn(),rpc:vi.fn(),abort:vi.fn(),cache:vi.fn((fn:unknown)=>fn)}));
vi.mock("next/cache",()=>({unstable_cache:mocks.cache}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:mocks.admin}));
import {getPublishedGameNews,getPublishedGameNewsById,getGameNewsEditorArticles,getGameStaffMembers,toGameNewsEditorArticle} from "./game-product-news";

const document={title:"Une nouvelle actualité",category:"Nouveauté",summary:"Une description de la nouveauté.",body:"Un texte suffisamment long pour la publication."};
const timestamp="2026-10-22T08:00:00.000Z";
const publicRow={id:"news",document,published_at:timestamp,updated_at:timestamp,revision:3};
const editorRow={id:"news",draft:{...document,title:"Brouillon privé"},published:document,published_at:timestamp,updated_at:timestamp,revision:4,has_unpublished_changes:true};
beforeEach(()=>{vi.clearAllMocks();mocks.rpc.mockReturnValue({abortSignal:mocks.abort});mocks.abort.mockResolvedValue({data:[],error:null});mocks.admin.mockReturnValue({rpc:mocks.rpc});});

describe("public game news snapshots",()=>{
  it("uses only the dedicated read RPC, a bounded public limit and published fields",async()=>{
    mocks.abort.mockResolvedValue({data:[publicRow],error:null});
    const [news]=await getPublishedGameNews();
    expect(news).toMatchObject({id:"news",document,publishedAt:timestamp,updatedAt:timestamp,revision:3});
    expect(news).not.toHaveProperty("draft");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_published_game_news",{p_limit:50,p_id:null});
    expect(mocks.abort).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it("retrieves a single published article without loading all drafts",async()=>{
    mocks.abort.mockResolvedValue({data:[publicRow],error:null});
    expect(await getPublishedGameNewsById("news")).toMatchObject({id:"news",revision:3});
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_published_game_news",{p_limit:1,p_id:"news"});
  });
  it("returns null for an unknown or unpublished article",async()=>{
    expect(await getPublishedGameNewsById("private-draft")).toBeNull();
    mocks.abort.mockResolvedValue({data:null,error:null});
    expect(await getPublishedGameNews()).toEqual([]);
  });
  it.each([getPublishedGameNews,()=>getPublishedGameNewsById("news")])("never disguises a database failure as a valid publication",async load=>{
    mocks.abort.mockResolvedValue({data:[publicRow],error:{message:"permission denied"}});
    await expect(load()).rejects.toThrow("charg");
  });
  it("rejects malformed public documents rather than rendering unvalidated data",async()=>{
    mocks.abort.mockResolvedValue({data:[{...publicRow,document:{...document,link_url:"javascript:alert(1)"}}],error:null});
    await expect(getPublishedGameNews()).rejects.toThrow();
  });
});

describe("private editorial service",()=>{
  it("uses the authenticated caller, preserves publication separately and accepts incomplete drafts",async()=>{
    // SQL canonicalizes absent required strings. An empty complete draft is valid.
    mocks.abort.mockResolvedValue({data:[{...editorRow,draft:{title:"",category:"",summary:"",body:""}}],error:null});
    const [article]=await getGameNewsEditorArticles({rpc:mocks.rpc} as never);
    expect(article.draft.title).toBe("");expect(article.published?.title).toBe(document.title);
    expect(article.revision).toBe(4);expect(article.hasUnpublishedChanges).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_game_news_editor",{p_id:null});
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("maps a new draft without inventing a published snapshot",()=>{
    expect(toGameNewsEditorArticle({...editorRow,published:null,published_at:null})).toMatchObject({published:null,publishedAt:null,hasUnpublishedChanges:true});
  });
  it("does not expose drafts when the database rejects authorisation",async()=>{
    mocks.abort.mockResolvedValue({data:[editorRow],error:{code:"42501"}});
    await expect(getGameNewsEditorArticles({rpc:mocks.rpc} as never)).rejects.toThrow("brouillons");
  });
  it("returns only the owner-authorized member list using the authenticated client",async()=>{
    mocks.abort.mockResolvedValue({data:[{user_id:"user",sporting_director_id:"director",display_name:"Équipier",role:"game_staff"}],error:null});
    expect(await getGameStaffMembers({rpc:mocks.rpc} as never)).toEqual([{userId:"user",directorId:"director",displayName:"Équipier",role:"game_staff"}]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_game_staff_members");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("fails closed when the owner member list is denied",async()=>{
    mocks.abort.mockResolvedValue({data:[],error:{code:"42501"}});
    await expect(getGameStaffMembers({rpc:mocks.rpc} as never)).rejects.toThrow("membres");
  });
});
