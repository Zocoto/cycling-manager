import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorialRequirementError } from "./onboarding";

const mocks=vi.hoisted(()=>({auth:vi.fn(),admin:vi.fn()}));
vi.mock("@/lib/supabase/authenticated-user",()=>({getAuthenticatedUser:mocks.auth}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:mocks.admin}));
import {getAuthenticatedTutorialOnboardingState} from "./onboarding-state";

function query(data: unknown) {
  const q={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data,error:null})};
  for(const key of ["select","eq","order","limit"] as const)q[key].mockReturnValue(q);
  return q;
}
function fixture(riderCount=0,team:unknown={amateur_name:"Les Gb’s",amateur_identity_configured_at:"2026-07-23T15:56:26Z",status:"active"}) {
  const profile=query({id:"authenticated-director",country_id:"country",avatar_key:"avatar"});
  const summary=query({team_id:"team",rider_count:riderCount});
  const assignment=query(team?{team}:null);
  const admin={from:vi.fn().mockReturnValue(assignment)};
  const client={from:vi.fn().mockReturnValue(profile),rpc:vi.fn().mockReturnValue(summary)};
  mocks.auth.mockResolvedValue({data:{user:{id:"authenticated-user"}},error:null});
  mocks.admin.mockReturnValue(admin);
  return {profile,summary,assignment,admin,client:client as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>};
}
beforeEach(()=>vi.resetAllMocks());

describe("onboarding foundation is independent of today's roster",()=>{
  it("recognizes Mr0's founded club after all seven initial contracts have expired",async()=>{
    const f=fixture();
    const state=await getAuthenticatedTutorialOnboardingState(f.client);
    expect(state).toEqual({profileComplete:true,teamCreated:true,riderCount:0});
    expect(getTutorialRequirementError({requirement:"team_created",state})).toBeNull();
    expect(f.admin.from).toHaveBeenCalledOnce();
    expect(f.assignment.eq).toHaveBeenCalledWith("sporting_director_id","authenticated-director");
    expect(f.assignment.eq).toHaveBeenCalledWith("role","general_manager");
    expect(f.assignment.eq).toHaveBeenCalledWith("status","active");
    expect(f.assignment.limit).toHaveBeenCalledWith(1);
  });
  it("keeps the normal seven-rider path at the same query count",async()=>{
    const f=fixture(7);
    expect(await getAuthenticatedTutorialOnboardingState(f.client)).toEqual({profileComplete:true,teamCreated:true,riderCount:7});
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each([null,{amateur_name:"Seed",amateur_identity_configured_at:null,status:"active"},
    {amateur_name:null,amateur_identity_configured_at:"2026-07-23",status:"active"},
    {amateur_name:"Old",amateur_identity_configured_at:"2026-07-23",status:"inactive"}])("does not skip team foundation for an unfounded or inactive club",async team=>{
    const f=fixture(0,team);
    expect((await getAuthenticatedTutorialOnboardingState(f.client)).teamCreated).toBe(false);
  });
  it("can verify an already founded club even if the summary has no current-season row",async()=>{
    const f=fixture();f.summary.maybeSingle.mockResolvedValueOnce({data:null,error:null});
    expect((await getAuthenticatedTutorialOnboardingState(f.client)).teamCreated).toBe(true);
  });
  it("keeps profile validation required even for an existing empty club",async()=>{
    const f=fixture();f.profile.maybeSingle.mockResolvedValueOnce({data:{id:"authenticated-director",country_id:null,avatar_key:"avatar"},error:null});
    const state=await getAuthenticatedTutorialOnboardingState(f.client);
    expect(getTutorialRequirementError({requirement:"profile_complete",state})).toContain("Finalisez");
  });
  it("fails closed on a foundation query error",async()=>{
    const f=fixture();f.assignment.maybeSingle.mockResolvedValueOnce({data:null,error:{message:"unavailable"}});
    await expect(getAuthenticatedTutorialOnboardingState(f.client)).rejects.toThrow("Impossible de vérifier la fondation");
  });
  it("requires authentication before reading either profile or team",async()=>{
    const f=fixture();mocks.auth.mockResolvedValueOnce({data:{user:null},error:null});
    await expect(getAuthenticatedTutorialOnboardingState(f.client)).rejects.toThrow("session utilisateur");
    expect(f.client.from).not.toHaveBeenCalled();expect(mocks.admin).not.toHaveBeenCalled();
  });
});
