import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({admin:vi.fn(),rpc:vi.fn(),abort:vi.fn()}));
vi.mock("next/cache",()=>({unstable_cache:(callback:unknown)=>callback}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:mocks.admin}));
import {getCurrentGameStaffRole,getGameStaffDirectorIds} from "./game-staff-access";

beforeEach(()=>{
  vi.clearAllMocks();
  mocks.rpc.mockReturnValue({abortSignal:mocks.abort});
  mocks.abort.mockResolvedValue({data:null,error:null});
  mocks.admin.mockReturnValue({rpc:mocks.rpc});
});

describe("fresh game staff authorisation",()=>{
  it.each(["owner","game_staff",null,"admin","moderator",{},true])("accepts only defined roles: %j",async role=>{
    mocks.abort.mockResolvedValue({data:role,error:null});
    expect(await getCurrentGameStaffRole({rpc:mocks.rpc} as never)).toBe(role==="owner"||role==="game_staff"?role:null);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_current_user_game_role");
    expect(mocks.abort).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not cache authorisation and sees revocation with the same client",async()=>{
    mocks.abort.mockResolvedValueOnce({data:"game_staff",error:null}).mockResolvedValueOnce({data:null,error:null});
    const client={rpc:mocks.rpc} as never;
    expect(await getCurrentGameStaffRole(client)).toBe("game_staff");
    expect(await getCurrentGameStaffRole(client)).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it("fails closed on a database error even when a role is present",async()=>{
    mocks.abort.mockResolvedValue({data:"owner",error:{message:"permission denied"}});
    await expect(getCurrentGameStaffRole({rpc:mocks.rpc} as never)).rejects.toThrow("droits");
  });
  it("fails closed on timeout/network rejection",async()=>{
    mocks.abort.mockRejectedValue(new Error("timeout"));
    await expect(getCurrentGameStaffRole({rpc:mocks.rpc} as never)).rejects.toThrow("timeout");
  });
});

describe("presentation-only staff directory",()=>{
  it("returns director ids without exposing roles, user ids or email addresses",async()=>{
    mocks.abort.mockResolvedValue({data:[{sporting_director_id:"director-one"},{sporting_director_id:"director-two"}],error:null});
    expect(await getGameStaffDirectorIds()).toEqual(["director-one","director-two"]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_game_staff_directory");
  });
  it.each(["database","network"])("does not block gameplay when badge loading fails: %s",async mode=>{
    const consoleError=vi.spyOn(console,"error").mockImplementation(()=>{});
    if(mode==="database")mocks.abort.mockResolvedValue({data:null,error:{message:"unavailable"}});
    else mocks.abort.mockRejectedValue(new Error("network"));
    expect(await getGameStaffDirectorIds()).toEqual([]);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
