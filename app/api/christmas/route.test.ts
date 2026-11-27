import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),read:vi.fn(),single:vi.fn(),eq:vi.fn(),revalidate:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.read})}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>{
  const query={select:()=>query,eq:(...args:unknown[])=>{mocks.eq(...args);return query;},maybeSingle:mocks.single};
  return {from:()=>query,rpc:mocks.rpc};
}}));
import { GET,POST } from "./route";
const userId="00000000-0000-4000-8000-000000000001",runId="00000000-0000-4000-8000-000000000002";
const env={review:process.env.CHRISTMAS_LOCAL_REVIEW,vercel:process.env.VERCEL_ENV};
const request=(kind="join",payload:Record<string,unknown>={},origin="https://cs.example")=>new Request("https://cs.example/api/christmas",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({id:userId,kind,payload})});
beforeEach(()=>{
  vi.clearAllMocks();delete process.env.CHRISTMAS_LOCAL_REVIEW;process.env.VERCEL_ENV="production";
  mocks.getUser.mockResolvedValue({data:{user:{id:userId}},error:null});mocks.rpc.mockResolvedValue({data:{message:"ok"},error:null});
  mocks.read.mockResolvedValue({data:{state:"open",balance:20},error:null});
});
afterEach(()=>{for(const [key,value] of [["CHRISTMAS_LOCAL_REVIEW",env.review],["VERCEL_ENV",env.vercel]]){if(value===undefined)delete process.env[key!];else process.env[key!]=value;}});
describe("Christmas production boundary",()=>{
  it("never mutates data on GET and loads reconnaissance only on demand",async()=>{
    expect((await GET(new Request("https://cs.example/api/christmas"))).status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith("get_current_christmas_state");expect(mocks.rpc).not.toHaveBeenCalled();
    await GET(new Request("https://cs.example/api/christmas?context=reconnaissance"));
    expect(mocks.read).toHaveBeenCalledWith("get_current_christmas_reconnaissance_context");
  });
  it("rejects cross-origin and preview writes before database access",async()=>{
    expect((await POST(request("join",{},"https://other.example"))).status).toBe(403);
    process.env.CHRISTMAS_LOCAL_REVIEW="1";expect((await POST(request())).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("authenticates both reads and writes",async()=>{
    mocks.getUser.mockResolvedValue({data:{user:null},error:null});
    expect((await GET(new Request("https://cs.example/api/christmas"))).status).toBe(401);
    expect((await POST(request())).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses arbitrary rewards, identity, quantities and targets",async()=>{
    for(const payload of [{item:"lunette-sniper-cadeaux",price:0},{coins:10000},{user:userId},{quantity:31},{quantity:1.5}])
      expect((await POST(request("buy",payload))).status).toBe(400);
    expect((await POST(request("finish",{runId,proof:{},score:7000}))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("carries verified identity and the idempotency key",async()=>{
    expect((await POST(request("advent",{day:1}))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("christmas_action",{p_auth_user_id:userId,p_request_id:userId,p_kind:"advent",p_payload:{day:1}});
  });
  it("checks run ownership before CPU validation",async()=>{
    mocks.single.mockResolvedValue({data:null,error:null});
    expect((await POST(request("finish",{runId,proof:{}}))).status).toBe(400);
    expect(mocks.eq).toHaveBeenCalledWith("user_id",userId);expect(mocks.eq).toHaveBeenCalledWith("edition_id","christmas-2026");expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reserves a bounded attempt and recomputes rewards from the actual physics",async()=>{
    mocks.single.mockResolvedValue({data:{id:runId,status:"running",sniper:false,started_at:new Date(Date.now()-30000).toISOString(),expires_at:new Date(Date.now()+60000).toISOString()},error:null});
    const proof={version:1,ticks:Math.ceil(6540/236*120),commands:[]};
    expect((await POST(request("finish",{runId,proof}))).status).toBe(200);
    expect(mocks.rpc.mock.calls[0]).toEqual(["claim_christmas_run_validation",{p_run:runId,p_user:userId}]);
    const payload=mocks.rpc.mock.calls[1][1].p_payload;
    expect(payload.score).toBe(0);expect(payload.deliveries).toBe(0);expect(payload.proof.traceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.proof).not.toHaveProperty("verifiedAt");
  });
  it("never replays or credits an already finished run",async()=>{
    mocks.single.mockResolvedValue({data:{id:runId,status:"finished",coins:10,lights:3},error:null});
    expect((await POST(request("finish",{runId,proof:null}))).status).toBe(200);expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not turn a committed purchase into a second debit after refresh/cache failure",async()=>{
    mocks.read.mockResolvedValue({data:null,error:{message:"temporarily unavailable"}});mocks.revalidate.mockImplementation(()=>{throw Error("cache");});
    vi.spyOn(console,"error").mockImplementation(()=>{});
    const response=await POST(request("buy",{item:"lunette-sniper-cadeaux",quantity:1}));
    expect(response.status).toBe(200);expect((await response.json()).refreshRequired).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);vi.restoreAllMocks();
  });
});
