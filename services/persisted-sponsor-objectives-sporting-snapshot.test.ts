import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPONSORS } from "@/data/sponsors";
import { selectSponsorMainObjectiveOfferId } from "@/lib/game/sponsor-main-objective";

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), generate: vi.fn() }));
vi.mock("@/services/sponsor-objective-sporting-context", () => ({ loadSponsorObjectiveSportingContext: mocks.snapshot }));
vi.mock("@/services/sponsor-objectives", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/sponsor-objectives")>(),
  generateProvisionalSponsorObjectives: mocks.generate,
}));
import { ensureAndLoadSponsorObjectives, repairLegacyRaceObjectives, type SponsorOfferObjectiveContext } from "./persisted-sponsor-objectives";

type Row = Record<string, unknown>;
const independentTargets = [
  {kind:"nationality_quota",countryCode:"FR",minimumPercentage:25},
  {kind:"season_wins",winScope:"one_day_races",minimumWinCount:2},
  {kind:"season_wins",winScope:"stages",minimumWinCount:3},
  {kind:"season_wins",winScope:"stage_race_general",minimumWinCount:1},
  {kind:"uci_ranking",rankingScope:"teams",targetRank:40},
  {kind:"nation_uci_ranking",countryCode:"FR",targetRank:10},
  {kind:"national_championship",countryCode:"FR",championshipType:"any",requiredTitleCount:1},
  {kind:"homegrown_roster",minimumPercentage:25},
  {kind:"youth_development",metric:"promotions",minimumCount:1},
  {kind:"infrastructure",minimumCompletedCount:1},
];
const generated = Array.from({length:10},(_,index)=>({
  name:`Classement ${index}`,description:"Engagement stable",objectiveType:"team_result",priority:"standard",
  evaluationTiming:"season_end",evaluationDayNumber:null,displayOrder:index+1,renewalBonusPercent:0,
  satisfactionPoints:10,isProvisional:true,targetDetails:{kind:"uci_ranking",targetRank:20+index},
}));
const offers = ["one","two","three"].map(id=>({offerId:id,sponsor:SPONSORS[0],proposedBudget:100000,mainObjectiveAnnualBudget:100000}));
function fixture(complete:boolean,gameYear=5,contexts:readonly SponsorOfferObjectiveContext[]=offers) {
  const seasonId=`s${gameYear}`;
  const tables:Record<string,Row[]>={
    seasons:[{id:seasonId,game_year:gameYear,status:"planned"}],
    race_editions:[1,2,3].map(index=>({id:`edition-${index}`,race_id:`race-${index}`,season_id:seasonId,race_category_id:"national",
      display_name:`Course ${index}`,status:"planned",registration_policy:"open",minimum_reputation:0})),
    races:[1,2,3].map(index=>({id:`race-${index}`,country_id:"fr",slug:`race-${index}`,race_format:"one_day",
      competition_type:"standard",is_monument:false,is_grand_tour:false,status:"active"})),
    countries:[{id:"fr",iso_alpha2:"FR",continent_code:"EU"}],race_categories:[{id:"national",code:"national"}],
    stages:[],race_result_objectives:[],sponsor_main_objective_terms:[],sponsor_offers:[],
    sponsor_objectives:complete?offers.flatMap(offer=>generated.map(row=>({
      id:`${offer.offerId}-${row.displayOrder}`,sponsor_offer_id:offer.offerId,season_id:seasonId,name:row.name,
      description:row.description,objective_type:row.objectiveType,priority:row.priority,evaluation_timing:row.evaluationTiming,
      evaluation_day_number:null,status:"draft",display_order:row.displayOrder,renewal_bonus_percent:0,satisfaction_points:10,
      is_provisional:true,target_details:row.targetDetails,
    }))):[],
  };
  const reads:string[]=[];
  const writes:Row[][]=[];
  const updates:Row[]=[];
  const archivedPhilosophies:Row[]=[];
  const rpc=vi.fn(() => ({ overrideTypes: async () => ({ data: archivedPhilosophies, error: null }) }));
  const db={rpc,from(table:string){
    const filters:Array<{kind:"eq"|"neq"|"in";key:string;value:unknown}>=[];
    let incoming:Row[]|null=null;
    let upsertOptions:{onConflict?:string;ignoreDuplicates?:boolean}|undefined;
    let updating:Row|null=null;
    let deleting=false;
    function result(single:boolean) {
      reads.push(table);
      if(incoming) {
        if(table==="sponsor_objectives") writes.push(incoming);
        const conflictKeys=upsertOptions?.onConflict?.split(",")??[];
        const rows=incoming.filter(row=>!upsertOptions?.ignoreDuplicates||!tables[table].some(existing=>
          conflictKeys.every(key=>existing[key]===row[key]))).map(row=>({...row,id:`${row.sponsor_offer_id}-${row.display_order}`}));
        tables[table].push(...rows);incoming=null;
        return {data:rows,error:null};
      }
      const rows=(tables[table]??[]).filter(row=>filters.every(filter=>filter.kind==="eq"?row[filter.key]===filter.value
        :filter.kind==="neq"?row[filter.key]!==filter.value:(filter.value as unknown[]).includes(row[filter.key])));
      if(deleting) {tables[table]=tables[table].filter(row=>!rows.includes(row));return {data:[],error:null};}
      if(updating) {updates.push(updating);for(const row of rows) Object.assign(row,updating);updating=null;}
      return {data:single?rows[0]??null:rows,error:null};
    }
    const query={
      select:()=>query,order:()=>query,limit:()=>query,
      eq:(key:string,value:unknown)=>{filters.push({kind:"eq",key,value});return query;},
      neq:(key:string,value:unknown)=>{filters.push({kind:"neq",key,value});return query;},
      in:(key:string,value:unknown[])=>{filters.push({kind:"in",key,value});return query;},
      upsert:(rows:Row[]|Row,options?:typeof upsertOptions)=>{incoming=Array.isArray(rows)?rows:[rows];upsertOptions=options;return query;},
      update:(row:Row)=>{updating=row;return query;},
      delete:()=>{deleting=true;return query;},
      returns:async()=>result(false),maybeSingle:async()=>result(true),
      then:<T>(resolve:(value:ReturnType<typeof result>)=>T)=>Promise.resolve(result(false)).then(resolve),
    };
    return query;
  }};
  const load=()=>ensureAndLoadSponsorObjectives({supabase:db as never,seasonId,teamId:"team",teamReputationPoints:400,offers:contexts});
  return {load,reads,writes,updates,tables,archivedPhilosophies,rpc};
}

beforeEach(()=>{
  vi.clearAllMocks();
  mocks.snapshot.mockResolvedValue({teamSportingContext:{currentDivision:"world",projectedDivision:"elite",projectedRank:18},teamRiderCandidates:[]});
  mocks.generate.mockReturnValue(generated);
});

describe("S5 sponsor sporting snapshot lifecycle",()=>{
  it("rejects nested quotas only in entirely new S6 portfolios before any write",async()=>{
    const f=fixture(false,6);
    mocks.generate.mockReturnValue(generated.map((row,index)=>index===3?{
      ...row,objectiveType:"season_wins",targetDetails:{kind:"season_wins",winScope:"stages",minimumWinCount:6},
    }:{...row,targetDetails:independentTargets[index]}));
    await expect(f.load()).rejects.toThrow("équivalents ou imbriqués");
    expect(f.writes).toEqual([]);expect(f.updates).toEqual([]);
  });

  it("does not impose the new assertion on a newly generated legacy S5 portfolio",async()=>{
    const f=fixture(false);
    const result=await f.load();
    expect([...result.values()].every(rows=>rows.length===10)).toBe(true);
    expect(f.writes).toHaveLength(1);
  });

  it("accepts a new independent S6 portfolio",async()=>{
    const f=fixture(false,6);
    mocks.generate.mockReturnValue(generated.map((row,index)=>({...row,objectiveType:independentTargets[index].kind,targetDetails:independentTargets[index]})));
    const result=await f.load();
    expect([...result.values()].every(rows=>rows.length===10)).toBe(true);
    expect(f.writes).toHaveLength(1);
  });

  it("counts available road stages and preserves signed and archived philosophies",async()=>{
    const sponsor = SPONSORS.find((item) => item.id === "masline")!;
    const f=fixture(false,6,[
      {...offers[0],sponsor},
      {...offers[1],sponsor,sportingPhilosophy:"sprints"},
      {...offers[2],sponsor},
    ]);
    f.archivedPhilosophies.push({sponsor_offer_id:"three",sporting_philosophy:"time_trials"});
    f.tables.stages=[
      {race_edition_id:"edition-1",profile_type:"hilly",stage_type:"road",status:"planned"},
      {race_edition_id:"edition-1",profile_type:"hilly",stage_type:"road",status:"planned"},
      {race_edition_id:"edition-1",profile_type:"cobbles",stage_type:"road",status:"cancelled"},
      {race_edition_id:"edition-2",profile_type:"time_trial",stage_type:"team_time_trial",status:"planned"},
    ];
    mocks.generate.mockReturnValue(generated.map((row,index)=>({...row,objectiveType:independentTargets[index].kind,targetDetails:independentTargets[index]})));
    await f.load();
    expect(mocks.generate).toHaveBeenNthCalledWith(1,expect.objectContaining({
      sportingPhilosophy:"visibility",
      raceCandidates:expect.arrayContaining([
        expect.objectContaining({raceId:"race-1",roadStageCount:2}),
        expect.objectContaining({raceId:"race-2",roadStageCount:0}),
      ]),
    }));
    expect(mocks.generate).toHaveBeenNthCalledWith(2,expect.objectContaining({sportingPhilosophy:"sprints"}));
    expect(mocks.generate).toHaveBeenNthCalledWith(3,expect.objectContaining({sportingPhilosophy:"time_trials"}));
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith("get_archived_sponsor_offer_philosophies",{p_offer_ids:["one","three"]});
  });

  it.each([5,6])("leaves an already proposed S%s duplicate portfolio and its weights frozen",async(gameYear)=>{
    const f=fixture(true,gameYear);
    const rows=f.tables.sponsor_objectives;
    for(const offer of offers) {
      Object.assign(rows.find(row=>row.id===`${offer.offerId}-1`)!,{satisfaction_points:10,target_details:{kind:"season_wins",winScope:"stages",minimumWinCount:6}});
      Object.assign(rows.find(row=>row.id===`${offer.offerId}-2`)!,{satisfaction_points:20,priority:"mandatory",target_details:{kind:"season_wins",winScope:"stages",minimumWinCount:3}});
      Object.assign(rows.find(row=>row.id===`${offer.offerId}-3`)!,{satisfaction_points:5,priority:"optional"});
      Object.assign(rows.find(row=>row.id===`${offer.offerId}-4`)!,{satisfaction_points:5,priority:"optional"});
    }
    const before=structuredClone(rows);
    await f.load();await f.load();
    expect(f.tables.sponsor_objectives).toEqual(before);
    expect(f.writes).toEqual([]);expect(f.updates).toEqual([]);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("fills a legacy S6 partial portfolio without changing its proposed rows or adding overlapping goals",async()=>{
    const f=fixture(false,6);
    const oldRows=Array.from({length:9},(_,index)=>({
      ...draftRace("one"),id:`one-${index+1}`,season_id:"s6",display_order:index+1,
      objective_type:"season_wins",priority:"optional",satisfaction_points:index===0?10:index===1?20:5,
      target_details:{kind:"season_wins",winScope:"stages",minimumWinCount:index%2?3:6,generationVersion:12},
    }));
    f.tables.sponsor_objectives=oldRows;
    const before=structuredClone(oldRows);
    mocks.generate.mockReturnValueOnce(calibratedPlan()).mockReturnValue(generated.map((row,index)=>({...row,objectiveType:independentTargets[index].kind,targetDetails:independentTargets[index]})));
    const result=await f.load();
    expect(mocks.generate.mock.calls[0][0].preserveLegacyRequirements).toBe(true);
    expect(f.tables.sponsor_objectives.filter(row=>before.some(old=>old.id===row.id))).toEqual(before);
    expect(f.updates).toEqual([]);
    const completed=result.get("one")!;
    expect(completed).toHaveLength(10);
    expect(completed.reduce((sum,row)=>sum+row.satisfactionPoints,0)).toBe(100);
    const newGoal=completed.find(row=>row.displayOrder===10)!;
    expect(newGoal.targetDetails.kind).not.toBe("season_wins");
    expect(newGoal.satisfactionPoints).toBe(35);
    await f.load();
    expect(f.tables.sponsor_objectives.filter(row=>before.some(old=>old.id===row.id))).toEqual(before);
    expect(f.updates).toEqual([]);
  });

  function existingFuturePolicyPlan(f:ReturnType<typeof fixture>,generationVersion=13) {
    const race={...calibratedRace().targetDetails,raceEditionId:"edition-3"};
    const targets=[race,...independentTargets.filter((_,index)=>index!==3)];
    for(const offer of offers) for(let index=0;index<10;index++) {
      Object.assign(f.tables.sponsor_objectives.find(row=>row.id===`${offer.offerId}-${index+1}`)!,{
        objective_type:targets[index].kind,target_details:{...targets[index],generationVersion},
      });
    }
  }

  it("recovers only missing derived links and main terms for an already complete new-policy S6 portfolio",async()=>{
    const f=fixture(true,6);
    existingFuturePolicyPlan(f);
    const before=structuredClone(f.tables.sponsor_objectives);
    await f.load();
    expect(f.tables.sponsor_objectives).toEqual(before);
    expect(f.writes).toEqual([]);expect(f.updates).toEqual([]);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(f.tables.race_result_objectives).toHaveLength(3);
    expect(f.tables.sponsor_main_objective_terms).toHaveLength(1);
    const links=structuredClone(f.tables.race_result_objectives),terms=structuredClone(f.tables.sponsor_main_objective_terms);
    await f.load();
    expect(f.tables.sponsor_objectives).toEqual(before);
    expect(f.tables.race_result_objectives).toEqual(links);
    expect(f.tables.sponsor_main_objective_terms).toEqual(terms);
  });

  it("preserves existing new-policy links and cash terms during recovery",async()=>{
    const f=fixture(true,6);
    existingFuturePolicyPlan(f);
    const selectedOffer=selectSponsorMainObjectiveOfferId(offers.map(offer=>offer.offerId),"s6")!;
    const terms={sponsor_objective_id:`${selectedOffer}-1`,cash_reward:12345,currency_code:"CHF",reputation_penalty:7,
      race_category_code:"national",settlement_status:"pending"};
    const link={objective_id:"one-1",race_edition_id:"edition-kept",target_scope:"race_final",target_rank:8};
    f.tables.sponsor_main_objective_terms=[terms];f.tables.race_result_objectives=[link];
    await f.load();await f.load();
    expect(f.tables.sponsor_main_objective_terms).toEqual([terms]);
    expect(f.tables.race_result_objectives.find(row=>row.objective_id==="one-1")).toEqual(link);
    expect(f.writes).toEqual([]);expect(f.updates).toEqual([]);
  });

  it("does not backfill links or cash rewards for an existing legacy S6 portfolio",async()=>{
    const f=fixture(true,6);
    existingFuturePolicyPlan(f,12);
    const before=structuredClone(f.tables.sponsor_objectives);
    await f.load();await f.load();
    expect(f.tables.sponsor_objectives).toEqual(before);
    expect(f.tables.race_result_objectives).toEqual([]);
    expect(f.tables.sponsor_main_objective_terms).toEqual([]);
    expect(f.writes).toEqual([]);expect(f.updates).toEqual([]);
  });

  it("does not load a changing sporting context or regenerate complete offers on repeat visits",async()=>{
    const f=fixture(true),before=structuredClone(f.tables.sponsor_objectives);
    const first=await f.load(),second=await f.load();
    expect([...second]).toEqual([...first]);
    expect([...first.values()].every(rows=>rows.length===10)).toBe(true);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(f.tables.sponsor_objectives).toEqual(before);
    expect(f.writes).toEqual([]);
    expect(f.reads).not.toContain("team_seasons");expect(f.reads).not.toContain("rider_contracts");
    expect(f.reads).not.toContain("sponsor_offers");
  });

  it("loads a single shared context for three new offers, then keeps the resulting ten-objective plans",async()=>{
    const f=fixture(false);
    const first=await f.load();
    expect(mocks.snapshot).toHaveBeenCalledExactlyOnceWith({supabase:expect.anything(),seasonId:"s5",targetSeasonGameYear:5,teamId:"team"});
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    for(const [options] of mocks.generate.mock.calls) expect(options).toMatchObject({
      teamSportingContext:{currentDivision:"world",projectedDivision:"elite",projectedRank:18},teamRiderCandidates:[],
    });
    expect([...first.values()].every(rows=>rows.length===10)).toBe(true);
    expect(f.writes).toHaveLength(1);expect(f.writes[0]).toHaveLength(30);
    const second=await f.load();
    expect([...second]).toEqual([...first]);
    expect(mocks.snapshot).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(f.writes).toHaveLength(1);
  });

  it("can generate a stable plan when neither team context nor reliable riders are available",async()=>{
    const f=fixture(false);
    mocks.snapshot.mockResolvedValue({teamRiderCandidates:[]});
    const result=await f.load();
    expect([...result.values()].every(rows=>rows.length===10)).toBe(true);
    for(const [options] of mocks.generate.mock.calls) {
      expect(options.teamSportingContext).toBeUndefined();expect(options.teamRiderCandidates).toEqual([]);
    }
    await f.load();expect(mocks.snapshot).toHaveBeenCalledTimes(1);
  });

  it("repairs a partial plan before filling missing slots so its calibrated race is not inserted twice",async()=>{
    const f=fixture(false);
    const calibrated=calibratedRace();
    mocks.generate.mockReturnValue(calibratedPlan());
    f.tables.sponsor_objectives=offers.map(offer=>draftRace(offer.offerId));
    const result=await f.load();
    expect(f.updates.filter(row=>row.target_details)).toHaveLength(3);
    expect(f.writes).toHaveLength(1);expect(f.writes[0]).toHaveLength(27);
    for(const objectives of result.values()) {
      expect(objectives).toHaveLength(10);
      const races=objectives.filter(row=>row.targetDetails.kind==="race_result");
      expect(races).toHaveLength(1);
      expect(races[0]).toMatchObject({name:calibrated.name,targetDetails:calibrated.targetDetails});
    }
  });

  it("completes a race-heavy partial plan when the suitable calendar only supports one race objective",async()=>{
    const f=fixture(false),plan=calibratedPlan();
    mocks.generate.mockReturnValue(plan);
    f.tables.sponsor_objectives=Array.from({length:9},(_,index)=>({
      ...draftRace("one"),id:`one-${index+1}`,display_order:index+1,
    }));
    f.tables.race_result_objectives=Array.from({length:9},(_,index)=>({objective_id:`one-${index+1}`,race_edition_id:"obsolete"}));
    f.tables.sponsor_main_objective_terms=[{sponsor_objective_id:"one-2",settlement_status:"pending",cash_reward:50000}];
    const result=await f.load();
    const repaired=result.get("one")!;
    expect(repaired).toHaveLength(10);
    expect(repaired.filter(row=>row.targetDetails.kind==="race_result")).toHaveLength(1);
    expect(repaired.map(row=>row.targetDetails)).toEqual(plan.map(row=>row.targetDetails));
    expect(repaired.reduce((sum,row)=>sum+row.satisfactionPoints,0)).toBe(100);
    expect(f.tables.race_result_objectives).toEqual([]);
    expect(f.tables.sponsor_main_objective_terms.some(row=>row.sponsor_objective_id==="one-2")).toBe(false);
    expect(f.updates.filter(row=>row.target_details)).toHaveLength(9);
    expect(f.writes[0]).toHaveLength(21);
    expect([...result.values()].every(rows=>rows.length===10)).toBe(true);
  });
});

function calibratedPlan() {
  const otherTargets=[
    {kind:"nationality_quota",countryCode:"FR",minimumPercentage:25},
    {kind:"season_wins",winScope:"all",minimumWinCount:2},
    {kind:"season_wins",winScope:"stages",minimumWinCount:1},
    {kind:"uci_ranking",rankingScope:"teams",targetRank:40},
    {kind:"nation_uci_ranking",countryCode:"FR",targetRank:10},
    {kind:"national_championship",countryCode:"FR",championshipType:"any",requiredTitleCount:1},
    {kind:"homegrown_roster",minimumPercentage:25},
    {kind:"youth_development",metric:"promotions",minimumCount:1},
    {kind:"infrastructure",minimumCompletedCount:1},
  ];
  return [calibratedRace(),...generated.slice(1).map((row,index)=>({...row,targetDetails:otherTargets[index]}))]
    .map((row,index)=>({...row,satisfactionPoints:index===9?28:8}));
}

function calibratedRace() {
  return {...generated[0],name:"Top 15 sur l’Élite adaptée",description:"Un top 15 cohérent avec le collectif.",objectiveType:"race_result",
    targetDetails:{kind:"race_result",raceId:"race-3",raceEditionId:null,raceSlug:"race-3",raceLabel:"Élite adaptée",countryCode:"FR",
      achievementType:"top_n",targetRank:15,requiredCount:1,sportingPhilosophy:"cobbled_classics",variationReason:"new_leader_opportunity"}};
}
function draftRace(offerId:string):Row {
  return {id:`${offerId}-1`,sponsor_offer_id:offerId,season_id:"s5",name:"Remporter l’ancienne course",description:"Ancien objectif",
    objective_type:"race_result",priority:"standard",evaluation_timing:"season_end",evaluation_day_number:null,status:"draft",display_order:1,
    renewal_bonus_percent:0,satisfaction_points:10,is_provisional:true,
    target_details:{kind:"race_result",raceId:"obsolete",raceEditionId:null,raceSlug:"obsolete",raceLabel:"Ancienne course",countryCode:"FR",
      achievementType:"win",targetRank:null,requiredCount:1}};
}

describe("calibrated S5 partial race repair",()=>{
  it("reuses the generated portfolio and its achievable placing rather than the old prestige draw",async()=>{
    const row=draftRace("one"),replacement=calibratedRace();
    replacement.targetDetails.raceEditionId="edition-3" as never;
    const updates:unknown[]=[],filters:unknown[]=[];
    const query={eq:(key:string,value:unknown)=>{filters.push([key,value]);return query;},then:<T>(resolve:(value:{error:null})=>T)=>Promise.resolve({error:null}).then(resolve)};
    const from=vi.fn(()=>({update:(value:unknown)=>{updates.push(value);return query;}}));
    const random=vi.fn(()=>{throw Error("A calibrated S5 repair must not draw again");});
    await repairLegacyRaceObjectives({supabase:{from} as never,objectiveRows:[row] as never,
      sponsorCountryCode:"FR",sponsorPrestige:1,targetSeasonGameYear:5,teamReputationPoints:400,
      raceCandidates:[],generatedObjectives:[replacement] as never,random});
    expect(random).not.toHaveBeenCalled();expect(updates).toEqual([{
      name:replacement.name,description:replacement.description,objective_type:replacement.objectiveType,priority:replacement.priority,
      evaluation_timing:replacement.evaluationTiming,evaluation_day_number:replacement.evaluationDayNumber,
      renewal_bonus_percent:replacement.renewalBonusPercent,satisfaction_points:replacement.satisfactionPoints,target_details:replacement.targetDetails,
    }]);
    expect(filters).toEqual([["id","one-1"],["status","draft"],["is_provisional",true]]);
    expect(row.target_details).toEqual(replacement.targetDetails);
  });

  it("preserves signed rows, including a non-provisional row whose status still says draft",async()=>{
    const rows=[{...draftRace("one"),is_provisional:false},{...draftRace("two"),status:"active"},
      {...draftRace("three"),status:"active",objective_type:"team_result",target_details:{kind:"uci_ranking",targetRank:20}}];
    const before=structuredClone(rows),from=vi.fn(()=>{throw Error("No signed objective writes");});
    await repairLegacyRaceObjectives({supabase:{from} as never,objectiveRows:rows as never,sponsorCountryCode:"FR",sponsorPrestige:1,
      targetSeasonGameYear:5,teamReputationPoints:400,raceCandidates:[],random:()=>0.5});
    expect(rows).toEqual(before);expect(from).not.toHaveBeenCalled();
  });
});
