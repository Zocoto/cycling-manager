import {describe,expect,it} from "vitest";
import {createDemoSimulationInput} from "./race-simulation-demo";
import {DEFAULT_RACE_TEAM_STRATEGY} from "./race-strategy";
import {
  assignAutomaticRaceRoles,assignRaceObjectiveDuties,getGeneralClassificationProtectedRiderIds,
  getLeaderRecoveryTargetPriority,getTeamGeneralClassificationLeaderRiderIds,selectStageAttackPlan,simulateRaceStage,
  type RaceRole,
} from "./race-simulation";

const input=createDemoSimulationInput("haute-montagne",53);
const leader={...input.riders[0],id:"ahmed",name:"Ahmed",teamId:"kaffa",role:"leader" as const};
const helper={...input.riders[1],id:"visser",name:"Visser",teamId:"kaffa",role:"domestique" as const};
const gc=[{riderId:helper.id,elapsedTimeSeconds:10_000},{riderId:leader.id,elapsedTimeSeconds:10_013}];

describe("DS roles outrank automatic protection",()=>{
  it.each<RaceRole>(["domestique","leadout","free_agent","mountain_classification"])("never shelters an explicitly assigned %s, even with a stale GC flag",role=>{
    const rider={...helper,role,generalClassificationProtected:true};
    const riders=[leader,rider];
    const resolved=assignAutomaticRaceRoles(riders,input.segments,input.profileType,gc);
    expect(resolved.find(r=>r.id===helper.id)).toMatchObject({role,generalClassificationProtected:false});
    expect(getGeneralClassificationProtectedRiderIds(gc,riders)).not.toContain(helper.id);
    expect([...getTeamGeneralClassificationLeaderRiderIds(riders,gc)]).toEqual([leader.id]);
    expect(getLeaderRecoveryTargetPriority({role,isOverallGeneralClassificationLeader:true,isTeamGeneralClassificationLeader:true,generalClassificationProtected:true})).toBe(0);
    expect(rider.generalClassificationProtected).toBe(true); // The input is not mutated.
  });

  it.each<RaceRole>(["leader","leader_sprinter","sprinter","protected_rider"])("preserves a designated %s and its GC priority",role=>{
    const rider={...helper,role};
    const resolved=assignAutomaticRaceRoles([rider],input.segments,input.profileType,gc);
    expect(resolved[0]).toMatchObject({role,generalClassificationProtected:true});
    expect(getLeaderRecoveryTargetPriority({role,isOverallGeneralClassificationLeader:true})).toBe(5);
  });

  it("does not erase a support mission because its rider leads the GC",()=>{
    const rider={...helper,generalClassificationProtected:true,raceDuty:"protector" as const};
    const resolved=assignRaceObjectiveDuties({...input,riders:[leader,rider],generalClassification:gc});
    expect(resolved.find(r=>r.id===helper.id)).toMatchObject({role:"domestique",raceDuty:"protector",generalClassificationProtected:false});
  });

  it("does not silently reserve a stage favorite assigned as a domestique, without GC",()=>{
    const favorite={...helper,form:99,ratings:Object.fromEntries(
      Object.keys(helper.ratings).map(key=>[key,99]),
    ) as typeof helper.ratings};
    const rivals=Array.from({length:4},(_,index)=>({
      ...leader,id:`rival-${index}`,teamId:`rival-team-${index}`,form:95,
      ratings:Object.fromEntries(Object.keys(leader.ratings).map(key=>[key,95])) as typeof leader.ratings,
    }));
    const plan=selectStageAttackPlan([favorite,leader,...rivals],input.segments,()=>0.1);
    expect(plan.initialAttackIds.has(favorite.id)).toBe(true);
  });

  it("reproduces Visser's 18th place at 1:19 without promoting him above his DS role",()=>{
    const classification=[
      {riderId:"rival-1",elapsedTimeSeconds:32_372},
      {riderId:leader.id,elapsedTimeSeconds:32_385},
      ...Array.from({length:15},(_,index)=>({riderId:`rival-${index+2}`,elapsedTimeSeconds:32_386+index})),
      {riderId:helper.id,elapsedTimeSeconds:32_451},
    ];
    const resolved=assignAutomaticRaceRoles([leader,helper],input.segments,input.profileType,classification);
    expect(resolved.find(r=>r.id===helper.id)).toMatchObject({role:"domestique",generalClassificationProtected:false});
    expect(resolved.find(r=>r.id===leader.id)).toMatchObject({role:"leader",generalClassificationProtected:true});
  });

  it("records work FOR the designated leader, not an escort for the GC-leading domestique",()=>{
    const rivals=input.riders.filter(rider=>rider.teamId!==input.riders[0].teamId);
    const result=simulateRaceStage({
      ...input,riders:[leader,helper,...rivals],isStageRace:true,generalClassification:gc,
      teamStrategies:[{...DEFAULT_RACE_TEAM_STRATEGY,teamId:"kaffa",breakawayPolicy:"avoid"}],
    });
    expect(result.resolvedRiders.find(rider=>rider.id===helper.id)).toMatchObject({role:"domestique",generalClassificationProtected:false});
    expect(result.teamWork?.some(work=>work.targetRiderIds.includes(helper.id))).toBe(false);
    expect(result.teamWork?.some(work=>work.riderId===helper.id&&work.kind==="protection"&&work.targetRiderIds.includes(leader.id))).toBe(true);
  });
});
