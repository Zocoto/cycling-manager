// Isolated PostgreSQL/WASM. No credentials, network, player fixtures or live DB.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const modulePath=process.env.SECONDARY_NAME_SQL_TEST_MODULE??process.argv[2];
assert(modulePath,'Pass a local PGlite module path');
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration='supabase/migrations/20261106193000_remove_secondary_sponsor_country_suffixes.sql';
const read=file=>readFileSync(file,'utf8').replaceAll('\r\n','\n');
const source=read('supabase/migrations/20260927230000_add_s4_main_and_secondary_sponsors.sql');
const brands=['Novara','Altis','Meridian','Vektor','Luma','Orbis','Summit','Ardent','TerraNova','Pulse'];
let checks=0,scenarios=0,currentCase='bootstrap';
const check=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await rows(sql,args))[0])[0];
const scenario=async(name,body)=>{
  currentCase=name;scenarios++;await db.exec('begin');
  try{await body();}finally{await db.exec('rollback');}
};
const tableSnapshot=table=>rows(`select to_jsonb(t) row from public.${table} t order by id`);
const names=()=>rows('select id,display_name,short_name from public.team_seasons order by id');
const insertCatalog=(n,country,slot,name,key)=>db.query(`insert into public.secondary_sponsor_catalog(
  id,country_id,slot_number,catalog_key,name,prestige,primary_color,accent_color,logo_variant)
  values($1,$2,$3,$4,$5,3,'#123456','#ABCDEF','wordmark')`,[id(n),id(country),slot,key,name]);
async function team(n,{name,short=name,status='active',season=10,sponsor=101,contractStatus='active'}={}){
  await db.query('insert into public.teams(id) values($1)',[id(n)]);
  await db.query('insert into public.team_seasons(id,team_id,season_id,display_name,short_name,status) values($1,$2,$3,$4,$5,$6)',[id(n+1000),id(n),id(season),name,short,status]);
  await db.query('insert into public.secondary_sponsor_offers values($1,$2,$3,$4,$5)',[id(n+2000),id(sponsor),id(n),id(season),'accepted']);
  await db.query('insert into public.secondary_sponsor_contracts(id,offer_id,team_id,season_id,secondary_sponsor_id,status) values($1,$2,$3,$4,$5,$6)',[id(n+3000),id(n+2000),id(n),id(season),id(sponsor),contractStatus]);
  await db.query('insert into public.secondary_sponsor_objectives values($1,$2,$3,null,12000)',[id(n+4000),id(n+2000),contractStatus==='planned'?'draft':'active']);
  await db.query('insert into public.team_finance_transactions values($1,$2,8500,$3)',[id(n+5000),id(n+1000),'Sponsor objective payment']);
}

try{
  await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
    create table public.countries(id uuid primary key,name text,iso_alpha2 text unique);
    create table public.seasons(id uuid primary key,game_year integer,status text);
    create table public.teams(id uuid primary key);
    create table public.team_seasons(id uuid primary key,team_id uuid,season_id uuid,display_name text,short_name text,status text,unique(season_id,display_name));
    create table public.secondary_sponsor_offers(id uuid primary key,secondary_sponsor_id uuid,team_id uuid,target_season_id uuid,status text);
    create table public.secondary_sponsor_contracts(id uuid primary key,offer_id uuid,team_id uuid,season_id uuid,secondary_sponsor_id uuid,status text,activated_at timestamptz,completed_at timestamptz);
    create table public.secondary_sponsor_objectives(id uuid primary key,offer_id uuid,status text,settled_at timestamptz,cash_reward numeric);
    create table public.team_finance_transactions(id uuid primary key,team_season_id uuid,amount numeric,description text);`);
  const catalogStart=source.indexOf('create table public.secondary_sponsor_catalog (');
  const catalogEnd=source.indexOf('\n);',catalogStart);
  assert(catalogStart>0&&catalogEnd>catalogStart);
  await db.exec(source.slice(catalogStart,catalogEnd+3));
  const transitionStart=source.indexOf('create or replace function private.apply_secondary_sponsor_team_season_transition()');
  const transitionEnd=source.indexOf('create or replace function private.evaluate_secondary_sponsor_objectives_after_race()',transitionStart);
  assert(transitionStart>0&&transitionEnd>transitionStart);
  await db.exec(source.slice(transitionStart,transitionEnd));
  await db.query("insert into public.countries values($1,'France','FR'),($2,'United States','US'),($3,'Germany','DE'),($4,'Canada','CA'),($5,'United Kingdom','GB')",[id(1),id(2),id(3),id(4),id(5)]);
  await db.query("insert into public.seasons values($1,5,'active'),($2,6,'planned'),($3,4,'completed')",[id(10),id(11),id(12)]);
  for(const [country,code,offset]of [[1,'FR',100],[2,'US',200]]){
    for(let index=0;index<brands.length;index++)await insertCatalog(offset+index+1,country,index+1,brands[index]+' '+code,`secondary-${code.toLowerCase()}-${index+1}`);
  }
  await insertCatalog(301,3,1,'US Steel','secondary-de-1');
  await insertCatalog(402,4,2,'Altis CA','custom-ca-altis');
  await insertCatalog(501,5,1,'London GB','secondary-gb-1');
  await team(20,{name:'Atelier FR - Novara FR',short:'Atelier-Novara FR'});
  await team(21,{name:'Planned Primary - Altis FR',short:'Primary-Altis FR',status:'planned',season:11,sponsor:102,contractStatus:'planned'});
  await team(22,{name:'Historical - Novara FR',short:'Historical-Novara FR',status:'completed',season:12,contractStatus:'completed'});
  await team(23,{name:'A custom team FR',short:'Custom FR'});
  const partialPrefix='P'.repeat(21),fullPrefix='Q'.repeat(20),longPrefix='R'.repeat(23);
  await team(24,{name:'Partial - Novara FR',short:(partialPrefix+'-Novara FR').slice(0,30)});
  await team(25,{name:'Full - Novara FR',short:(fullPrefix+'-Novara FR').slice(0,30)});
  await team(26,{name:'No country visible - Novara FR',short:(longPrefix+'-Novara FR').slice(0,30)});
  await team(27,{name:'Custom short - Novara FR',short:'Custom FR'});
  await team(28,{name:'Unrelated partial - Novara FR',short:'X'.repeat(29)+'F'});
  await team(29,{name:'To activate',short:'Activate',status:'planned',season:11,contractStatus:'planned'});
  await team(30,{name:'Terminated contract - Novara FR',short:'Terminated-Novara FR',contractStatus:'terminated'});
  await team(31,{name:'Archived season - Novara FR',short:'Archive-Novara FR',season:12});
  await team(32,{name:'Completed team - Novara FR',short:'Complete-Novara FR',status:'completed'});
  const beforeCollision={catalog:await rows('select * from public.secondary_sponsor_catalog order by id'),teams:await names()};
  await scenario('a collision obeys the real unique team identity constraint and rolls back atomically',async()=>{
    await team(80,{name:'Same Primary - Novara FR',short:'Same-Novara FR'});
    await team(81,{name:'Same Primary - Novara US',short:'Same-Novara US',sponsor:201});
    await assert.rejects(()=>db.exec(read(migration)),error=>error.code==='23505');checks++;
  });
  check(await rows('select * from public.secondary_sponsor_catalog order by id'),beforeCollision.catalog,'A collision cannot leave a partially renamed catalogue');
  check(await names(),beforeCollision.teams,'A collision cannot leave partially renamed teams');
  const preservedTables=['secondary_sponsor_offers','secondary_sponsor_contracts','secondary_sponsor_objectives','team_finance_transactions'];
  const preservedBefore=Object.fromEntries(await Promise.all(preservedTables.map(async table=>[table,await tableSnapshot(table)])));
  const catalogBefore=await rows('select * from public.secondary_sponsor_catalog order by id');
  const triggerBefore=await scalar("select pg_get_functiondef('private.apply_secondary_sponsor_team_season_transition()'::regprocedure)");
  await db.exec(read(migration));
  currentCase='reviewed migration';scenarios++;
  for(const table of preservedTables)check(await tableSnapshot(table),preservedBefore[table],`${table} is unchanged by naming cleanup`);
  check(await scalar("select pg_get_functiondef('private.apply_secondary_sponsor_team_season_transition()'::regprocedure)"),triggerBefore,'The existing activation logic is preserved');
  check(await scalar("select has_function_privilege('authenticated','private.normalize_secondary_sponsor_brand_name()','execute')"),false,'Players cannot call the normalization helper directly');
  check(await scalar("select has_function_privilege('anon','private.normalize_secondary_sponsor_brand_name()','execute')"),false,'Anonymous callers cannot call the helper');
  const catalogAfter=await rows('select * from public.secondary_sponsor_catalog order by id');
  for(let index=0;index<catalogBefore.length;index++){
    const previous=catalogBefore[index],next=catalogAfter[index];
    const generated=(previous.country_id===id(1)||previous.country_id===id(2));
    check(next,{...previous,name:generated?brands[previous.slot_number-1]:previous.name},'Only generated country suffixes are removed');
  }
  const byTeam=new Map((await names()).map(row=>[row.id,row]));
  const expectTeam=(n,name,short)=>check(byTeam.get(id(n+1000)),{id:id(n+1000),display_name:name,short_name:short});
  expectTeam(20,'Atelier FR - Novara','Atelier-Novara');
  expectTeam(21,'Planned Primary - Altis','Primary-Altis');
  expectTeam(22,'Historical - Novara FR','Historical-Novara FR');
  expectTeam(23,'A custom team FR','Custom FR');
  expectTeam(24,'Partial - Novara',partialPrefix+'-Novara');
  expectTeam(25,'Full - Novara',fullPrefix+'-Novara');
  expectTeam(26,'No country visible - Novara',longPrefix+'-Novara');
  expectTeam(27,'Custom short - Novara','Custom FR');
  expectTeam(28,'Unrelated partial - Novara','X'.repeat(29)+'F');
  expectTeam(29,'To activate','Activate');
  expectTeam(30,'Terminated contract - Novara FR','Terminated-Novara FR');
  expectTeam(31,'Archived season - Novara FR','Archive-Novara FR');
  expectTeam(32,'Completed team - Novara FR','Complete-Novara FR');

  await scenario('future catalogue inserts normalize only the generated sponsor identity',async()=>{
    await insertCatalog(503,5,3,'Meridian GB','secondary-gb-3');
    check(await scalar('select name from public.secondary_sponsor_catalog where id=$1',[id(503)]),'Meridian');
    await insertCatalog(504,5,4,'Vektor GB','custom-gb-4');
    check(await scalar('select name from public.secondary_sponsor_catalog where id=$1',[id(504)]),'Vektor GB','Custom catalog identities keep meaningful acronyms');
    await insertCatalog(505,5,5,'Luma FR','secondary-gb-5');
    check(await scalar('select name from public.secondary_sponsor_catalog where id=$1',[id(505)]),'Luma FR','A different country suffix is not stripped blindly');
  });
  await scenario('replayed old seed updates cannot restore the abbreviation',async()=>{
    await db.query('update public.secondary_sponsor_catalog set name=$1 where id=$2',['Novara FR',id(101)]);
    check(await scalar('select name from public.secondary_sponsor_catalog where id=$1',[id(101)]),'Novara');
    await db.query('update public.secondary_sponsor_catalog set name=$1 where id=$2',['Pulse US',id(210)]);
    check(await scalar('select name from public.secondary_sponsor_catalog where id=$1',[id(210)]),'Pulse');
  });
  await scenario('legitimate custom brands remain untouched on future writes',async()=>{
    await db.query('update public.secondary_sponsor_catalog set name=$1 where id=$2',['London GB',id(501)]);
    check(await scalar('select name from public.secondary_sponsor_catalog where id=$1',[id(501)]),'London GB');
    await db.query('update public.secondary_sponsor_catalog set name=$1 where id=$2',['US Steel',id(301)]);
    check(await scalar('select name from public.secondary_sponsor_catalog where id=$1',[id(301)]),'US Steel');
  });
  await scenario('a future activation uses the plain brand through the original transition trigger',async()=>{
    await db.query("update public.team_seasons set status='active' where id=$1",[id(1029)]);
    check((await rows('select display_name,short_name from public.team_seasons where id=$1',[id(1029)]))[0],{display_name:'To activate - Novara',short_name:'Activate-Novara'});
    check(await scalar('select status from public.secondary_sponsor_contracts where id=$1',[id(3029)]),'active');
    check(await scalar('select status from public.secondary_sponsor_objectives where id=$1',[id(4029)]),'active');
    check(await scalar('select count(*)::integer from public.secondary_sponsor_contracts where team_id=$1',[id(29)]),1);
    await db.query("update public.team_seasons set status='active' where id=$1",[id(1029)]);
    check(await scalar('select display_name from public.team_seasons where id=$1',[id(1029)]),'To activate - Novara','Repeated active status does not append the brand twice');
    check(await tableSnapshot('team_finance_transactions'),preservedBefore.team_finance_transactions,'Brand activation creates no financial side effect');
  });
  await scenario('renaming an already active team does not reactivate its sponsor',async()=>{
    const before=await tableSnapshot('secondary_sponsor_contracts');
    await db.query("update public.team_seasons set display_name='Another custom name FR' where id=$1",[id(1020)]);
    check(await tableSnapshot('secondary_sponsor_contracts'),before);
    check(await scalar('select display_name from public.team_seasons where id=$1',[id(1020)]),'Another custom name FR');
  });
  console.log(JSON.stringify({ok:true,checks,scenarios,isolated:true,productionFixtures:0,migration:'20261106193000'}));
}catch(error){console.error(JSON.stringify({ok:false,currentCase,checks,scenarios,error:error.message,where:error.where}));process.exitCode=1;}
finally{await db.close();}
