import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({admin:vi.fn(),news:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:mocks.admin}));
vi.mock("@/services/public-game-news",()=>({getCyclogazetteNewsItems:mocks.news}));
vi.mock("@/services/cyclogazette-editorial",()=>({loadCyclogazetteFeatureStories:async()=>[],loadCyclogazetteNationsCupSpecial:async()=>null}));
vi.mock("@/services/cyclogazette-jerseys",()=>({loadCyclogazetteJerseyStories:async()=>[]}));
import { publishCyclogazetteEdition, recoverCyclogazetteSeasonFinale } from "./cyclogazette";
type Row=Record<string,unknown>;
function fixture(humanIds:string[],{dayNumber=13,gameYear=4}:{dayNumber?:number;gameYear?:number}={}){
 let edition:Row|null=null;
 const records:Record<string,Row[]>={
  seasons:[{id:"season",name:`Saison ${gameYear}`,game_year:gameYear,current_day_number:dayNumber,status:"active"}],
  season_days:[{id:"day",season_id:"season",day_number:dayNumber,calendar_date:"2026-10-21"}],
  stages:["mixed","ai-only"].map(id=>({id:`stage-${id}`,season_day_id:"day",race_edition_id:id,stage_number:2,day_slot:"late",name:"Étape 2",race_editions:{display_name:id,races:{slug:id,race_format:"stage_race"}}})),
  race_results:["mixed","ai-only"].map(id=>({race_edition_id:id,race_roster_id:`roster-${id}`,final_rank:1})),
  race_rosters:["mixed","ai-only"].map(id=>({id:`roster-${id}`,rider_id:`rider-${id}`})),
  riders:["mixed","ai-only"].map(id=>({id:`rider-${id}`,first_name:"Vainqueur IA",last_name:id})),
  media_center_articles:[{id:"article",season_id:"season",status:"queued",day_number:13,title:"Tribune conservée",body:"Une actualité générale.",team_name:"Équipe",sponsor_name:null,building_level:1}],
 };
 const rpc=vi.fn(async(name:string)=>({data:name==="prepare_cyclogazette_season_gala"?{ready:true,awardCount:22}:name==="get_cyclogazette_human_race_editions"?humanIds.map(race_edition_id=>({race_edition_id})):0,error:null}));
 const inserted=vi.fn();
 const from=(table:string)=>{
  const filters:Array<(row:Row)=>boolean>=[];
  const rows=()=> (table==="cyclogazette_editions"?(edition?[edition]:[]):records[table]??[]).filter(row=>filters.every(fn=>fn(row)));
  const query={select:()=>query,order:()=>query,limit:()=>query,gte:()=>query,lte:()=>query,update:()=>query,
   eq:(key:string,value:unknown)=>{filters.push(row=>row[key]===value);return query;},
   neq:(key:string,value:unknown)=>{filters.push(row=>row[key]!==value);return query;},
   in:(key:string,values:unknown[])=>{filters.push(row=>values.includes(row[key]));return query;},
   returns:async()=>({data:rows(),error:null}),maybeSingle:async()=>({data:rows()[0]??null,error:null}),
   insert:(values:Row)=>{inserted(values);edition={...structuredClone(values),id:"77777777-7777-4777-8777-777777777777",season_days:{day_number:dayNumber}};return query;},
   single:async()=>({data:edition,error:null}),
  };return query;
 };
 mocks.admin.mockReturnValue({from,rpc});
 mocks.news.mockResolvedValue([{id:"movement",kind:"movement",title:"Actualité conservée",detail:"Mercato",happenedAt:"2026-10-21T16:00:00Z"}]);
 return {rpc,inserted};
}
beforeEach(()=>vi.clearAllMocks());
describe("Gazette publication scoped to human races",()=>{
 it.each([4,5,8])("prépare les awards puis publie la gazette J28 de la saison %s, y compris avec 22 awards",async(gameYear)=>{
  const f=fixture([],{gameYear,dayNumber:28});
  expect(await publishCyclogazetteEdition(new Date("2026-10-21T18:01:00Z"))).toMatchObject({status:'published'});
  expect(f.rpc).toHaveBeenCalledWith('prepare_cyclogazette_season_gala',{p_season_id:'season'});
  expect(f.inserted.mock.calls[0][0].title).toContain('Awards de fin de saison');
  expect(await publishCyclogazetteEdition(new Date("2026-10-21T18:11:00Z"))).toMatchObject({status:'already-published'});
  expect(f.inserted).toHaveBeenCalledTimes(1);
 });
 it("diffère une cérémonie incomplète et la reprend automatiquement après 20h",async()=>{
  const f=fixture([],{dayNumber:28});
  f.rpc.mockResolvedValueOnce({data:{ready:false,reason:'races-still-pending',pendingStages:1,pendingEditions:1},error:null} as never);
  expect(await publishCyclogazetteEdition(new Date("2026-10-21T18:01:00Z"))).toMatchObject({status:'skipped',edition:null});
  expect(f.inserted).not.toHaveBeenCalled();
  expect(await recoverCyclogazetteSeasonFinale(new Date("2026-10-21T19:11:00Z"))).toMatchObject({status:'published'});
  expect(f.inserted).toHaveBeenCalledTimes(1);
 });
 it("ne reprend pas la publication tardive hors J28 ou hors de la soirée",async()=>{
  const f=fixture([]);
  expect(await recoverCyclogazetteSeasonFinale(new Date("2026-10-21T19:11:00Z"))).toMatchObject({status:'skipped'});
  expect(f.rpc).not.toHaveBeenCalled();
  mocks.admin.mockClear();
  expect(await recoverCyclogazetteSeasonFinale(new Date("2026-10-21T18:11:00Z"))).toMatchObject({status:'skipped'});
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(await recoverCyclogazetteSeasonFinale(new Date("2026-10-21T22:11:00Z"))).toMatchObject({status:'skipped'});
 });
 it("archives a mixed tour even with an AI leader, omits an AI-only tour and preserves other articles",async()=>{
  const f=fixture(["mixed"]);
  const result=await publishCyclogazetteEdition(new Date("2026-10-21T18:01:00Z"));
  expect(result.status).toBe("published");
  expect(result.edition?.content.tourSummaries).toHaveLength(1);
  expect(result.edition?.content.tourSummaries?.[0]).toMatchObject({raceName:"mixed",generalLeader:"Vainqueur IA mixed"});
  expect(result.edition?.content.mediaArticles?.[0].title).toBe("Tribune conservée");
  expect(result.edition?.content.lead?.id).toBe("movement");
  expect(mocks.news).toHaveBeenCalledExactlyOnceWith(["mixed"]);
  expect(f.inserted).toHaveBeenCalledTimes(1);
  expect(await publishCyclogazetteEdition(new Date("2026-10-21T18:02:00Z"))).toMatchObject({status:"already-published"});
  expect(f.rpc.mock.calls.filter(([name])=>name==="get_cyclogazette_human_race_editions")).toHaveLength(1);
 });
 it("keeps publishing the general edition when no race has human participants",async()=>{
  fixture([]);
  const result=await publishCyclogazetteEdition(new Date("2026-10-21T18:01:00Z"));
  expect(result.status).toBe("published");expect(result.edition?.content.tourSummaries).toEqual([]);
  expect(result.edition?.content.raceStories).toEqual([]);expect(result.edition?.content.lead?.id).toBe("movement");
  expect(result.edition?.content.mediaArticles).toHaveLength(1);
 });
 it("never inserts an unfiltered edition when participation verification fails",async()=>{
  const f=fixture([]);f.rpc.mockImplementation(async(name:string)=>({data:0,error:name==="get_cyclogazette_human_race_editions"?{message:"offline"}:null}) as never);
  await expect(publishCyclogazetteEdition(new Date("2026-10-21T18:01:00Z"))).rejects.toThrow("participation humaine");
  expect(f.inserted).not.toHaveBeenCalled();
 });
});
