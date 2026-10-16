import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({metadata:[] as unknown[],rpc:vi.fn(),calendar:vi.fn(),settle:vi.fn(),cancel:vi.fn(),read:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({
  from:()=>{const q={select:()=>q,eq:()=>q,not:()=>q,order:()=>q,limit:()=>q,returns:async()=>({data:mocks.metadata,error:null})};return q;},rpc:mocks.rpc,
})}));
vi.mock("@/services/race-calendar",()=>({getActiveSeasonRaceCalendar:mocks.calendar}));
vi.mock("@/services/race-results",()=>({settleFinishedRaceResults:mocks.settle}));
vi.mock("@/services/race-settlement-runner",()=>({cancelUnviableRaceEditions:mocks.cancel}));
import {getDueNationalEditionIds,settleDueNationalChampionshipResults} from "./national-championship-settlement-runner";
const now=new Date("2026-10-16T13:30:00Z");
const edition=(id:string,hour=12,status="registration_open")=>({id,status,stages:[{departure_at:`2026-10-16T${hour}:00:00Z`,distance_km:30,status:"planned" as const}]});
beforeEach(()=>{
  vi.clearAllMocks();mocks.metadata=[edition("a"),edition("b"),edition("c")];
  mocks.rpc.mockImplementation(async(name,{p_race_edition_ids})=>({data:name === "get_due_national_championship_edition_ids"
    ? (mocks.metadata as {id:string}[]).map(row=>({race_edition_id:row.id}))
    : p_race_edition_ids?.map((id:string)=>({race_edition_id:id})) ?? [],error:null}));
  mocks.calendar.mockImplementation(async(_admin,_now,options)=>({seasonId:"s4",editions:[{id:options.raceEditionIds[0],competitionType:"national_time_trial",engagedRiders:[{riderId:"r"}]}]}));
  mocks.settle.mockResolvedValue({processedStages:1,completedEditions:1,failedEditions:0});mocks.cancel.mockResolvedValue(1);
});
describe("bounded national championship settlement",()=>{
  it("never selects the future 18h road slot, cancelled or completed races",()=>{
    expect(getDueNationalEditionIds([edition("a"),edition("future",16),edition("done",12,"completed"),edition("cancel",12,"cancelled")],now)).toEqual(["a"]);
  });
  it("loads only one claimed country per calendar and respects the job limit",async()=>{
    const result=await settleDueNationalChampionshipResults({seasonId:"s4",competitionType:"national_time_trial",now,maxEditions:2});
    expect(result).toMatchObject({targetedEditions:2,completedEditions:2,deferredEditions:1});
    expect(mocks.calendar.mock.calls.map(c=>c[2].raceEditionIds)).toEqual([["a"],["b"]]);
    expect(mocks.rpc.mock.calls.filter(c=>c[0]==="claim_race_editions_for_settlement").every(c=>c[1].p_race_edition_ids.length===1)).toBe(true);
  });
  it("does not load or settle a country already claimed by another cron",async()=>{
    mocks.rpc.mockResolvedValue({data:[],error:null});
    expect((await settleDueNationalChampionshipResults({seasonId:"s4",competitionType:"national_time_trial",now})).targetedEditions).toBe(0);
    expect(mocks.calendar).not.toHaveBeenCalled();expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("continues other countries when one calendar fails",async()=>{
    mocks.calendar.mockRejectedValueOnce(new Error("one country offline"));
    expect(await settleDueNationalChampionshipResults({seasonId:"s4",competitionType:"national_time_trial",now})).toMatchObject({failedEditions:1,completedEditions:2});
  });
  it("cancels an empty field through the existing cancellation path, without awarding a title",async()=>{
    mocks.metadata=[edition("a")];mocks.calendar.mockResolvedValue({seasonId:"s4",editions:[{id:"a",competitionType:"national_time_trial",engagedRiders:[]}]});
    expect(await settleDueNationalChampionshipResults({seasonId:"s4",competitionType:"national_time_trial",now})).toMatchObject({cancelledEditions:1,deferredEditions:0});
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("repairs an interrupted completed country's conditions without simulating or paying rewards again",async()=>{
    mocks.metadata=[edition("a")];
    mocks.calendar.mockResolvedValue({seasonId:"s4",editions:[{id:"a",status:"completed",competitionType:"national_time_trial",stages:[{id:"stage-a"}],engagedRiders:[{riderId:"r"}]}]});
    expect(await settleDueNationalChampionshipResults({seasonId:"s4",competitionType:"national_time_trial",now})).toMatchObject({completedEditions:1,deferredEditions:0});
    expect(mocks.rpc).toHaveBeenCalledWith("settle_finished_stage_conditions",{p_stage_id:"stage-a"});
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("drains all 174 countries over bounded jobs rather than truncating the field",async()=>{
    mocks.metadata=Array.from({length:174},(_,i)=>edition(String(i).padStart(3,"0")));
    mocks.settle.mockImplementation(async(calendar)=>{
      mocks.metadata=(mocks.metadata as {id:string}[]).filter(row=>row.id!==calendar.editions[0].id);
      return {processedStages:1,completedEditions:1,failedEditions:0};
    });
    let completed=0;
    for(let batch=0;batch<11;batch++) completed+=(await settleDueNationalChampionshipResults({seasonId:"s4",competitionType:"national_time_trial",now})).completedEditions;
    expect(completed).toBe(174);expect(mocks.metadata).toEqual([]);
    expect(new Set(mocks.calendar.mock.calls.map(c=>c[2].raceEditionIds[0])).size).toBe(174);
  });
});
