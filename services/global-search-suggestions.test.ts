import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),history:vi.fn(),abort:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({from:()=>{
  const chain={select:()=>chain,ilike:()=>chain,order:()=>chain,limit:()=>chain,returns:mocks.history}; return chain;
}})}));
vi.mock("@/services/team-professional-status",()=>({getActivelySponsoredTeamIds:vi.fn()}));
import { searchGameDirectoryWithSuggestions } from "./global-search";
const client={rpc:mocks.rpc} as unknown as Parameters<typeof searchGameDirectoryWithSuggestions>[0];
const country=(n=1)=>({result_type:"country",entity_id:String(n),public_identifier:"bw",display_name:"Botswana",country_code:"BW",country_name:"Botswana",team_id:null,team_name:null});
describe("selective directory suggestions",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();mocks.history.mockResolvedValue({data:[],error:null});
    mocks.rpc.mockImplementation((name:string)=>name==="search_game_directory_suggestions"?{abortSignal:mocks.abort}:{data:[],error:null});
    mocks.abort.mockResolvedValue({data:[country()],error:null});
    vi.spyOn(console,"error").mockImplementation(()=>{});
  });
  it("never requests suggestions while existing search finds a result",async()=>{
    mocks.rpc.mockReturnValue({data:[country()],error:null});
    expect((await searchGameDirectoryWithSuggestions(client,"Botswana"))[0]).not.toHaveProperty("match_kind");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("labels only fallback results and uses one bounded fallback RPC",async()=>{
    expect((await searchGameDirectoryWithSuggestions(client,"  Bostwana  "))[0]).toMatchObject({match_kind:"approximate",display_name:"Botswana"});
    expect(mocks.rpc).toHaveBeenLastCalledWith("search_game_directory_suggestions",{p_query:"Bostwana",p_limit:6});
    expect(mocks.abort).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it.each(["Zoc","12345","11111111-1111-4111-8111-111111111111"])("does not broaden short or identifier searches: %s",async q=>{
    await searchGameDirectoryWithSuggestions(client,q);
    expect(mocks.rpc).not.toHaveBeenCalledWith("search_game_directory_suggestions",expect.anything());
  });
  it("caps and deduplicates suggestions defensively",async()=>{
    mocks.abort.mockResolvedValue({data:[country(),country(),...Array.from({length:9},(_,i)=>country(i+2))],error:null});
    const result=await searchGameDirectoryWithSuggestions(client,"Bostwana");
    expect(result).toHaveLength(6);expect(new Set(result.map(row=>row.entity_id)).size).toBe(6);
  });
  it("keeps a normal empty state if the optional fallback fails",async()=>{
    mocks.abort.mockResolvedValue({data:null,error:{message:"timeout"}});
    expect(await searchGameDirectoryWithSuggestions(client,"Bostwana")).toEqual([]);
  });
  it("retains the normal error path for failures in the original search",async()=>{
    mocks.rpc.mockReturnValue({data:null,error:{message:"original failed"}});
    await expect(searchGameDirectoryWithSuggestions(client,"Botswana")).rejects.toThrow("original failed");
  });
});
