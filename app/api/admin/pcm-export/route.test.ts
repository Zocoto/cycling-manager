import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),role:vi.fn(),generate:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({})}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("@/services/game-staff-access",()=>({getCurrentGameStaffRole:mocks.role}));
vi.mock("@/services/pcm-export",()=>({generatePcmExport:mocks.generate}));
import {POST} from "./route";

function request(query="",origin="https://game.test",marker="pcm-export-admin"){
  return new Request(`https://game.test/api/admin/pcm-export${query}`,{method:"POST",headers:{origin,"x-cs-requested-with":marker}});
}
beforeEach(()=>{
  vi.clearAllMocks();mocks.auth.mockResolvedValue({data:{user:{id:"staff-user",email:"not-owner@example.invalid"}},error:null});mocks.role.mockResolvedValue("game_staff");
  mocks.generate.mockResolvedValue({archive:new Uint8Array([1,2,3]),filename:"database.zip",archiveSha256:"a".repeat(64),database:{season:4,counts:{teams:10,riders:100,contracts:100},ratingRange:{minimum:40,maximum:85},countryFallbacks:[],countryAdditions:[],nationalChampions:{riders:10},generatedAt:"2026-10-22T08:00:00Z",snapshotSha256:"b".repeat(64),outputSha256:"c".repeat(64)}});
});

describe("delegated PCM database export",()=>{
  it.each(["anonymous","invalid-session"])("requires authentication before permission lookup: %s",async state=>{
    mocks.auth.mockResolvedValue({data:{user:state==="anonymous"?null:{id:"user"}},error:state==="invalid-session"?{}:null});
    expect((await POST(request())).status).toBe(401);expect(mocks.role).not.toHaveBeenCalled();expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each(["ordinary","revoked"])("refuses %s users even when the request marker is forged",async()=>{
    mocks.role.mockResolvedValue(null);expect((await POST(request())).status).toBe(404);expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each(["owner","game_staff"])("permits only a freshly verified %s role",async role=>{
    mocks.role.mockResolvedValue(role);const response=await POST(request());expect(response.status).toBe(200);
    expect(mocks.role).toHaveBeenCalledOnce();expect(mocks.generate).toHaveBeenCalledExactlyOnceWith(false);
    expect(response.headers.get("Content-Type")).toBe("application/zip");expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Content-Disposition")).toContain("database.zip");expect(response.headers.get("X-CS-Season")).toBe("4");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1,2,3]);
  });
  it("does not grant access based on the former hard-coded owner email",async()=>{
    mocks.auth.mockResolvedValue({data:{user:{id:"user",email:"paul.leblanc22@gmail.com"}},error:null});mocks.role.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("fails closed when role verification fails",async()=>{
    mocks.role.mockRejectedValue(new Error("database unavailable"));
    expect((await POST(request())).status).toBe(404);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each([["https://foreign.test","pcm-export-admin"],["https://game.test","forged-marker"]])("retains CSRF checks for staff",async(origin,marker)=>{
    expect((await POST(request("",origin,marker))).status).toBe(403);expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("forwards only the supported gala flag",async()=>{
    expect((await POST(request("?gala=fin-de-saison"))).status).toBe(200);expect(mocks.generate).toHaveBeenCalledExactlyOnceWith(true);
  });
  it("reports export failure without claiming that gameplay data was changed",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});mocks.generate.mockRejectedValue(new Error("export unavailable"));
    const response=await POST(request());expect(response.status).toBe(500);expect(await response.json()).toMatchObject({error:expect.stringContaining("n’ont pas été modifiées")});log.mockRestore();
  });
});
