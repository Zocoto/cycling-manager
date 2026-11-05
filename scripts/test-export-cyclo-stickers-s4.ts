/** Isolated PGlite + filesystem only. Never opens a network/production connection. */
import assert from "node:assert/strict";
import { mkdtemp,mkdir,readFile,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SPONSORS } from "../data/sponsors";
import { assembleCompletedCycloStickersS4Source,assembleCycloStickersS4IdentityStage,buildCycloStickersS4CompletedQueries,buildCycloStickersS4StageQueries,freezeCycloStickersS4StageAssets } from "./export-cyclo-stickers-s4";
import { CYCLO_STICKERS_FINAL_TITLE_SLOTS } from "../lib/game/cyclo-stickers-final-snapshot";

async function main(){
const {PGlite}=await import(pathToFileURL(process.argv[2]??"C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js").href);
const db=new PGlite();
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let checks=0;const eq=(a:unknown,b:unknown,label:string)=>{assert.deepEqual(a,b,label);checks++;};
const checkThrows=(task:()=>unknown,label:string)=>{assert.throws(task,label);checks++;};
const queries=buildCycloStickersS4StageQueries();
const selectBody=(query:string)=>query.slice(query.indexOf("\n",query.indexOf("set local idle_in_transaction_session_timeout"))+1,query.lastIndexOf("\ncommit;"));
const run=async(name:string)=>(await db.query(selectBody(queries[name]))).rows;
const sponsor=SPONSORS.find(s=>s.jerseys.some(j=>j.style==="classic"))!;
const jersey=sponsor.jerseys.find(j=>j.style==="classic")!;
try{
  await db.exec(`create table seasons(id uuid primary key,game_year integer,status text,starts_on date,ends_on date);
    create table rider_season_summaries(rider_id uuid,season_id uuid,uci_rank integer,points integer default 100,victories integer default 1);
    create table rider_national_championship_titles(id uuid,rider_id uuid,season_id uuid,race_edition_id uuid,championship_type text);
    create table race_editions(id uuid,season_id uuid,status text,race_id uuid,race_category_id uuid,display_name text default 'Synthetic championship');
    create table races(id uuid,competition_type text,race_format text,is_grand_tour boolean default false,is_monument boolean default false);
    create table race_categories(id uuid,code text);
    create table race_rosters(id uuid,rider_id uuid);
    create table race_results(race_roster_id uuid,race_edition_id uuid,status text,final_rank integer);
    create table stages(id uuid,race_edition_id uuid);
    create table stage_results(race_roster_id uuid,stage_id uuid,status text,rank integer);
    create table race_secondary_results(race_roster_id uuid,race_edition_id uuid,rank integer,classification_type text);
    create table rider_naturalizations(id uuid,rider_id uuid,created_at timestamptz,season_id uuid,to_country_id uuid,subject_type text);
    create table rider_season_ratings(rider_id uuid,season_id uuid,age integer,mountain numeric,hills numeric,flat numeric,time_trial numeric,cobbles numeric,sprint numeric,acceleration numeric,downhill numeric,endurance numeric,resistance numeric,recovery numeric,breakaway numeric,prologue numeric);
    create table riders(id uuid primary key,first_name text,last_name text,country_id uuid,avatar_profile_key text,avatar_seed bigint);
    create table countries(id uuid primary key,name text,iso_alpha2 text);
    create table rider_contracts(id uuid,rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,status text,left_season_id uuid,left_day_number integer);
    create table team_seasons(team_id uuid,season_id uuid,display_name text,final_rank integer,status text,points integer default 100);
    create table teams(id uuid primary key,amateur_jersey_pattern text,amateur_jersey_primary_color text,amateur_jersey_secondary_color text,amateur_jersey_accent_color text);
    create table team_sponsor_contracts(id uuid,team_id uuid,sponsor_id uuid,start_season_id uuid,contract_duration_seasons integer,selected_jersey_id text,selected_jersey_style text,pending_jersey_id text,pending_jersey_style text,role text,status text,created_at timestamptz);
    create table sponsors(id uuid primary key,catalog_key text);
  `);
  await db.query("insert into seasons values($1,4,'active','2026-10-09','2026-11-05'),($2,5,'planned','2026-11-06','2026-12-03')",[id(4),id(5)]);
  await db.query("insert into countries values($1,'France','FR')",[id(10)]);
  await db.query('insert into sponsors values($1,$2)',[id(20),sponsor.id]);
  for(let n=1;n<=5;n++){
    await db.query("insert into teams values($1,'classic','#112233','#445566','#778899')",[id(100+n)]);
    await db.query("insert into team_seasons(team_id,season_id,display_name,final_rank,status) values($1,$2,$3,$4,'active')",[id(100+n),id(4),`S4 team ${n}`,n]);
    await db.query("insert into team_sponsor_contracts values($1,$2,$3,$4,2,$5,'classic','FUTURE-S5-JERSEY','modern','principal','active',now())",[id(200+n),id(100+n),id(20),id(4),jersey.id]);
  }
  await db.query(`insert into riders select ('00000000-0000-4000-8000-'||lpad((1000+n)::text,12,'0'))::uuid,'Synthetic',n::text,$1,'western_europe',n from generate_series(1,203)n`,[id(10)]);
  await db.query(`insert into rider_contracts(id,rider_id,team_id,start_season_id,end_season_id,status) select gen_random_uuid(),id,$1,$2,$3,'active' from riders`,[id(101),id(4),id(5)]);
  await db.query(`insert into rider_season_summaries(rider_id,season_id,uci_rank) select id,$1,row_number()over(order by id)::integer from riders where id<=$2`,[id(4),id(1200)]);
  await db.query(`insert into rider_season_ratings select id,$1,25,70,60,60,60,60,60,60,60,60,60,60,60,60 from riders`,[id(4)]);
  await db.query("insert into race_categories values($1,'world')",[id(600)]);
  for(let n=0;n<13;n++){
    await db.query("insert into races(id,competition_type,race_format) values($1,'world_championship','one_day')",[id(500+n)]);
    await db.query("insert into race_editions(id,season_id,status,race_id,race_category_id) values($1,$2,'completed',$3,$4)",[id(300+n),id(4),id(500+n),id(600)]);
    await db.query('insert into rider_national_championship_titles values($1,$2,$3,$4,$5)',[id(400+n),id(1191+n),id(4),id(300+n),CYCLO_STICKERS_FINAL_TITLE_SLOTS[n]]);
  }
  for(const query of Object.values(queries)){
    assert.match(query,/begin read only;/);assert.match(query,/statement_timeout='4s'/);assert.doesNotMatch(selectBody(query),/\b(insert|update|delete|create|refresh|pg_sleep|for update|for share)\b/i);checks+=3;
  }
  const packet={context:await run("01-context.sql"),riders:await run("02-riders.sql"),teams:await run("03-teams.sql")};
  const stage=assembleCycloStickersS4IdentityStage(packet);
  eq(stage.riders.length,203,"top200 plus three outside champions captured");eq(stage.selection.knownChampions,13,"all known champion slots included");
  eq(stage.teams.length,5,"all five provisional team identities preserved");eq(stage.sportingResultsFinal,false,"active staging never claims final results");
  eq(stage.sourceSeasonStatus,"active","source status remains explicit evidence");eq(stage.riders.find(r=>r.id===id(1203))?.provisionalUciRank,null,"outside champion has no invented top200 rank");
  eq(stage.teams[0].contractEvidence[0].jerseyId,jersey.id,"current S4 selected jersey preserved");assert.ok(!JSON.stringify(stage).includes("FUTURE-S5-JERSEY"));checks++;
  assert.match(stage.sha256,/^[a-f0-9]{64}$/);checks++;
  const mixed=structuredClone(packet);mixed.riders[0].sourceSeasonId=id(5);checkThrows(()=>assembleCycloStickersS4IdentityStage(mixed),"mixed seasons rejected");
  const stale=structuredClone(packet);stale.riders[0].capturedAt="2000-01-01T00:00:00.000Z";checkThrows(()=>assembleCycloStickersS4IdentityStage(stale),"stale capture window rejected");
  const truncated=structuredClone(packet);truncated.riders.pop();checkThrows(()=>assembleCycloStickersS4IdentityStage(truncated),"truncated membership rejected");
  const duplicate=structuredClone(packet);duplicate.riders[1]=duplicate.riders[0];checkThrows(()=>assembleCycloStickersS4IdentityStage(duplicate),"ambiguous profile contract rejected");
  const future=structuredClone(packet);future.context[0].activeSeason=5;checkThrows(()=>assembleCycloStickersS4IdentityStage(future),"S5 current identity cannot be relabelled");
  const completed=structuredClone(packet);completed.context[0].sourceSeasonStatus="completed";checkThrows(()=>assembleCycloStickersS4IdentityStage(completed),"completed season uses final export mode instead of current identity");
  const invalidJersey=structuredClone(packet);invalidJersey.riders[0].team.sponsorContracts[0].jerseyId="unknown-jersey";checkThrows(()=>assembleCycloStickersS4IdentityStage(invalidJersey),"no sponsor jersey fallback");
  const temp=await mkdtemp(resolve(tmpdir(),"cyclo-stickers-assets-"));
  const original=stage.teams[0].jersey.imagePath!;await mkdir(resolve(temp,"public",original.slice(1),".."),{recursive:true});
  await writeFile(resolve(temp,"public",original.slice(1)),"S4 original jersey bytes");
  const frozen=await freezeCycloStickersS4StageAssets(stage,temp);eq(frozen.assets.length,1,"shared jersey file copied once");
  assert.match(frozen.teams[0].jersey.imagePath!,/^\/images\/collector-albums\/s4\/[a-f0-9]{64}\.webp$/);checks++;
  await writeFile(resolve(temp,"public",original.slice(1)),"S5 changed source jersey bytes");
  eq(await readFile(resolve(temp,"public",frozen.teams[0].jersey.imagePath!.slice(1)),"utf8"),"S4 original jersey bytes","frozen asset survives later source-file changes");
  assert.notEqual(frozen.sha256,stage.sha256);checks++;
  await db.exec("update seasons set status=case when game_year=4 then 'completed' else 'active' end");
  eq((await run("02-riders.sql")).length,0,"staging SQL cannot read S5 identities after rollover");eq((await run("03-teams.sql")).length,0,"staging SQL cannot read S5 selected jerseys after rollover");
  const finalQueries=buildCycloStickersS4CompletedQueries();
  const finalFacts:Record<string,unknown>={};
  const sections={context:"01-context",ranking:"02-ranking",teams:"03-teams",championships:"04-championships",ratings:"05-ratings",honours:"06-honours",contracts:"07-contracts",naturalizations:"08-naturalizations"};
  for(const [key,name]of Object.entries(sections)){
    assert.match(finalQueries[`${name}.sql`],/begin read only;/);assert.doesNotMatch(selectBody(finalQueries[`${name}.sql`]),/\b(insert|update|delete|create|refresh|pg_sleep|for update|for share)\b/i);checks+=2;
    finalFacts[key]=(await db.query(selectBody(finalQueries[`${name}.sql`]))).rows;
  }
  // Permanent identities and current selected jerseys now deliberately lie:
  // the completed exporter must rely on the frozen stage instead.
  await db.exec("update riders set first_name='S5 CHANGED';update team_sponsor_contracts set selected_jersey_id='S5 CHANGED';");
  const source=assembleCompletedCycloStickersS4Source(frozen,finalFacts);
  eq(source.ranking.length,50,"completed source has exact official top50");eq(source.riders.length,63,"all thirteen outside top50 champions retained");
  eq(source.riders[0].name,"Synthetic 1","S5 rider identity cannot replace staged S4 identity");eq(source.riders[0].jersey.imagePath,frozen.teams[0].jersey.imagePath,"completed source uses frozen S4 asset bytes");
  eq(source.identityCapture?.sha256,frozen.sha256,"final provenance links reviewed staging hash");
  const wrongStatus=structuredClone(finalFacts) as {context:Record<string,unknown>[]};wrongStatus.context[0].sourceSeasonStatus="active";checkThrows(()=>assembleCompletedCycloStickersS4Source(frozen,wrongStatus),"active S4 is rejected by completed producer");
  const missingStage=structuredClone(frozen);missingStage.riders.pop();checkThrows(()=>assembleCompletedCycloStickersS4Source(missingStage,finalFacts),"tampered staged membership fails hash verification");
  const wrongNative=structuredClone(finalFacts) as {ratings:Record<string,unknown>[]};wrongNative.ratings[0].sourceSeasonId=id(5);checkThrows(()=>assembleCompletedCycloStickersS4Source(frozen,wrongNative),"S5 native stats cannot be relabelled S4");
  const badTeam=structuredClone(finalFacts) as {teams:Record<string,unknown>[]};badTeam.teams[0].teamId=id(9999);checkThrows(()=>assembleCompletedCycloStickersS4Source(frozen,badTeam),"unstaged final team cannot use current jersey fallback");
  const badContract=structuredClone(finalFacts) as {contracts:Record<string,unknown>[]};badContract.contracts=badContract.contracts.filter(c=>c.riderId!==source.riders[0].id);checkThrows(()=>assembleCompletedCycloStickersS4Source(frozen,badContract),"missing historical club evidence is explicit");
  await db.exec("update seasons set status=case when game_year=4 then 'active' else 'planned' end");
  eq((await db.query(selectBody(finalQueries['02-ranking.sql']))).rows.length,0,"final-ranking SQL cannot export the active table as final");
  eq((await db.query(selectBody(finalQueries['05-ratings.sql']))).rows.length,0,"final-profile SQL remains completed-source gated");
  console.log(JSON.stringify({isolatedExportChecks:checks,productionAccess:false,maxProfiles:213,stagedProfiles:stage.riders.length,immutableJerseyAssets:true,finalSportingResults:false}));
}finally{await db.close();}
}
main().catch(error=>{console.error(error instanceof Error?`${error.name}: ${error.message.slice(0,1800)}`:"Export validation failed");process.exitCode=1;});
