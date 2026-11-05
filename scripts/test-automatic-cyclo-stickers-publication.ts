// Isolated PostgreSQL/WASM only. No network, credentials or production state.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { buildCycloStickersS4CompletedQueries,cycloStickersPrimaryBaroudeurSql } from "./export-cyclo-stickers-s4";
import { createFinalCycloStickersSourceFixture } from "../lib/game/cyclo-stickers-final-snapshot.fixture";
import { createCycloStickersFinalSnapshot,serializeCycloStickersSnapshot } from "../lib/game/cyclo-stickers-final-snapshot";
import {getRiderSportingProfile,type RiderRatings} from "../lib/game/rider-profile";

async function main(){
const modulePath=process.argv[2]??"C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js";
if(!isAbsolute(modulePath)||!modulePath.replaceAll("\\","/").endsWith("/@electric-sql/pglite/dist/index.js"))throw Error("An absolute isolated PGlite module is required.");
const {PGlite}=await import(pathToFileURL(modulePath).href);const db=new PGlite();
const read=async(name:string)=>(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),"utf8")).replaceAll("\r\n","\n");
const table=(sql:string,name:string)=>{const match=sql.match(new RegExp(`create table (?:if not exists )?public\\.${name} \\([\\s\\S]*?\\n\\);`));assert.ok(match,name);return match[0];};
const rows=async(sql:string,args:unknown[]=[])=> (await db.query(sql,args)).rows;
const scalar=async(sql:string,args:unknown[]=[])=>{const row=(await rows(sql,args))[0];return row[Object.keys(row)[0]];};
const rpc=(name:string,args:unknown[]=[])=>scalar(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")})`,args);
const admin=()=>db.exec("reset role"),service=()=>db.exec("reset role;set role service_role");
let checks=0;const eq=(a:unknown,b:unknown,label:string)=>{assert.deepEqual(a,b,label);checks++;};
const rejects=async(task:()=>Promise<unknown>,pattern:RegExp,label:string)=>{await assert.rejects(task,pattern,label);checks++;};
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const workerA=id(9000),workerB=id(9001),workerC=id(9002),account=id(9500),director=id(9501);
const fixture=createFinalCycloStickersSourceFixture();
// One single-card chapter still exercises normal chapter completion. Three
// genuine Baroudeurs are provided separately by the shared72-card fixture.
fixture.riders[0].ratings.mountain=40;fixture.riders[0].ratings.timeTrial=40;fixture.riders[0].ratings.hills=95;
const sourceId=fixture.season.id,targetId=id(2),stageHash="1f465b5bbc8660ed64fe6eed77e64210c9f12514f08901092f17c37566d1c9f1";
const body=(query:string)=>query.slice(query.indexOf("\n",query.indexOf("set local idle_in_transaction_session_timeout"))+1,query.lastIndexOf("\ncommit;")).trim().replace(/;$/,"");
try{
  await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create role service_role bypassrls;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,display_name text,experience_points integer default 0,reputation_points numeric default 0);
    create table seasons(id uuid primary key,game_year integer unique,status text,current_day_number integer,starts_on date,ends_on date);
    create table countries(id uuid primary key,name text,iso_alpha2 text);create table riders(id uuid primary key);
    create table sporting_director_referrals(id uuid primary key);
    create table team_manager_assignments(id uuid primary key default gen_random_uuid(),sporting_director_id uuid,team_id uuid,role text,status text,created_at timestamptz default now());
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid references seasons,display_name text,points integer,final_rank integer,status text,cash_balance numeric default 0);
    create table season_days(id uuid primary key,season_id uuid,day_number integer);
    create table rider_season_summaries(rider_id uuid,season_id uuid,uci_rank integer,points integer,victories integer);
    create table rider_season_ratings(rider_id uuid,season_id uuid,age integer,mountain numeric,hills numeric,flat numeric,time_trial numeric,cobbles numeric,sprint numeric,acceleration numeric,downhill numeric,endurance numeric,resistance numeric,recovery numeric,breakaway numeric,prologue numeric);
    create table rider_contracts(id uuid primary key default gen_random_uuid(),rider_id uuid,team_id uuid,start_season_id uuid,end_season_id uuid,status text,left_season_id uuid,left_day_number integer);
    create table rider_naturalizations(id uuid,rider_id uuid,created_at timestamptz,season_id uuid,to_country_id uuid,subject_type text);
    create table rider_national_championship_titles(id uuid primary key default gen_random_uuid(),rider_id uuid,season_id uuid,race_edition_id uuid,championship_type text);
    create table race_editions(id uuid primary key,season_id uuid,status text,race_id uuid,race_category_id uuid,display_name text);
    create table races(id uuid,competition_type text,race_format text,is_grand_tour boolean default false,is_monument boolean default false);
    create table race_categories(id uuid,code text);create table race_rosters(id uuid,rider_id uuid);
    create table race_results(race_roster_id uuid,race_edition_id uuid,status text,final_rank integer);
    create table stages(id uuid,race_edition_id uuid);create table stage_results(race_roster_id uuid,stage_id uuid,status text,rank integer);
    create table race_secondary_results(race_roster_id uuid,race_edition_id uuid,rank integer,classification_type text);
    create function public.get_current_game_header_indicators_v3()
      returns table(current_sporting_director_id uuid,mailbox_unread_count integer,direct_message_unread_count integer,has_unread_global_chat boolean,has_unread_cyclogazette boolean,game_role text)
      language sql stable security definer set search_path='' as $$select d.id,3,4,true,false,'player'::text from public.sporting_directors d where d.auth_user_id=auth.uid() and d.status='active'$$;
    grant select on sporting_directors,seasons to authenticated;
  `);
  const economy=await read("20260720203000_create_rewards_finances_and_rankings");await db.exec(table(economy,"reward_events"));await db.exec(table(economy,"team_finance_transactions"));
  await db.exec(table(await read("20260730160000_create_alpha_tester_trophy"),"sporting_director_trophies"));
  await db.exec(table(await read("20260808165000_create_sporting_director_mailbox"),"sporting_director_messages"));
  await db.exec(table(await read("20261027170000_weekly_login_cyclo_stickers_boosters"),"cyclo_stickers_boosters"));
  await db.exec(table(await read("20261027180000_add_s5_referral_sticker_boosters"),"cyclo_sticker_boosters"));
  await db.exec(await read("20261027181000_expose_unified_cyclo_sticker_booster_inventory"));
  await db.exec(await read("20261105140000_prepare_persistent_cyclo_stickers"));
  const beforeV3=await scalar("select pg_get_functiondef('public.get_current_game_header_indicators_v3()'::regprocedure)");
  const beforeClaimAcl=await scalar("select proacl::text from pg_proc where oid='public.claim_current_cyclo_stickers_achievement(text,text)'::regprocedure");
  const beforeInstallerAcl=await scalar("select proacl::text from pg_proc where oid='public.install_cyclo_stickers_edition(text,jsonb,text,jsonb)'::regprocedure");
  const beforeClaimDefinition=await scalar("select pg_get_functiondef('public.claim_current_cyclo_stickers_achievement(text,text)'::regprocedure)");
  const migration=await read("20261105160000_automatic_cyclo_stickers_s4_publication");
  for(const query of Object.values(buildCycloStickersS4CompletedQueries())){assert.ok(migration.includes(body(query)),"facts RPC remains generated from exact bounded exporter query");checks++;}
  await db.exec(migration);
  eq(await scalar("select pg_get_functiondef('public.get_current_game_header_indicators_v3()'::regprocedure)"),beforeV3,"v3 indicator semantics remain untouched");
  eq(await scalar("select proacl::text from pg_proc where oid='public.claim_current_cyclo_stickers_achievement(text,text)'::regprocedure"),beforeClaimAcl,"catalogue extension preserves existing achievement ACL");
  eq(await scalar("select proacl::text from pg_proc where oid='public.install_cyclo_stickers_edition(text,jsonb,text,jsonb)'::regprocedure"),beforeInstallerAcl,"guarded installer patch preserves original ACL");
  eq(await scalar("select pg_get_functiondef('public.claim_current_cyclo_stickers_achievement(text,text)'::regprocedure)"),beforeClaimDefinition,"no empty-profile fallback modifies the claim function");
  const base: RiderRatings={mountain:60,hills:60,flat:60,timeTrial:60,cobbles:60,sprint:60,acceleration:60,downhill:60,endurance:60,resistance:60,recovery:60,breakaway:60,prologue:60};
  const cases: RiderRatings[]=[
    {...base,breakaway:61.99},{...base,breakaway:62},{...base,hills:62,breakaway:62},{...base,hills:61.99,breakaway:62},
    {...base,mountain:70,timeTrial:70,breakaway:70},{...base,mountain:74,timeTrial:66,breakaway:74},
    {...base,mountain:74.01,timeTrial:66,breakaway:74.01},{...base,mountain:74.01,timeTrial:66,breakaway:74.02},
    {...base,mountain:70.01,timeTrial:62.01,breakaway:70.01},{...base,mountain:62.01,timeTrial:70.01,breakaway:70.01},
    {...base,mountain:90,timeTrial:80,breakaway:89},{...base,mountain:90,timeTrial:80,breakaway:90},
    {...base,sprint:70,breakaway:70},{...base,cobbles:70,breakaway:70},
  ];
  let entropy=734521;for(let i=0;i<500;i++){
    const next=()=>{entropy=(Math.imul(entropy,1664525)+1013904223)>>>0;return Math.round((50+entropy/4294967296*50)*100)/100;};
    cases.push({...base,mountain:next(),timeTrial:next(),hills:next(),sprint:next(),cobbles:next(),breakaway:next()});
  }
  const parity=await rows("select private.cyclo_stickers_primary_baroudeur(row) as primary_bar from jsonb_array_elements($1::jsonb) with ordinality cases(row,n) order by n",[cases]);
  eq(parity.map((row:{primary_bar:boolean})=>row.primary_bar),cases.map(rating=>getRiderSportingProfile(rating).split(' / ')[0]==='Baroudeur'),"SQL matches JS62 threshold, stable ties, tour-average4 boundary and500 decimal cases");
  const inline=await rows(`select ${cycloStickersPrimaryBaroudeurSql()} as primary_bar from jsonb_to_recordset($1::jsonb) rating(mountain double precision,time_trial double precision,hills double precision,sprint double precision,cobbles double precision,breakaway double precision)`,[cases.map(r=>({mountain:r.mountain,time_trial:r.timeTrial,hills:r.hills,sprint:r.sprint,cobbles:r.cobbles,breakaway:r.breakaway}))]);
  eq(inline.map((row:{primary_bar:boolean})=>row.primary_bar),parity.map((row:{primary_bar:boolean})=>row.primary_bar),"inline bounded ranking SQL uses the same exact profile classifier");
  eq(await scalar("select count(*)::int from cyclo_stickers_publication_jobs"),0,"migration does not seed a publication job");
  eq(await scalar("select count(*)::int from cyclo_stickers_editions"),0,"migration creates no demo/final edition");
  await db.query("insert into seasons values($1,4,'active',28,'2020-01-01','2020-01-28'),($2,5,'planned',1,'2020-01-29','2020-02-25')",[sourceId,targetId]);
  await db.query("insert into sporting_directors(id,auth_user_id,status,display_name) values($1,$2,'active','Synthetic publication director')",[director,account]);
  await db.query("insert into race_categories values($1,'world')",[id(8000)]);
  for(const team of fixture.teams)await db.query("insert into team_seasons(id,team_id,season_id,display_name,points,final_rank,status) values($1,$2,$3,$4,$5,$6,'active')",[team.teamId,team.teamId,sourceId,team.name,team.points,team.rank]);
  for(const rider of fixture.riders){
    await db.query("insert into riders values($1)",[rider.id]);
    await db.query("insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status) values($1,$2,$3,$4,'active')",[rider.id,rider.teamId,sourceId,targetId]);
    const r=rider.ratings;
    await db.query("insert into rider_season_ratings values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",[rider.id,sourceId,rider.age,r.mountain,r.hills,r.flat,r.timeTrial,r.cobbles,r.sprint,r.acceleration,r.downhill,r.endurance,r.resistance,r.recovery,r.breakaway,r.prologue]);
  }
  for(const row of [...fixture.ranking,...fixture.bonusRanking])await db.query("insert into rider_season_summaries values($1,$2,$3,$4,$5)",[row.riderId,sourceId,row.rank,row.points,row.victories]);
  for(const [n,title]of fixture.championships.entries()){
    await db.query("insert into races(id,competition_type,race_format) values($1,'world_championship','one_day')",[id(8100+n)]);
    await db.query("insert into race_editions values($1,$2,'completed',$3,$4,'Synthetic championship')",[title.raceEditionId,sourceId,id(8100+n),id(8000)]);
    await db.query("insert into rider_national_championship_titles(rider_id,season_id,race_edition_id,championship_type) values($1,$2,$3,$4)",[title.riderId,sourceId,title.raceEditionId,title.type]);
  }
  await db.query("insert into cyclo_stickers_boosters(sporting_director_id,collection_season_id,acquisition_source,source_reference,awarded_on) values($1,$2,'weekly_login','existing-real-stock',current_date)",[director,targetId]);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${account}',false);`);
  await rejects(()=>rpc("claim_cyclo_stickers_publication",[workerA]),/permission denied/,"players cannot claim publication jobs");
  await rejects(()=>rpc("get_cyclo_stickers_final_source_facts",[id(999),id(998)]),/permission denied/,"players cannot capture official final facts");
  await rejects(()=>rpc("publish_cyclo_stickers_publication",[id(999),id(998),{},"a".repeat(64)]),/permission denied/,"players cannot enable an edition");
  await rejects(()=>rows("select * from cyclo_stickers_publication_jobs"),/permission denied/,"job metadata stays private");
  const headerBefore=(await rows("select * from get_current_game_header_indicators_v4()"))[0];
  eq(headerBefore,{current_sporting_director_id:director,mailbox_unread_count:3,direct_message_unread_count:4,has_unread_global_chat:true,has_unread_cyclogazette:false,game_role:"player",collector_album_available:false},"v4 preserves six existing fields and starts unavailable");
  await service();eq(await rpc("claim_cyclo_stickers_publication",[workerA]),null,"active S4 cannot start final capture");
  await rejects(()=>rpc("claim_cyclo_stickers_publication",[workerA,1]),/invalid/,"worker lease duration bounded");
  await rejects(()=>rpc("read_cyclo_stickers_completed_s4_facts",[]),/does not exist/,"private facts helper is not an exposed public API");
  await rejects(()=>scalar("select private.read_cyclo_stickers_completed_s4_facts()"),/permission denied/,"service cannot bypass fenced capture through private helper");
  await admin();eq(await scalar("select count(*)::int from cyclo_stickers_publication_jobs"),0,"pre-rollover check creates no job");
  await db.exec("update seasons set status=case when game_year=4 then 'completed' else 'active' end");
  await service();const claimA=await rpc("claim_cyclo_stickers_publication",[workerA,120]);eq(claimA.attempt,1,"first post-rollover worker owns the job");eq(claimA.identityStageSha256,stageHash,"claim pins the committed identity stage");
  eq(await rpc("claim_cyclo_stickers_publication",[workerB,120]),null,"second worker cannot replace a valid lease");
  await rejects(()=>rpc("get_cyclo_stickers_final_source_facts",[claimA.jobId,id(888)]),/lease/,"unrelated token cannot capture");
  await admin();const removed=(await rows("delete from rider_national_championship_titles where championship_type='world_road' returning *"))[0];
  await service();await rejects(()=>rpc("get_cyclo_stickers_final_source_facts",[claimA.jobId,claimA.leaseToken]),/incomplete/,"incomplete titles are never cached");
  await admin();eq(await scalar("select source_facts from cyclo_stickers_publication_jobs"),null,"failed capture leaves no cached partial facts");
  await db.query("insert into rider_national_championship_titles values($1,$2,$3,$4,$5)",[removed.id,removed.rider_id,removed.season_id,removed.race_edition_id,removed.championship_type]);
  await service();const facts=await rpc("get_cyclo_stickers_final_source_facts",[claimA.jobId,claimA.leaseToken]);
  eq([facts.ranking.length,facts.teams.length,facts.championships.length,facts.bonusRanking.length,facts.ratings.length],[50,5,13,3,60],"one bounded capture contains top50,three trueBaroudeurs and all final S4 titles");
  eq(facts.bonusRanking.map((row:{rank:number})=>row.rank),fixture.bonusRanking.map(row=>row.rank),"bonuscards preserve actual outside-top50 officialUCIranks");
  eq(await rpc("get_cyclo_stickers_final_source_facts",[claimA.jobId,claimA.leaseToken]),facts,"capture replay returns identical timestamp/facts");
  await admin();await db.query("update rider_season_ratings set mountain=1 where rider_id=$1",[fixture.riders[0].id]);
  await service();eq(await rpc("get_cyclo_stickers_final_source_facts",[claimA.jobId,claimA.leaseToken]),facts,"captured facts never rescan on retries");
  await admin();await db.exec("update cyclo_stickers_publication_jobs set lease_expires_at=now()-interval '1 second'");
  await service();await rejects(()=>rpc("get_cyclo_stickers_final_source_facts",[claimA.jobId,claimA.leaseToken]),/expired/,"expired token cannot read cached facts");
  const claimB=await rpc("claim_cyclo_stickers_publication",[workerB,120]);eq(claimB.attempt,2,"expired job is reclaimed");eq(claimB.factsCached,true,"reclaimed worker reuses one-off captured facts");assert.notEqual(claimB.leaseToken,claimA.leaseToken);checks++;
  await rejects(()=>rpc("fail_cyclo_stickers_publication",[claimA.jobId,claimA.leaseToken,"stale worker"]),/superseded/,"stale failure cannot overwrite a newer owner");
  const failed=await rpc("fail_cyclo_stickers_publication",[claimB.jobId,claimB.leaseToken,"x".repeat(4000)]);eq(failed.status,"failed","failure releases lease with retry backoff");
  eq(await rpc("claim_cyclo_stickers_publication",[workerA,120]),null,"backoff prevents repeated heavy attempts");
  await admin();eq(await scalar("select length(last_error)::int from cyclo_stickers_publication_jobs"),2000,"failure text remains bounded");await db.exec("update cyclo_stickers_publication_jobs set next_attempt_at=now()-interval '1 second'");
  await service();const claimC=await rpc("claim_cyclo_stickers_publication",[workerC,120]);eq(claimC.attempt,3,"failed job safely retries");
  const finalSource=structuredClone(fixture);finalSource.season={id:sourceId,gameYear:4,status:"completed",startsOn:"2020-01-01",endsOn:"2020-01-28"};
  finalSource.capturedAt=facts.context[0].capturedAt;finalSource.ranking=facts.ranking;finalSource.bonusRanking=facts.bonusRanking;finalSource.championships=facts.championships;
  finalSource.identityCapture={kind:"s4-active-identity-evidence",sourceSeasonId:sourceId,sourceSeasonStatus:"active",capturedAt:"2020-01-28T09:23:33.000Z",capturedUntil:"2020-01-28T09:23:38.000Z",sha256:stageHash};
  for(const rider of finalSource.riders){const native=facts.ratings.find((r:{riderId:string})=>r.riderId===rider.id);const {riderId:rid,sourceSeasonId:sid,age,...ratings}=native;void rid;void sid;rider.age=age;rider.ratings=ratings;rider.honours=[];}
  const snapshot=createCycloStickersFinalSnapshot(finalSource),sha256=createHash("sha256").update(serializeCycloStickersSnapshot(snapshot)).digest("hex");
  const badStage=structuredClone(snapshot);badStage.provenance.source.identityCapture!.sha256="b".repeat(64);
  await rejects(()=>rpc("publish_cyclo_stickers_publication",[claimC.jobId,claimC.leaseToken,badStage,sha256]),/trusted frozen/,"different staged identities cannot auto-publish");
  await rejects(()=>rpc("publish_cyclo_stickers_publication",[claimC.jobId,claimA.leaseToken,snapshot,sha256]),/superseded/,"stale worker cannot publish");
  const old69=structuredClone(snapshot);old69.cards=old69.cards.slice(0,69);
  await rejects(()=>rpc("publish_cyclo_stickers_publication",[claimC.jobId,claimC.leaseToken,old69,sha256]),/Catalogue final S4/,"former69-card shape cannot bypass the72-card installer");
  const fakeBonus=structuredClone(snapshot);fakeBonus.cards[69].ratings={...base};
  await rejects(()=>rpc("publish_cyclo_stickers_publication",[claimC.jobId,claimC.leaseToken,fakeBonus,sha256]),/72 emplacements/,"balanced riders cannot be labelled as true bonusBaroudeurs");
  await admin();await db.exec("create function isolated_fail_auto_catalogue() returns trigger language plpgsql as $$begin raise exception 'isolated catalogue insert failure';end$$;create trigger isolated_fail_auto_catalogue before insert on cyclo_stickers_cards for each row execute function isolated_fail_auto_catalogue();");
  await service();await rejects(()=>rpc("publish_cyclo_stickers_publication",[claimC.jobId,claimC.leaseToken,snapshot,sha256]),/isolated catalogue/,"late catalogue failure rolls back publication");
  await admin();eq(await scalar("select count(*)::int from cyclo_stickers_editions"),0,"failed publication installs no partial edition");eq(await scalar("select status from cyclo_stickers_publication_jobs"),"processing","failed publication keeps recoverable job ownership");await db.exec("drop trigger isolated_fail_auto_catalogue on cyclo_stickers_cards;drop function isolated_fail_auto_catalogue();");
  await service();const published=await rpc("publish_cyclo_stickers_publication",[claimC.jobId,claimC.leaseToken,snapshot,sha256]);eq(published.alreadyPublished,false,"trusted final S4 edition publishes automatically");
  eq((await rpc("publish_cyclo_stickers_publication",[claimC.jobId,claimC.leaseToken,snapshot,sha256])).alreadyPublished,true,"lost-response replay is idempotent");
  eq(await rpc("claim_cyclo_stickers_publication",[workerA,120]),null,"published job is never recaptured");
  eq((await rpc("fail_cyclo_stickers_publication",[claimC.jobId,claimC.leaseToken,"client timeout"])).status,"published","client timeout cannot undo successful publication");
  await admin();eq(await scalar("select count(*)::int from cyclo_stickers_cards"),72,"single immutable catalogue has exactly72 cards");eq(await scalar("select count(*)::int from cyclo_stickers_card_inventory"),0,"publication grants no cards");eq(await scalar("select count(*)::int from cyclo_stickers_boosters where opened_at is null"),1,"existing booster stock remains untouched");
  eq(await scalar("select count(*)::int from reward_events"),0,"publication pays no invented rewards");
  const edition=snapshot.edition;
  eq(await scalar("select count(*)::int from cyclo_stickers_cards where edition_id=$1 and kind is null and profile_key='breakaway'",[edition]),3,"Baroudeurs chapter contains its three genuine native rider cards");
  eq(await rows("select rarity,count(*)::int count from cyclo_stickers_cards group by rarity order by rarity"),[{rarity:'bronze',count:33},{rarity:'gold',count:7},{rarity:'holographic',count:2},{rarity:'silver',count:30}],"72-card edition preserves gold/silver/holo pools and adds only threebronze");
  eq(await scalar("select (a->>'target')::int from cyclo_stickers_editions e cross join lateral jsonb_array_elements(e.configuration->'achievements') a where a->>'id'='count-50'"),72,"final achievement requires all72 stickers");
  eq(await scalar("select jsonb_array_length(configuration->'achievements') from cyclo_stickers_editions"),19,"all19 achievement amounts remain configured");
  eq(await scalar("select profile_key from cyclo_stickers_cards where edition_id=$1 and card_number=1",[edition]),"hills","first rider has a normal one-card chapter");
  await db.query("insert into team_seasons(id,team_id,season_id,display_name,points,final_rank,status) values($1,$2,$3,'Synthetic S5 claim team',0,1,'active')",[id(9600),fixture.teams[0].teamId,targetId]);
  await db.query("insert into team_manager_assignments(sporting_director_id,team_id,role,status) values($1,$2,'general_manager','active')",[director,fixture.teams[0].teamId]);
  await db.query("insert into cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity,pasted) select $1,$2,card_number,1,true from cyclo_stickers_cards where edition_id=$1 and (card_number=1 or kind is not null)",[edition,director]);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${account}',false);`);
  eq((await rpc("claim_current_cyclo_stickers_achievement",[edition,"profile-hills"])).alreadyClaimed,false,"nonempty chapter still rewards its own cards before all50");
  await admin();await db.query("insert into cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity,pasted) select $1,$2,card_number,1,true from cyclo_stickers_cards where edition_id=$1 and card_number between 2 and 50",[edition,director]);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${account}',false);`);
  await rejects(()=>rpc("claim_current_cyclo_stickers_achievement",[edition,"profile-breakaway"]),/pas encore terminé/,"all50 top riders plus19 introduction cards do not replace threeBaroudeurs");
  await rejects(()=>rpc("claim_current_cyclo_stickers_achievement",[edition,"count-50"]),/pas encore terminé/,"former69 stickers are not the72-sticker completed edition");
  await admin();await db.query("insert into cyclo_stickers_card_inventory(edition_id,sporting_director_id,card_number,quantity,pasted) values($1,$2,70,1,true),($1,$2,71,1,true),($1,$2,72,1,false)",[edition,director]);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${account}',false);`);
  await rejects(()=>rpc("claim_current_cyclo_stickers_achievement",[edition,"profile-breakaway"]),/pas encore terminé/,"two genuineBaroudeurs do not complete the three-rider chapter");
  await rpc("paste_current_cyclo_stickers_card",[edition,72]);
  eq((await rpc("claim_current_cyclo_stickers_achievement",[edition,"profile-breakaway"])).alreadyClaimed,false,"allthree genuineBaroudeurs unlock the chapter normally");
  eq((await rpc("claim_current_cyclo_stickers_achievement",[edition,"profile-breakaway"])).alreadyClaimed,true,"Baroudeurs chapter reward is paid only once");
  await admin();eq(await scalar("select count(*)::int from cyclo_stickers_achievement_claims where achievement_id='profile-breakaway'"),1,"one durable true-Baroudeurs chapter claim");
  eq(await scalar("select count(*)::int from reward_events where sporting_director_id=$1",[director]),2,"only two genuine completed chapters were paid");
  eq(await scalar("select cash_balance::int from team_seasons where id=$1",[id(9600)]),30000,"chapter cash amounts stay15000 each and cannot replay");
  eq(await rows("select experience_points,reputation_points::int from sporting_directors where id=$1",[director]),[{experience_points:200,reputation_points:10}],"both chapter XP/reputation amounts remain unchanged");
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${account}',false);`);
  eq((await rpc("claim_current_cyclo_stickers_achievement",[edition,"count-50"])).alreadyClaimed,false,"72 pastedstickers award the final reward");
  eq((await rpc("claim_current_cyclo_stickers_achievement",[edition,"count-50"])).alreadyClaimed,true,"72-sticker finalreward is paidonce");
  await admin();eq(await scalar("select count(*)::int from sporting_director_trophies where trophy_key='cyclo_stickers_s4'"),1,"S4 trophy key staysunchanged");
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${account}',false);`);eq((await rows("select * from get_current_game_header_indicators_v4()"))[0].collector_album_available,true,"existing header request now reports available final album");
  await admin();await db.exec("update cyclo_stickers_editions set configuration=jsonb_set(configuration,'{enabled}','false')");await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${account}',false);`);
  eq((await rows("select * from get_current_game_header_indicators_v4()"))[0].collector_album_available,false,"header respects the edition kill switch after publication");
  await admin();await db.exec("set role anon");await rejects(()=>rows("select * from get_current_game_header_indicators_v4()"),/permission denied/,"anonymous indicator access remains denied");
  console.log(JSON.stringify({isolatedPublicationChecks:checks,productionAccess:false,postRolloverOnly:true,cachedFacts:true,atomicPublication:true,headerExtraRequests:0}));
}finally{await db.close();}
}
main().catch(error=>{console.error(error instanceof Error?`${error.name}: ${error.message.slice(0,2000)}`:"Publication validation failed");process.exitCode=1;});
