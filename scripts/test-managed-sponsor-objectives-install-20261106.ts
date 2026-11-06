// PostgreSQL WASM only. No credentials, HTTP, Supabase CLI or production RPCs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createManagedSponsorObjectiveInstallSql, type buildManagedSponsorObjectiveRows }
  from "./generate-managed-sponsor-objectives-20261106";

async function main(){
  assert.ok(process.argv[2]?.replaceAll("\\","/").endsWith("/pglite/dist/index.js"));
  const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
  const payload=JSON.parse(readFileSync(process.argv[3],"utf8")) as ReturnType<typeof buildManagedSponsorObjectiveRows>;
  const reviewed=readFileSync(process.argv[4],"utf8").replaceAll("\r\n","\n");
  assert.equal(reviewed,createManagedSponsorObjectiveInstallSql(payload));
  const db=new PGlite();let checks=0;
  const scalar=async(sql:string)=>(await db.query(sql)).rows[0].value;
  const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
  const actors=[
    {offer:"e9353b68-b7c6-4a9a-a1d7-a96f84a89e07",team:"817db772-6373-4b4a-bb01-a78b1107d546",ds:"db3cdafe-0284-4193-8e3c-82b506d8599a",sponsor:"d3953d22-c968-4e15-aecc-79303178ea1d",key:"antoine_morel_29",catalog:"maison-lannic",budget:570000},
    {offer:"066e9270-cfd0-48ca-81b8-8ccad5d9f330",team:"61c5aac7-4917-48ed-b861-ebf5eea2d754",ds:"d2efc4d7-aeea-4778-941e-092f12ed4c5f",sponsor:"2e301532-1fb0-47db-b3f4-9939624ba86b",key:"giulia_rinaldi",catalog:"dong-duong-phanh",budget:340000},
  ];
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
      create table seasons(id uuid primary key,status text,game_year int,current_day_number int);
      insert into seasons values('7ea43c15-30fd-4878-b18f-ab2a43ad3be8','active',5,1);
      create table sponsors(id uuid primary key,catalog_key text);
      create table sponsor_offers(id uuid primary key,sponsor_id uuid references sponsors(id),sporting_director_id uuid,
        season_id uuid references seasons(id),status text,budget_per_season numeric,generation_version int,objective_difficulty text);
      create table alpha_bot_managers(team_id uuid,sporting_director_id uuid,bot_key text);
      create table team_sponsor_contracts(sponsor_offer_id uuid references sponsor_offers(id),team_id uuid,role text,status text,
        start_season_id uuid,end_season_id uuid,budget_per_season numeric);
      create table sponsor_objectives(id uuid primary key,sponsor_offer_id uuid references sponsor_offers(id),season_id uuid references seasons(id),
        name text not null,description text,objective_type text,priority text,evaluation_timing text,evaluation_day_number smallint,
        status text check(status in('draft','active','completed','failed','cancelled')),display_order smallint,
        renewal_bonus_percent numeric,satisfaction_points int check(satisfaction_points>0),is_provisional bool,target_details jsonb,
        updated_at timestamptz default now(),unique(sponsor_offer_id,display_order),unique(sponsor_offer_id,season_id,name));
      create table race_editions(id uuid primary key);
      create table race_result_objectives(objective_id uuid primary key references sponsor_objectives(id),race_edition_id uuid references race_editions(id),
        stage_id uuid,target_scope text,achievement_type text,target_rank smallint,required_count smallint check(required_count>0));
      create table sponsor_main_objective_terms(sponsor_objective_id uuid primary key references sponsor_objectives(id),
        cash_reward numeric,currency_code text,reputation_penalty numeric,race_category_code text,settlement_status text default 'pending');`);
    for(const actor of actors)await db.exec(`insert into sponsors values('${actor.sponsor}','${actor.catalog}');
      insert into sponsor_offers values('${actor.offer}','${actor.sponsor}','${actor.ds}','7ea43c15-30fd-4878-b18f-ab2a43ad3be8','accepted',${actor.budget},10,'balanced');
      insert into alpha_bot_managers values('${actor.team}','${actor.ds}','${actor.key}');
      insert into team_sponsor_contracts values('${actor.offer}','${actor.team}','principal','active','7ea43c15-30fd-4878-b18f-ab2a43ad3be8','7ea43c15-30fd-4878-b18f-ab2a43ad3be8',${actor.budget});`);
    for(const id of new Set(payload.race_links.map(r=>r.race_edition_id)))await db.exec(`insert into race_editions values(${quote(id)});`);
    const guardSource=readFileSync("supabase/migrations/20261104143037_preserve_sponsor_objectives_by_ambition.sql","utf8");
    const start=guardSource.indexOf("create function private.guard_sponsor_objective_ambition_insert()");
    const end=guardSource.indexOf("-- Guarded surgical patches",start);
    assert.ok(start>=0&&end>start);await db.exec(guardSource.slice(start,end));
    const rejected=async(sql:string,reason:RegExp)=>{
      await assert.rejects(()=>db.exec(sql),reason);await db.exec("rollback;");checks++;
      assert.equal(await scalar("select count(*)::int value from sponsor_objectives"),0);checks++;
    };
    await db.exec(`update sponsor_offers set objective_difficulty='ambitious' where id='${actors[0].offer}';`);
    await rejected(reviewed,/ambition a changé/);
    await db.exec("update sponsor_offers set objective_difficulty='balanced';");
    const broken=structuredClone(payload);broken.race_links[0].race_edition_id="00000000-0000-4000-8000-999999999999";
    await rejected(createManagedSponsorObjectiveInstallSql(broken),/foreign key constraint/);
    await db.exec("update seasons set current_day_number=2;");
    await rejected(reviewed,/S5 J1 changed/);
    await db.exec("update seasons set current_day_number=1;");
    await db.exec(reviewed);
    assert.equal(await scalar("select count(*)::int value from sponsor_objectives where status='active' and not is_provisional"),20);checks++;
    assert.equal(await scalar("select count(*)::int value from sponsor_offers where generation_version=12"),2);checks++;
    assert.equal(await scalar("select count(*)::int value from race_result_objectives"),payload.race_links.length);checks++;
    assert.equal(await scalar("select count(*)::int value from sponsor_main_objective_terms where settlement_status='pending'"),payload.main_terms.length);checks++;
    assert.equal(await scalar("select bool_and(points=100 and cnt=10) value from(select sum(satisfaction_points)points,count(*)cnt from sponsor_objectives group by sponsor_offer_id)x"),true);checks++;
    await assert.rejects(()=>db.exec(reviewed),/Objectives already exist/);await db.exec("rollback;");checks++;
    assert.equal(await scalar("select count(*)::int value from sponsor_objectives"),20);checks++;
    console.log(JSON.stringify({checks,isolated:true,productionTouched:false,rows:20,raceLinks:payload.race_links.length,mainTerms:payload.main_terms.length}));
  }finally{await db.close();}
}
main().catch(error=>{console.error(JSON.stringify({message:error.message,where:error.where,detail:error.detail},null,2));process.exitCode=1;});
