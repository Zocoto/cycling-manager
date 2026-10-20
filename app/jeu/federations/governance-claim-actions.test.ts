import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),revalidate:vi.fn(),refresh:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate,refresh:mocks.refresh}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.auth},rpc:mocks.rpc})}));
import { claimFederationPresidencyAction } from "./governance-actions";
const previous={status:"idle" as const,message:""};
function form(countryCode="bw",manifesto="Je souhaite assurer les sélections et le développement de notre fédération."){
  const data=new FormData();data.set("countryCode",countryCode);data.set("manifesto",manifesto);return data;
}
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({data:{user:{id:"viewer"}},error:null});mocks.rpc.mockResolvedValue({data:"election",error:null});});
describe("claim federation presidency action",()=>{
  it("validates inputs before contacting the database",async()=>{
    expect((await claimFederationPresidencyAction(previous,form("FR","short"))).status).toBe("error");
    expect((await claimFederationPresidencyAction(previous,form("invalid"))).status).toBe("error");
    expect(mocks.auth).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects an expired session",async()=>{
    mocks.auth.mockResolvedValue({data:{user:null},error:null});
    expect((await claimFederationPresidencyAction(previous,form())).status).toBe("error");expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("makes one authenticated call and refreshes the federation",async()=>{
    expect((await claimFederationPresidencyAction(previous,form())).status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("claim_national_federation_presidency",{p_country_code:"BW",p_manifesto:expect.any(String)});
    expect(mocks.revalidate).toHaveBeenCalledWith("/jeu/federations/bw");expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("shows a concurrent existing ballot without announcing a new one",async()=>{
    mocks.rpc.mockResolvedValue({error:{code:"P0002",message:"Un scrutin est déjà ouvert."}});
    const result=await claimFederationPresidencyAction(previous,form());
    expect(result).toEqual({status:"error",message:"Un scrutin est déjà ouvert."});expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("does not announce success when a mandate or eligibility rule rejects the claim",async()=>{
    mocks.rpc.mockResolvedValue({error:{code:"P0001",message:"La présidence n’est pas vacante."}});
    expect((await claimFederationPresidencyAction(previous,form())).status).toBe("error");expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
