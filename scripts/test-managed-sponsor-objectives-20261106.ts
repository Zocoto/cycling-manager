import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { buildManagedSponsorObjectiveRows, canonicalSponsorRandom, type ManagedSponsorSnapshot }
  from "./generate-managed-sponsor-objectives-20261106";
import { selectSponsorMainObjectiveOfferId } from "@/lib/game/sponsor-main-objective";

function fixture():ManagedSponsorSnapshot{
  const teams=[
    {bot_key:"antoine_morel_29",team_id:"817db772-6373-4b4a-bb01-a78b1107d546",offer_id:"e9353b68-b7c6-4a9a-a1d7-a96f84a89e07",
      catalog_key:"maison-lannic",budget_per_season:570000,base_budget_per_season:570000,contract_budget:570000,sponsor_continent_code:"europe"},
    {bot_key:"giulia_rinaldi",team_id:"61c5aac7-4917-48ed-b861-ebf5eea2d754",offer_id:"066e9270-cfd0-48ca-81b8-8ccad5d9f330",
      catalog_key:"dong-duong-phanh",budget_per_season:340000,base_budget_per_season:340000,contract_budget:340000,sponsor_continent_code:"asia"},
  ];
  const profileTypes=["cobbles","hilly","flat","time_trial","mountain"] as const;
  const countryCodes=["FR","VN","BE","TH","DE","LA"];
  const categoryCodes=["national","continental","world"] as const;
  return {season_id:"7ea43c15-30fd-4878-b18f-ab2a43ad3be8",game_year:5,
    offers:teams.map((team,index)=>({...team,sponsor_id:`sponsor-${index}`,season_id:"7ea43c15-30fd-4878-b18f-ab2a43ad3be8",
      offer_status:"accepted",contract_status:"active",role:"principal",objective_difficulty:"balanced",generation_version:10,
      reputation_points:120,current_division:"world",final_rank:null,existing_objective_count:0})),
    roster:teams.flatMap(team=>Array.from({length:12},(_,i)=>({bot_key:team.bot_key,rider_id:`${team.bot_key}-${i}`,
      first_name:"Test",last_name:String(i),country_code:i%2?"FR":"VN",joined_for_target_season:i>=6,
      mountain:68+i%5,hills:68+i%5,flat:63,time_trial:64,cobbles:64,sprint:65,
      acceleration:66,downhill:65,endurance:65,resistance:66,recovery:64,breakaway:60,prologue:61}))),
    history:[],
    calendar:Array.from({length:48},(_,i)=>({race_id:`race-${i}`,race_edition_id:`edition-${i}`,race_slug:`race-${i}`,race_label:`Race ${i}`,
      country_code:countryCodes[i%6],continent_code:i%2?"asia":"europe",registration_policy:"open",minimum_reputation:0,
      category_code:categoryCodes[i%3],race_format:i%7===0?"stage_race":"one_day",competition_type:"standard",
      is_monument:false,is_grand_tour:false,profile_types:[profileTypes[i%5]]})),
  };
}
const ids=()=>{let next=0;return ()=>`00000000-0000-4000-8000-${String(++next).padStart(12,"0")}`;};

test("creates only the two authorized canonical ten-objective plans, with exact race links",()=>{
  const snapshot=fixture();
  const result=buildManagedSponsorObjectiveRows(snapshot,ids());
  assert.equal(result.rows.length,20);
  assert.equal(new Set(result.rows.map(r=>r.id)).size,20);
  for(const offer of snapshot.offers){
    const rows=result.rows.filter(r=>r.sponsor_offer_id===offer.offer_id);
    assert.equal(rows.length,10);assert.equal(rows.reduce((sum,r)=>sum+r.satisfaction_points,0),100);
    assert.deepEqual(rows.map(r=>r.display_order),[1,2,3,4,5,6,7,8,9,10]);
    assert.ok(rows.every(r=>r.status==="draft"&&r.is_provisional&&r.target_details.generationVersion===12));
    assert.ok(!rows.some(r=>r.target_details.kind==="rider_recruitment"));
    const report=result.reports.find(r=>r.offer_id===offer.offer_id)!;
    assert.equal(report.country,offer.bot_key==="giulia_rinaldi"?"VN":"FR");
  }
  for(const row of result.rows){
    const details=row.target_details;
    if(details.kind!=="race_result")continue;
    const link=result.race_links.find(link=>link.objective_id===row.id)!;
    assert.equal(link.race_edition_id,details.raceEditionId);assert.equal(link.target_rank,details.targetRank);
    assert.equal(link.achievement_type,details.achievementType);assert.equal(link.target_scope,"race_final");
  }
  assert.deepEqual(result,buildManagedSponsorObjectiveRows(snapshot,ids()));
});

test("reproduces the persisted service RNG, including accented UTF-16 seeds",()=>{
  const source=readFileSync("services/persisted-sponsor-objectives.ts","utf8");
  const start=source.indexOf("function createSeededRandom(");
  const end=source.indexOf("async function loadSponsorObjectiveRaceCandidates",start);
  assert.ok(start>=0&&end>start);
  const javascript=ts.transpile(source.slice(start,end),{target:ts.ScriptTarget.ES2022});
  const original=Function(`${javascript};return createSeededRandom;`)() as (seed:string)=>()=>number;
  for(const seed of ["offer:maison-lannic","066e9270-cfd0-48ca-81b8-8ccad5d9f330:dong-duong-phanh","Vélo 🚴 à Noël"]){
    const expected=original(seed),actual=canonicalSponsorRandom(seed);
    for(let i=0;i<100;i++)assert.equal(actual(),expected());
  }
});

test("main objectives use each team's independent draw and the canonical S5 budget caps",()=>{
  const snapshot=fixture();
  const result=buildManagedSponsorObjectiveRows(snapshot,ids());
  assert.equal(result.main_terms.length,2);
  for(const terms of result.main_terms){
    const row=result.rows.find(r=>r.id===terms.sponsor_objective_id)!;
    const offer=snapshot.offers.find(o=>o.offer_id===row.sponsor_offer_id)!;
    assert.equal(selectSponsorMainObjectiveOfferId([offer.offer_id],snapshot.season_id),offer.offer_id);
    assert.ok(terms.cash_reward<=offer.budget_per_season*.15);assert.ok(terms.cash_reward>0);
  }
});

test("refuses an existing objective, uncommitted recruitment or an unauthorized sponsor",()=>{
  const exists=fixture();exists.offers[0].existing_objective_count=1;
  assert.throws(()=>buildManagedSponsorObjectiveRows(exists,ids()),/already exist/);
  const short=fixture();short.roster.shift();
  assert.throws(()=>buildManagedSponsorObjectiveRows(short,ids()),/twelve/);
  const wrong=fixture();wrong.offers[0].offer_id="other-offer";
  assert.throws(()=>buildManagedSponsorObjectiveRows(wrong,ids()),/Unexpected offer/);
  const budget=fixture();budget.offers[0].contract_budget=1000000;
  assert.throws(()=>buildManagedSponsorObjectiveRows(budget,ids()));
});
