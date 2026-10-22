import {beforeEach,describe,expect,it,vi} from "vitest";
import type {GameNewsEditorState,GameStaffActionState} from "@/lib/game/game-product-news";
const mocks=vi.hoisted(()=>({client:vi.fn(),auth:vi.fn(),role:vi.fn(),rpc:vi.fn(),tag:vi.fn(),path:vi.fn(),members:vi.fn()}));
vi.mock("next/cache",()=>({updateTag:mocks.tag,revalidatePath:mocks.path}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("@/services/game-staff-access",()=>({getCurrentGameStaffRole:mocks.role}));
vi.mock("@/services/game-product-news",()=>({getGameStaffMembers:mocks.members,toGameNewsEditorArticle:(row:Record<string,unknown>)=>({id:row.id,draft:row.draft,published:row.published,publishedAt:row.published_at,updatedAt:row.updated_at,revision:row.revision,hasUnpublishedChanges:row.has_unpublished_changes})}));
import {saveGameNewsAction,searchGameStaffAction,setGameStaffRoleAction} from "./actions";

const id="00000000-0000-4000-8000-000000000100";
const userId="00000000-0000-4000-8000-000000000200";
const document={title:"Une nouveauté du jeu",category:"Nouveauté",summary:"Un résumé suffisamment détaillé.",body:"Un texte complet pour annoncer la nouveauté."};
const row={id,draft:document,published:null,published_at:null,updated_at:"2026-10-22T10:00:00Z",revision:1,has_unpublished_changes:true};
const initial:GameNewsEditorState={status:"idle",message:null};
const initialStaff:GameStaffActionState={status:"idle",message:null};
function form(overrides:Partial<Record<string,string>>={}){const data=new FormData();for(const [key,value] of Object.entries({...document,id:"",revision:"0",intent:"save_draft",...overrides}))if(typeof value==="string")data.set(key,value);return data;}
function staffForm(values:Record<string,string>){const data=new FormData();for(const [key,value] of Object.entries(values))data.set(key,value);return data;}
beforeEach(()=>{
  vi.clearAllMocks();mocks.client.mockResolvedValue({rpc:mocks.rpc});
  mocks.auth.mockResolvedValue({data:{user:{id:userId,email:"member@example.invalid"}},error:null});
  mocks.role.mockResolvedValue("game_staff");mocks.rpc.mockResolvedValue({data:[row],error:null});mocks.members.mockResolvedValue([]);
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

describe("owner-only staff management",()=>{
  it.each([null,"game_staff"])("rejects assignment and candidate search for role %s",async role=>{
    mocks.role.mockResolvedValue(role);
    expect((await setGameStaffRoleAction(initialStaff,staffForm({user_id:userId,enabled:"true"}))).status).toBe("error");
    expect((await searchGameStaffAction(initialStaff,staffForm({query:"membre"}))).status).toBe("error");expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("searches only names, with bounded query and result size",async()=>{
    mocks.role.mockResolvedValue("owner");mocks.rpc.mockResolvedValue({data:[{user_id:userId,director_id:id,display_name:"Membre",username:"member"}],error:null});
    const result=await searchGameStaffAction(initialStaff,staffForm({query:"  mem  "}));
    expect(result).toMatchObject({status:"success",candidates:[{userId,directorId:id,displayName:"Membre",username:"member"}]});
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("search_game_staff_candidates",{p_query:"mem",p_limit:10});
    expect(mocks.tag).not.toHaveBeenCalled();
  });
  it.each(["a","x".repeat(61)])("rejects invalid staff search length",async query=>{
    mocks.role.mockResolvedValue("owner");expect((await searchGameStaffAction(initialStaff,staffForm({query}))).status).toBe("error");expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["true","false"])("changes staff access only, then invalidates presentation badges: %s",async enabled=>{
    mocks.role.mockResolvedValue("owner");mocks.members.mockResolvedValue([{userId,directorId:id,displayName:"Membre",role:"game_staff"}]);
    const result=await setGameStaffRoleAction(initialStaff,staffForm({user_id:userId,enabled}));
    expect(result.status).toBe("success");expect(result.members).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_game_staff_role",{p_auth_user_id:userId,p_enabled:enabled==="true"});
    expect(mocks.tag).toHaveBeenCalledExactlyOnceWith("game-staff-directory");
    expect(mocks.tag).not.toHaveBeenCalledWith("game-product-news");
  });
  it.each([{user_id:"bad",enabled:"true"},{user_id:userId,enabled:"owner"}])("rejects forged role fields: %j",async values=>{
    mocks.role.mockResolvedValue("owner");expect((await setGameStaffRoleAction(initialStaff,staffForm(values))).status).toBe("error");expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not claim success or clear caches when SQL rejects a role change",async()=>{
    mocks.role.mockResolvedValue("owner");mocks.rpc.mockResolvedValue({data:null,error:{code:"42501"}});
    expect((await setGameStaffRoleAction(initialStaff,staffForm({user_id:userId,enabled:"true"}))).status).toBe("error");expect(mocks.tag).not.toHaveBeenCalled();
  });
  it("does not deny a confirmed role change when only the refreshed member list fails",async()=>{
    mocks.role.mockResolvedValue("owner");mocks.members.mockRejectedValue(new Error("list temporarily unavailable"));
    const result=await setGameStaffRoleAction(initialStaff,staffForm({user_id:userId,enabled:"true"}));
    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_game_staff_role",{p_auth_user_id:userId,p_enabled:true});
    expect(mocks.tag).toHaveBeenCalledExactlyOnceWith("game-staff-directory");
    expect(result.message).not.toContain("n’a pas pu être modifié");
  });
});
