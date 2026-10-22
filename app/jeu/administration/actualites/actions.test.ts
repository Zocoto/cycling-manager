import {beforeEach,describe,expect,it,vi} from "vitest";
import type {GameNewsEditorState} from "@/lib/game/game-product-news";
const mocks=vi.hoisted(()=>({client:vi.fn(),auth:vi.fn(),role:vi.fn(),rpc:vi.fn(),tag:vi.fn(),path:vi.fn()}));
vi.mock("next/cache",()=>({updateTag:mocks.tag,revalidatePath:mocks.path}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("@/services/game-staff-access",()=>({getCurrentGameStaffRole:mocks.role}));
vi.mock("@/services/game-product-news",()=>({toGameNewsEditorArticle:(row:Record<string,unknown>)=>({id:row.id,draft:row.draft,published:row.published,publishedAt:row.published_at,updatedAt:row.updated_at,revision:row.revision,hasUnpublishedChanges:row.has_unpublished_changes})}));
import {saveGameNewsAction} from "./actions";

const id="00000000-0000-4000-8000-000000000100";
const userId="00000000-0000-4000-8000-000000000200";
const document={title:"Une nouveauté du jeu",category:"Nouveauté",summary:"Un résumé suffisamment détaillé.",body:"Un texte complet pour annoncer la nouveauté."};
const row={id,draft:document,published:null,published_at:null,updated_at:"2026-10-22T10:00:00Z",revision:1,has_unpublished_changes:true};
const initial:GameNewsEditorState={status:"idle",message:null};
function form(overrides:Partial<Record<string,string>>={}){const data=new FormData();for(const [key,value] of Object.entries({...document,id:"",revision:"0",intent:"save_draft",...overrides}))if(typeof value==="string")data.set(key,value);return data;}
beforeEach(()=>{
  vi.clearAllMocks();mocks.client.mockResolvedValue({rpc:mocks.rpc});
  mocks.auth.mockResolvedValue({data:{user:{id:userId,email:"member@example.invalid"}},error:null});
  mocks.role.mockResolvedValue("game_staff");mocks.rpc.mockResolvedValue({data:[row],error:null});
});

describe("news mutation authorisation",()=>{
  it.each(["anonymous","auth-error","ordinary","revoked","role-error"])("does not write for %s",async scenario=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    if(scenario==="anonymous")mocks.auth.mockResolvedValue({data:{user:null},error:null});
    if(scenario==="auth-error")mocks.auth.mockResolvedValue({data:{user:{id:userId}},error:{message:"invalid session"}});
    if(scenario==="ordinary"||scenario==="revoked")mocks.role.mockResolvedValue(null);
    if(scenario==="role-error")mocks.role.mockRejectedValue(new Error("RPC unavailable"));
    expect((await saveGameNewsAction(initial,form())).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.tag).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it.each(["owner","game_staff"])("accepts a fresh %s database role",async role=>{
    mocks.role.mockResolvedValue(role);
    expect((await saveGameNewsAction(initial,form())).status).toBe("success");
    expect(mocks.role).toHaveBeenCalledOnce();
  });
});

describe("draft and publication workflow",()=>{
  it("saves incomplete drafts without changing any public cache",async()=>{
    const result=await saveGameNewsAction(initial,form({title:"",category:"",summary:"",body:""}));
    expect(result.status).toBe("success");expect(result.article?.revision).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_game_news_draft",{p_id:null,p_expected_revision:0,p_document:expect.objectContaining({title:"",category:"",summary:"",body:""})});
    expect(mocks.tag).not.toHaveBeenCalled();
    expect(mocks.path).toHaveBeenCalledExactlyOnceWith("/jeu/administration/actualites");
  });
  it("carries the current article id and expected revision to SQL",async()=>{
    await saveGameNewsAction(initial,form({id,revision:"7"}));
    expect(mocks.rpc).toHaveBeenCalledWith("save_game_news_draft",expect.objectContaining({p_id:id,p_expected_revision:7}));
  });
  it("uses the same client-generated id on a lost-response creation retry",async()=>{
    await saveGameNewsAction(initial,form({id,revision:"0"}));
    await saveGameNewsAction(initial,form({id,revision:"0"}));
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
    expect(mocks.rpc).toHaveBeenCalledWith("save_game_news_draft",expect.objectContaining({p_id:id,p_expected_revision:0}));
  });
  it("saves partial English drafts but requires valid translations before publication",async()=>{
    expect((await saveGameNewsAction(initial,form({title_en:"A",body_en:"Draft"}))).status).toBe("success");
    mocks.rpc.mockClear();
    expect((await saveGameNewsAction(initial,form({intent:"publish",title_en:"A"}))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{id:"bad-id"},{revision:"1.5"},{revision:"-1"},{revision:"NaN"},{intent:"delete"}])("refuses forged references and intents: %j",async invalid=>{
    expect((await saveGameNewsAction(initial,form(invalid))).status).toBe("error");expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires complete publication text before making any SQL write",async()=>{
    expect((await saveGameNewsAction(initial,form({intent:"publish",title:""}))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.tag).not.toHaveBeenCalled();
  });
  it.each(["javascript:alert(1)","//foreign.invalid","https://foreign.invalid/\npath"])("refuses unsafe link %s before SQL",async link=>{
    expect((await saveGameNewsAction(initial,form({link_url:link}))).status).toBe("error");expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("converts Discord-style communication shortcodes without altering unknown codes",async()=>{
    await saveGameNewsAction(initial,form({title:":tada: La nouveauté",body:":warning: Vérifiez vos inscriptions :unknown: :white_check_mark:"}));
    expect(mocks.rpc).toHaveBeenCalledWith("save_game_news_draft",expect.objectContaining({p_document:expect.objectContaining({title:"🎉 La nouveauté",body:"⚠️ Vérifiez vos inscriptions :unknown: ✅"})}));
  });
  it("publishes the just-saved revision and refreshes public/game lists and detail caches",async()=>{
    const published={...row,published:document,published_at:"2026-10-22T10:01:00Z",revision:2,has_unpublished_changes:false};
    mocks.rpc.mockResolvedValueOnce({data:[row],error:null}).mockResolvedValueOnce({data:[published],error:null});
    const result=await saveGameNewsAction(initial,form({intent:"publish"}));
    expect(result.status).toBe("success");expect(result.article).toMatchObject({id,revision:2,hasUnpublishedChanges:false});
    expect(mocks.rpc.mock.calls.map(call=>call[0])).toEqual(["save_game_news_draft","publish_game_news"]);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2,"publish_game_news",{p_id:id,p_expected_revision:1});
    expect(mocks.tag).toHaveBeenCalledExactlyOnceWith("game-product-news");
    expect(mocks.path.mock.calls.map(call=>call[0])).toEqual(["/","/nouveautes","/jeu","/jeu/nouveautes",`/nouveautes/${id}`,`/jeu/nouveautes/${id}`,"/jeu/administration/actualites"]);
  });
  it("returns a conflict without overwriting another editor or invalidating publication caches",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"40001",message:"stale revision"}});
    const result=await saveGameNewsAction(initial,form());
    expect(result.status).toBe("conflict");expect(result.message).toContain("conservé");expect(mocks.tag).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it("keeps the saved article and revision when publication encounters a concurrent change",async()=>{
    mocks.rpc.mockResolvedValueOnce({data:[row],error:null}).mockResolvedValueOnce({data:null,error:{code:"40001"}});
    const result=await saveGameNewsAction(initial,form({intent:"publish"}));
    expect(result.status).toBe("conflict");expect(result.article).toMatchObject({id,revision:1});expect(mocks.tag).not.toHaveBeenCalled();
  });
  it.each(["denied","network","missing-row"])("keeps a saved draft when publication is not confirmed: %s",async scenario=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    mocks.rpc.mockResolvedValueOnce({data:[row],error:null});
    if(scenario==="denied")mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"42501"}});
    if(scenario==="network")mocks.rpc.mockRejectedValueOnce(new Error("network"));
    if(scenario==="missing-row")mocks.rpc.mockResolvedValueOnce({data:[],error:null});
    const result=await saveGameNewsAction(initial,form({intent:"publish"}));
    expect(result.status).toBe("error");expect(result.article).toMatchObject({id,revision:1});expect(mocks.tag).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
