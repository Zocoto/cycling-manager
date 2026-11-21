import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// This test deliberately has no production credentials or connection option.
const modulePath = process.argv[2] ?? "C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) throw Error("An isolated local PGlite module is required.");
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const migrationPath = "supabase/migrations/20261121201037_consistent_new_sponsor_objective_portfolios.sql";
const sql = readFileSync(migrationPath, "utf8");
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12,"0")}`;
const query = async (statement, values=[]) => (await db.query(statement,values)).rows;
const one = async (statement,values=[]) => (await query(statement,values))[0];
let checks=0;
function check(value,message) {assert.ok(value,message);checks++;}
const exported={exports:{}};
const compiled=ts.transpileModule(readFileSync("lib/game/sponsor-objective-consistency.ts","utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
new Function("module","exports",compiled)(exported,exported.exports);
const {getSponsorObjectiveDifficultyWeight,allocateSponsorObjectiveSatisfactionPoints,haveOverlappingSponsorObjectiveRequirements}=exported.exports;

try {
  await db.exec(`
    create role anon;create role authenticated;create role service_role;
    create schema private;
    create table public.seasons(id uuid primary key,game_year int,status text);
    create table public.countries(id uuid primary key,iso_alpha2 text);
    create table public.sponsors(id uuid primary key,name text,country_id uuid);
    create table public.sporting_directors(id uuid primary key,reputation_points int);
    create table public.team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table public.sponsor_offers(id uuid primary key default gen_random_uuid(),sponsor_id uuid,season_id uuid,sporting_director_id uuid,
      continuing_contract_id uuid,title text,description text,budget_per_season numeric,base_budget_per_season numeric,
      negotiation_budget_ceiling numeric,objective_difficulty text,currency_code text,contract_duration_seasons int,
      available_from timestamptz,available_until timestamptz,status text,generation_version int,
      unique(continuing_contract_id,season_id));
    create table public.team_sponsor_contracts(id uuid primary key,team_id uuid,status text,role text,sponsor_id uuid,
      start_season_id uuid,end_season_id uuid,objective_season_id uuid,sponsor_offer_id uuid,contract_duration_seasons int,
      budget_per_season numeric,currency_code text,pending_sponsor_offer_id uuid,satisfaction_score int);
    create table public.sponsor_objectives(id uuid primary key default gen_random_uuid(),sponsor_offer_id uuid,season_id uuid,
      name text,description text,objective_type text,priority text,evaluation_timing text,evaluation_day_number int,status text,
      display_order int,renewal_bonus_percent numeric,satisfaction_points int,is_provisional boolean,target_details jsonb,
      created_at timestamptz default now(),unique(sponsor_offer_id,display_order));
    create table public.race_categories(id uuid primary key,code text);
    create table public.races(id uuid primary key,country_id uuid,slug text,status text,competition_type text);
    create table public.race_editions(id uuid primary key,race_id uuid,season_id uuid,race_category_id uuid,
      display_name text,status text,registration_policy text,minimum_reputation int);
    create table public.race_result_objectives(objective_id uuid primary key,race_edition_id uuid,stage_id uuid,target_scope text,
      achievement_type text,target_rank int,required_count int);
    create table public.objective_progress(sponsor_objective_id uuid,details jsonb);
    create table private.sponsor_objective_ambition_plans(sponsor_offer_id uuid,objective_difficulty text,objectives jsonb);
    create table private.finalizer_calls(contract_id uuid,season_id uuid);
    create function private.finalize_continuing_sponsor_offer_budget(c uuid,s uuid) returns void language sql as $$
      insert into private.finalizer_calls values(c,s)
    $$;
  `);
  const original=readFileSync("supabase/migrations/20260911160000_ensure_annual_sponsor_objective_rollover.sql","utf8");
  const start=original.indexOf("create or replace function public.prepare_annual_sponsor_objective_offers(");
  const end=original.indexOf("revoke all on function public.prepare_annual_sponsor_objective_offers",start);
  let functionSource=original.slice(start,end);
  functionSource=functionSource.replace("    v_prepared := v_prepared + 1;","    perform private.finalize_continuing_sponsor_offer_budget(v_contract.id,v_target.id);\n    v_prepared := v_prepared + 1;");
  await db.exec(functionSource);
  const targets=[
    {kind:"season_wins",winScope:"stages",minimumWinCount:6},
    {kind:"season_wins",winScope:"stages",minimumWinCount:3},
    {kind:"season_wins",winScope:"all",minimumWinCount:2},
    {kind:"infrastructure",minimumCompletedCount:9},
    {kind:"uci_ranking",rankingScope:"teams",targetRank:30,sportingCalibration:{projectedRank:24}},
    {kind:"nation_uci_ranking",countryCode:"FR",targetRank:8},
    {kind:"national_championship",countryCode:"FR",championshipType:"any",requiredTitleCount:1},
    {kind:"homegrown_roster",minimumPercentage:25},
    {kind:"youth_development",metric:"promotions",minimumCount:1},
    {kind:"rider_recruitment",riderId:id(999),overallRating:72},
  ];
  const points=[10,20,5,6,15,8,8,10,10,8];
  const sourceRows=targets.map((target,index)=>({id:id(100+index),name:`Source ${index+1}`,description:"Signed source condition",
    objective_type:target.kind,priority:"standard",evaluation_timing:"season_end",evaluation_day_number:null,
    status:index<2?"completed":"active",display_order:index+1,renewal_bonus_percent:0,satisfaction_points:points[index],
    is_provisional:false,target_details:{...target,generationVersion:12,objectiveDifficulty:"ambitious",ambitionLevel:3,
      sportingCalibration:{projectedRank:24},sportingPhilosophy:"grand_tour_general"}}));
  await db.exec(`insert into seasons values('${id(4)}',4,'completed'),('${id(5)}',5,'active'),('${id(6)}',6,'planned');
    insert into countries values('${id(10)}','FR');insert into sponsors values('${id(11)}','Sponsor', '${id(10)}');
    insert into sporting_directors values('${id(12)}',500);
    insert into team_manager_assignments values('${id(13)}','${id(12)}','general_manager','active'),('${id(14)}','${id(12)}','general_manager','active'),('${id(15)}','${id(12)}','general_manager','active');
    insert into sponsor_offers(id,sponsor_id,season_id,sporting_director_id,status,objective_difficulty) values
      ('${id(20)}','${id(11)}','${id(5)}','${id(12)}','accepted','ambitious'),
      ('${id(21)}','${id(11)}','${id(4)}','${id(12)}','accepted','ambitious');
    insert into team_sponsor_contracts values
      ('${id(30)}','${id(13)}','active','principal','${id(11)}','${id(5)}','${id(6)}','${id(5)}','${id(20)}',2,100000,'EUR',null,43),
      ('${id(31)}','${id(14)}','active','principal','${id(11)}','${id(5)}','${id(6)}','${id(5)}','${id(20)}',2,100000,'EUR',null,43),
      ('${id(32)}','${id(15)}','active','principal','${id(11)}','${id(4)}','${id(6)}','${id(4)}','${id(21)}',3,100000,'EUR',null,43);
    insert into sponsor_offers(id,sponsor_id,season_id,sporting_director_id,continuing_contract_id,status,objective_difficulty)
      values('${id(22)}','${id(11)}','${id(6)}','${id(12)}','${id(31)}','accepted','balanced');`);
  const insertRows=async(offer,season,rows)=>{
    for(const row of rows) await query(`insert into sponsor_objectives(id,sponsor_offer_id,season_id,name,description,objective_type,priority,
      evaluation_timing,evaluation_day_number,status,display_order,renewal_bonus_percent,satisfaction_points,is_provisional,target_details)
      select id,$1,$2,name,description,objective_type,priority,evaluation_timing,evaluation_day_number,status,display_order,
        renewal_bonus_percent,satisfaction_points,is_provisional,target_details
      from jsonb_populate_record(null::public.sponsor_objectives,$3::jsonb)`,[offer,season,JSON.stringify(row)]);
  };
  await insertRows(id(20),id(5),sourceRows);
  await insertRows(id(21),id(4),sourceRows.map((row,i)=>({...row,id:id(200+i),target_details:{...row.target_details,objectiveDifficulty:"balanced"}})));
  await insertRows(id(22),id(6),sourceRows.map((row,i)=>({...row,id:id(300+i),status:"draft",is_provisional:true})));
  await query("insert into private.sponsor_objective_ambition_plans values($1,'ambitious',$2::jsonb)",[id(22),JSON.stringify(sourceRows)]);
  const snapshot=async()=>JSON.stringify(await query("select * from sponsor_objectives order by id"));
  const before=await snapshot();
  const budgets=JSON.stringify(await query("select * from team_sponsor_contracts order by id"));
  const cache=JSON.stringify(await query("select * from private.sponsor_objective_ambition_plans"));
  const ambitionMigration=readFileSync("supabase/migrations/20261104143037_preserve_sponsor_objectives_by_ambition.sql","utf8");
  await db.exec(ambitionMigration.slice(ambitionMigration.indexOf("create function private.guard_sponsor_objective_ambition_insert()"),ambitionMigration.indexOf("-- Guarded surgical patches")));
  await db.exec(sql);
  check(await snapshot()===before,"DDL installation never changes any objective, source or already proposed S6 plan");
  check(JSON.stringify(await query("select * from team_sponsor_contracts order by id"))===budgets,"Installation never changes satisfaction or budgets");
  check(JSON.stringify(await query("select * from private.sponsor_objective_ambition_plans"))===cache,"Installation preserves all saved ambition variants");
  check((await query("select * from private.finalizer_calls")).length===0,"Installation invokes no prepare/finalizer/gameplay routine");
  const definition=(await one("select pg_get_functiondef('public.prepare_annual_sponsor_objective_offers(uuid)'::regprocedure) as body")).body;
  check(definition.includes("private.finalize_continuing_sponsor_offer_budget"),"Existing annual budget finalizer remains in the patched routine");
  for(const [detail,category,philosophy] of targets.flatMap(detail=>["national","elite"].flatMap(category=>["grand_tour_general","national_preference","youth_development"].map(philosophy=>[detail,category,philosophy])))) {
    const actual=(await one("select private.sponsor_objective_difficulty_weight($1::jsonb,$2,$3) as weight",[JSON.stringify(detail),category,philosophy])).weight;
    const expected=getSponsorObjectiveDifficultyWeight(detail,{raceCategoryCode:category,sportingPhilosophy:philosophy});
    check(Math.abs(actual-expected)<1e-10,"SQL difficulty exactly follows the TypeScript policy");
  }
  const frozenS6=JSON.stringify(await query("select * from sponsor_objectives where sponsor_offer_id=$1 order by id",[id(22)]));
  const signedS5=JSON.stringify(await query("select * from sponsor_objectives where sponsor_offer_id=$1 order by id",[id(20)]));
  await query("select public.prepare_annual_sponsor_objective_offers($1)",[id(6)]);
  check(JSON.stringify(await query("select * from sponsor_objectives where sponsor_offer_id=$1 order by id",[id(22)]))===frozenS6,"An already proposed S6 duplicate portfolio remains frozen when automatic preparation runs");
  check(JSON.stringify(await query("select * from sponsor_objectives where sponsor_offer_id=$1 order by id",[id(20)]))===signedS5,"Current signed objectives, statuses and weights remain unchanged after future preparation");
  const futureOffer=(await one("select id from sponsor_offers where continuing_contract_id=$1 and season_id=$2",[id(30),id(6)])).id;
  const future=await query("select * from sponsor_objectives where sponsor_offer_id=$1 order by display_order",[futureOffer]);
  check(future.length===10 && future.reduce((sum,row)=>sum+row.satisfaction_points,0)===100,"A newly created future portfolio retains ten positive goals and the100-point envelope");
  check(future.every(row=>row.satisfaction_points>0 &&row.target_details.generationVersion===13),"New future goals carry the new policy version and positive weights");
  check(future.every(row=>row.target_details.objectiveDifficulty==="balanced"&&row.target_details.ambitionLevel===3
    &&row.target_details.sportingCalibration.projectedRank===24&&row.target_details.annualSourceObjectiveId
    &&row.target_details.annualTargetGameYear===6),"Retained and replaced goals keep all shared ambition, calibration and annual-source context");
  check(future.some(row=>row.target_details.kind==="season_wins"&&row.target_details.winScope==="stages"&&row.target_details.minimumWinCount===6),"The more demanding original stage quota is retained");
  check(future.filter(row=>row.target_details.kind==="season_wins"&&row.target_details.winScope!=="stages").every(row=>row.target_details.minimumWinCount===1),"New complementary win scopes use the conservative one-win quota");
  check(future.find(row=>row.target_details.kind==="infrastructure").target_details.minimumCompletedCount===1,"Synthetic infrastructure thresholds are not inherited by a new plan");
  check(future.every((row,i)=>future.slice(i+1).every(other=>!haveOverlappingSponsorObjectiveRequirements(row.target_details,other.target_details))),"New automatic portfolios have no equivalent or nested requirements");
  assert.deepEqual(future.map(row=>row.satisfaction_points),allocateSponsorObjectiveSatisfactionPoints(future.map(row=>row.target_details),{sportingPhilosophy:"grand_tour_general"}));checks++;
  const once=JSON.stringify(future);
  await query("select public.prepare_annual_sponsor_objective_offers($1)",[id(6)]);
  check(JSON.stringify(await query("select * from sponsor_objectives where sponsor_offer_id=$1 order by display_order",[futureOffer]))===once,"Repeated preparation never reweights or rerolls an existing future portfolio");
  await query("select public.prepare_annual_sponsor_objective_offers($1)",[id(5)]);
  const legacyOffer=(await one("select id from sponsor_offers where continuing_contract_id=$1 and season_id=$2",[id(32),id(5)])).id;
  const legacy=await query("select * from sponsor_objectives where sponsor_offer_id=$1 order by display_order",[legacyOffer]);
  check(legacy[0].satisfaction_points===10&&legacy[1].satisfaction_points===20&&legacy[0].target_details.generationVersion===12,"The old S5 automatic path retains its legacy requirements and weights");
  check(JSON.stringify(await query("select * from private.sponsor_objective_ambition_plans"))===cache,"Automatic future preparation does not modify saved ambition alternatives");
  check((await one("select has_function_privilege('authenticated','private.normalize_new_annual_sponsor_portfolio(uuid,uuid)','execute') as allowed")).allowed===false,"Players cannot call the private future normalizer directly");
  check((await one("select private.sponsor_objective_requirements_overlap($1::jsonb,$2::jsonb) as overlaps",[
    JSON.stringify({kind:"uci_ranking",targetRank:20}),JSON.stringify({kind:"uci_ranking",targetRank:40}),
  ])).overlaps,"Older ranking targets without scope still share the same requirement family");

  // A zero-win legacy placeholder is rewritten into an accessible future race
  // by the existing annual engine before the new policy marker is attached.
  await db.exec(`insert into race_categories values('${id(400)}','national');
    insert into races values('${id(401)}','${id(10)}','test-race','active','standard');
    insert into race_editions values('${id(402)}','${id(401)}','${id(6)}','${id(400)}','Future race','planned','open',0);
    insert into team_manager_assignments values('${id(16)}','${id(12)}','general_manager','active');
    insert into sponsor_offers(id,sponsor_id,season_id,sporting_director_id,status,objective_difficulty)
      values('${id(23)}','${id(11)}','${id(5)}','${id(12)}','accepted','ambitious');
    insert into team_sponsor_contracts values('${id(33)}','${id(16)}','active','principal','${id(11)}',
      '${id(5)}','${id(6)}','${id(5)}','${id(23)}',2,100000,'EUR',null,43);`);
  await insertRows(id(23),id(5),sourceRows.map((row,i)=>({...row,id:id(500+i),...(i===0?{satisfaction_points:0,
    target_details:{...row.target_details,minimumWinCount:0,legacyNeutralized:true}}:{})})));
  await query("select public.prepare_annual_sponsor_objective_offers($1)",[id(6)]);
  const placeholderOffer=(await one("select id from sponsor_offers where continuing_contract_id=$1 and season_id=$2",[id(33),id(6)])).id;
  const placeholderFuture=await query("select * from sponsor_objectives where sponsor_offer_id=$1 order by display_order",[placeholderOffer]);
  check(placeholderFuture.length===10&&placeholderFuture.every(row=>row.target_details.generationVersion===13),"Legacy placeholder replacement retains the policy marker attached just before insertion");
  check(placeholderFuture.some(row=>row.target_details.kind==="race_result"&&row.target_details.raceId===id(401)),"The existing accessible-race replacement remains functional");
  console.log(`Passed ${checks} isolated future sponsor portfolio checks, including TypeScript parity and non-retroactivity.`);
} finally {
  await db.close();
}
