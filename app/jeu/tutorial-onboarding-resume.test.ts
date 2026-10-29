import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({state:vi.fn(),client:vi.fn(),progress:vi.fn(),session:vi.fn(),identity:vi.fn()}));
vi.mock("@/lib/tutorial/onboarding-state",()=>({getAuthenticatedTutorialOnboardingState:mocks.state}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:mocks.client}));
vi.mock("@/lib/tutorial/progress",()=>({getAuthenticatedTutorialProgress:mocks.progress,getActiveTutorialSession:mocks.session,requireAuthenticatedSportingDirectorId:mocks.identity}));
import {startTutorialAction,setTutorialStepAction} from "./tutorial-actions";

function fixture(teamCreated=true){
  const rows:Record<string,Record<string,unknown>>={
    tutorial_progress:{id:"progress",sporting_director_id:"director",tutorial_key:"onboarding-core",tutorial_type:"onboarding",tutorial_version:4,status:"in_progress",current_step_key:"team-foundation",current_route:"/jeu/directeur-sportif",metadata:{}},
    tutorial_sessions:{id:"session",tutorial_progress_id:"progress",status:"in_progress",last_step_key:"team-foundation"},
  };
  const client={from:vi.fn((table:string)=>{
    let payload:Record<string,unknown>={};
    const q={update:vi.fn((data:Record<string,unknown>)=>{payload=data;return q;}),eq:vi.fn(),select:vi.fn(),single:vi.fn(async()=>({data:{...rows[table],...payload},error:null}))};
    q.eq.mockReturnValue(q);q.select.mockReturnValue(q);return q;
  }),rpc:vi.fn()};
  mocks.state.mockResolvedValue({profileComplete:true,teamCreated,riderCount:0});
  mocks.progress.mockResolvedValue(rows.tutorial_progress);mocks.session.mockResolvedValue(rows.tutorial_sessions);
  mocks.identity.mockResolvedValue("director");mocks.client.mockResolvedValue(client);
  return client;
}
beforeEach(()=>vi.resetAllMocks());
describe("onboarding resume for an existing empty club",()=>{
  it("resumes the saved foundation step directly at the roster after the server recognizes the club",async()=>{
    const client=fixture();
    const result=await startTutorialAction({tutorialKey:"onboarding-core",launchSource:"automatic"});
    expect(result.ok).toBe(true);
    if(result.ok){expect(result.currentStepKey).toBe("roster-overview");expect(result.progress.current_route).toBe("/jeu/effectif");}
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.from.mock.calls.every(([table])=>["tutorial_progress","tutorial_sessions"].includes(table))).toBe(true);
  });
  it.each([true,false])("keeps the roster access guard with founded=%s and zero riders",async founded=>{
    const client=fixture(founded);
    const result=await setTutorialStepAction({tutorialKey:"onboarding-core",stepKey:"roster-overview",route:"/jeu/effectif"});
    expect(result.ok).toBe(founded);
    if(!result.ok){expect(result.error).toContain("Fondez");expect(client.from).not.toHaveBeenCalled();}
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
