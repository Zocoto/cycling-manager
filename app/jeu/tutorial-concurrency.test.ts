import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({client: vi.fn(), auth: vi.fn(), onboarding: vi.fn()}));
vi.mock("@/lib/supabase/server", () => ({createSupabaseServerClient: mocks.client}));
vi.mock("@/lib/supabase/authenticated-user", () => ({getAuthenticatedUser: mocks.auth}));
vi.mock("@/lib/tutorial/onboarding-state", () => ({getAuthenticatedTutorialOnboardingState: mocks.onboarding}));
import {completeTutorialAction, quitTutorialAction, setTutorialStepAction, skipTutorialAction, startTutorialAction} from "./tutorial-actions";
import {getAuthenticatedTutorialProgress, listAuthenticatedTutorialProgress} from "@/lib/tutorial/progress";

type Row = Record<string, unknown>;
function fixture({raceProgress = false, raceSession = false, seedProgress = null as Row|null} = {}) {
  const stamp = "2026-11-05T16:00:00.000Z";
  const state = {progress: seedProgress, session: null as Row|null, clock: 0, progressCollisions: 0, sessionCollisions: 0, failSession: false, staleProgress: false, staleSession: false, completeBeforeSkip: false, completeBeforeQuit: false};
  const queries: {table:string; columns:string; operation:string; payload:Row; filters: [string,string,unknown][]; signal?:AbortSignal}[] = [];
  let progressReads = 0, sessionReads = 0;
  let releaseProgress!:()=>void, releaseSession!:()=>void;
  const progressBarrier = new Promise<void>(resolve=>{releaseProgress=resolve;});
  const sessionBarrier = new Promise<void>(resolve=>{releaseSession=resolve;});
  function client() {
    return {from(table:string) {
      const trace = {table, columns:"*", operation:"select", payload:{} as Row, filters:[] as [string,string,unknown][], signal:undefined as AbortSignal|undefined};
      const q = {
        select(columns:string) {trace.columns=columns;return q;},
        insert(payload:Row) {trace.operation="insert";trace.payload=payload;return q;},
        update(payload:Row) {trace.operation="update";trace.payload=payload;return q;},
        eq(key:string,value:unknown) {trace.filters.push(["eq",key,value]);return q;},
        neq(key:string,value:unknown) {trace.filters.push(["neq",key,value]);return q;},
        order() {return q;}, limit() {return q;},
        abortSignal(signal:AbortSignal) {trace.signal=signal;return q;},
        single:()=>execute(), maybeSingle:()=>execute(),
        then(onFulfilled: (value:unknown)=>unknown,onRejected:(error:unknown)=>unknown) {return execute(true).then(onFulfilled,onRejected);},
      };
      async function execute(array=false) {
        queries.push(trace);
        if(trace.signal?.aborted) return {data:null,error:{message:"Request aborted"}};
        if(table==="sporting_directors") return {data:{id:"director"},error:null};
        const slot=table==="tutorial_progress"?"progress":"session";
        let row=state[slot];
        const project=(value:Row|null)=>{
          if(!value)return null;
          if(trace.columns.includes("version:metadata->")){
            const r=(value.metadata as Row)?.criteriumDiscoveryRun as Row|undefined;
            const lock=r?.lockedSimulation as Row|undefined;
            return {version:r?.version,registeredAt:r?.registeredAt,roster:r?.roster,slug:(r?.edition as Row)?.slug,stageId:lock?.stageId,raceEditionId:lock?.raceEditionId,inputSeed:(lock?.input as Row)?.seed,simulationSeed:(lock?.simulation as Row)?.seed,simulationStageId:(lock?.simulation as Row)?.stageId};
          }
          if(trace.columns==="*")return structuredClone(value);
          return Object.fromEntries(trace.columns.split(",").map(k=>[k,value[k]]));
        };
        if(trace.operation==="select") {
          const snapshot=project(row);
          if(slot==="progress"&&raceProgress&&progressReads++<2) {if(progressReads===2)releaseProgress();await progressBarrier;}
          if(slot==="session"&&raceSession&&sessionReads++<2) {if(sessionReads===2)releaseSession();await sessionBarrier;}
          return {data:array?(snapshot?[snapshot]:[]):snapshot,error:null};
        }
        if(trace.operation==="insert") {
          if(row) {if(slot==="progress")state.progressCollisions++;else state.sessionCollisions++;return {data:null,error:{code:"23505",message:"unique constraint"}};}
          if(slot==="session"&&state.failSession){state.failSession=false;return {data:null,error:{code:"XX001",message:"temporary session failure"}};}
          row={id:slot,metadata:{},created_at:stamp,updated_at:stamp,...trace.payload};state[slot]=row;
        } else {
          if(slot==="progress"&&state.completeBeforeSkip&&trace.payload.status==="skipped"){state.completeBeforeSkip=false;row={...row,status:"completed",completed_at:stamp,updated_at:"newer"};state.progress=row;}
          if(slot==="session"&&state.completeBeforeQuit&&trace.payload.status==="abandoned"){state.completeBeforeQuit=false;row={...row,status:"completed",ended_at:stamp,updated_at:"newer"};state.session=row;}
          if((slot==="progress"&&state.staleProgress)||(slot==="session"&&state.staleSession))return {data:null,error:null};
          if(!row||!trace.filters.every(([op,key,value])=>op==="eq"?row![key]===value:row![key]!==value))return {data:null,error:null};
          row={...row,...trace.payload,updated_at:stamp+String(++state.clock)};state[slot]=row;
        }
        return {data:project(row),error:null};
      }
      return q;
    }};
  }
  mocks.client.mockImplementation(async()=>client());
  mocks.auth.mockResolvedValue({data:{user:{id:"user"}},error:null});
  mocks.onboarding.mockResolvedValue({profileComplete:true,teamCreated:true,riderCount:7});
  return {state,queries,client};
}
const start = () => startTutorialAction({tutorialKey:"youth-development",launchSource:"manual"});
function progress(key="youth-development",extra:Row={}) {
  return {id:"progress",sporting_director_id:"director",tutorial_key:key,tutorial_type:"contextual",tutorial_version:2,status:"in_progress",current_step_key:"youth-overview",current_route:"/jeu/centre-de-formation?didacticiel=centre-formation&onglet=scouting",started_at:"2026-11-05T16:00:00Z",completed_at:null,skipped_at:null,created_at:"2026-11-05T16:00:00Z",updated_at:"2026-11-05T16:00:00Z",metadata:{},...extra};
}
function registration(extra:Row={}) {
  const stage="d15c0a03-6f04-4fc7-9a03-201c04c7d003";
  return {version:1,registeredAt:"2026-11-05T16:00:00Z",roster:Array.from({length:5},(_,i)=>({riderId:"rider-"+i,role:"domestique"})),edition:{slug:"criterium-de-la-decouverte"},lockedSimulation:{stageId:stage,raceEditionId:"d15c0a02-6f04-4fc7-9a02-201c04c7d002",input:{seed:"frozen"},simulation:{seed:"frozen",stageId:stage,timeline:"x".repeat(500_000)}},...extra};
}
beforeEach(()=>vi.resetAllMocks());

describe("tutorial launch races and recovery",()=>{
  it("recovers both simultaneous first launches after the real uniqueness collisions",async()=>{
    const f=fixture({raceProgress:true,raceSession:true});
    const results=await Promise.all([start(),start()]);
    expect(results.map(r=>r.ok)).toEqual([true,true]);
    expect(f.state.progressCollisions).toBe(1);expect(f.state.sessionCollisions).toBe(1);
    if(results[0].ok&&results[1].ok)expect(results[0].session?.id).toBe(results[1].session?.id);
    expect(f.queries.filter(q=>q.operation!=="select").every(q=>q.signal instanceof AbortSignal)).toBe(true);
  });
  it("can resume after progress was saved but the session request failed",async()=>{
    const f=fixture();f.state.failSession=true;
    expect((await start()).ok).toBe(false);expect(f.state.progress).not.toBeNull();expect(f.state.session).toBeNull();
    expect((await start()).ok).toBe(true);expect(f.state.session?.status).toBe("in_progress");
  });
  it("checks team eligibility before creating a failed launch record",async()=>{
    const f=fixture();mocks.onboarding.mockResolvedValue({profileComplete:true,teamCreated:false,riderCount:0});
    expect((await start()).ok).toBe(false);expect(f.state.progress).toBeNull();
    expect(f.queries.filter(q=>q.operation!=="select")).toEqual([]);
  });
  it("does not overwrite a cursor changed by a different request",async()=>{
    const f=fixture({seedProgress:progress()});f.state.staleProgress=true;
    const result=await setTutorialStepAction({tutorialKey:"youth-development",stepKey:"youth-tabs",route:String(f.state.progress?.current_route)});
    expect(result.ok).toBe(false);expect(f.state.progress?.current_step_key).toBe("youth-overview");
    expect(f.queries.find(q=>q.operation==="update")?.filters).toContainEqual(["eq","updated_at","2026-11-05T16:00:00Z"]);
  });
  it("keeps the original completion date and metadata on a completed replay",async()=>{
    const initial=progress("youth-development",{status:"completed",completed_at:"2026-08-01T12:00:00Z",metadata:{privateRun:"keep"}});
    const f=fixture({seedProgress:initial});
    const result=await completeTutorialAction({tutorialKey:"youth-development",stepKey:"youth-overview",route:String(initial.current_route)});
    expect(result.ok).toBe(true);expect(f.state.progress).toEqual(initial);
    expect(f.queries.filter(q=>q.table==="tutorial_progress"&&q.operation==="update")).toEqual([]);
    if(result.ok)expect(result.progress.metadata).toEqual({});
  });
  it("keeps a concurrently completed progress when an older skip finishes",async()=>{
    const f=fixture({seedProgress:progress()});f.state.completeBeforeSkip=true;
    const result=await skipTutorialAction({tutorialKey:"youth-development"});
    expect(result.ok).toBe(true);expect(f.state.progress?.status).toBe("completed");
    expect(f.state.progress?.completed_at).toBe("2026-11-05T16:00:00.000Z");
  });
});

describe("bounded tutorial metadata",()=>{
  it("does not load or return the frozen timeline when moving through the Critérium",async()=>{
    const stored=registration();const f=fixture({seedProgress:progress("criterium-discovery",{tutorial_version:1,metadata:{criteriumDiscoveryRun:stored}})});
    const result=await startTutorialAction({tutorialKey:"criterium-discovery",launchSource:"manual",restartFromBeginning:true});
    expect(result.ok).toBe(true);if(result.ok){expect(result.progress.metadata).toEqual({});expect(result.currentStepKey).toBe("registration-confirmed");}
    expect((f.state.progress?.metadata as Row).criteriumDiscoveryRun).toEqual(stored);
    expect(f.queries.filter(q=>q.table==="tutorial_progress").every(q=>q.columns!=="*"&&!q.columns.includes("timeline"))).toBe(true);
    expect(f.queries.filter(q=>q.columns.includes("version:metadata->"))).toHaveLength(1);
  });
  it.each(["version","seed"])("does not skip registration for corrupt %s evidence",async field=>{
    const run=registration(field==="version"?{version:99}:{});
    if(field==="seed")((run.lockedSimulation as Row).simulation as Row).seed="other";
    fixture({seedProgress:progress("criterium-discovery",{tutorial_version:1,metadata:{criteriumDiscoveryRun:run}})});
    const result=await startTutorialAction({tutorialKey:"criterium-discovery",launchSource:"manual",restartFromBeginning:true});
    expect(result.ok).toBe(true);if(result.ok)expect(result.currentStepKey).toBe("briefing");
  });
  it("uses light bootstrap rows but retains the full getter for race pages",async()=>{
    const f=fixture({seedProgress:progress("criterium-discovery",{metadata:{criteriumDiscoveryRun:registration()}})});
    const client=f.client() as unknown as Parameters<typeof getAuthenticatedTutorialProgress>[0];
    expect((await listAuthenticatedTutorialProgress(client))[0].metadata).toEqual({});
    expect((await getAuthenticatedTutorialProgress(client,"criterium-discovery"))?.metadata).toEqual(f.state.progress?.metadata);
    expect(f.queries.some(q=>q.table==="tutorial_progress"&&q.columns==="*")).toBe(true);
  });
  it("does not change completed session history when quit is retried",async()=>{
    const f=fixture({seedProgress:progress()});
    f.state.session={id:"session",tutorial_progress_id:"progress",tutorial_version:2,launch_source:"manual",status:"in_progress",last_step_key:"youth-overview",ended_at:null,updated_at:"old"};
    f.state.completeBeforeQuit=true;
    const result=await quitTutorialAction({tutorialKey:"youth-development",stepKey:"youth-overview",route:String(f.state.progress?.current_route)});
    expect(result.ok).toBe(true);expect(f.state.session.status).toBe("completed");
  });
});
