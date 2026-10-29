// Local PostgreSQL only, public route fixture, no production connection.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.argv[2])throw Error('Supply the installed PGlite module path');
process.on('uncaughtException',error=>{console.error(error.message,error.where??'',error.query?.slice(0,500)??'');process.exitCode=1;});
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const baseline=JSON.parse(readFileSync('scripts/fixtures/s5-cobbled-profile-baseline.json','utf8'));
const migration=readFileSync('supabase/migrations/20261029140000_refine_s5_cobbled_profiles.sql','utf8');
await db.exec(`create schema private;create role anon;create role authenticated;
 create table seasons(id uuid primary key default gen_random_uuid(),game_year integer,status text);
 create table races(id uuid primary key default gen_random_uuid(),slug text unique,race_format text,competition_type text);
 create table race_editions(id uuid primary key default gen_random_uuid(),season_id uuid references seasons,race_id uuid references races,status text);
 create table stages(id uuid primary key default gen_random_uuid(),race_edition_id uuid references race_editions,stage_number integer,stage_type text,profile_type text,distance_km numeric,status text);
 create table stage_segments(id uuid primary key default gen_random_uuid(),stage_id uuid references stages,segment_number integer,distance_km numeric,terrain_type text,surface_type text,average_gradient_pct numeric,unique(stage_id,segment_number));
 create table stage_segment_primes(stage_segment_id uuid references stage_segments on delete cascade,prime_type text,mountain_category text,points_scale smallint[]);
 create table stage_results(stage_id uuid references stages);
 create table official_stage_simulations(stage_id uuid references stages);
 create table race_registrations(id uuid primary key default gen_random_uuid(),race_edition_id uuid references race_editions);
 create table race_rosters(race_registration_id uuid references race_registrations,rider_id uuid);
 create table race_roster_stage_roles(stage_id uuid references stages,role text);
 create function private.apply_s5_elite_calendar(uuid)returns void language sql as 'select';
 create function public.provision_season_race_calendar(p_source_season_id uuid,p_target_season_id uuid)returns void language plpgsql as $$begin
  perform private.apply_s5_elite_calendar(p_target_season_id);
 end;$$;
 insert into seasons(game_year,status)values(4,'active'),(5,'planned'),(6,'planned');`);
const season=async y=>(await db.query('select id from seasons where game_year=$1',[y])).rows[0].id;
const s4=await season(4),s5=await season(5),s6=await season(6);
const races=new Map();
for(const fixture of baseline){
 let race=races.get(fixture.slug);
 if(!race){race=(await db.query('insert into races(slug,race_format,competition_type)values($1,$2,$3)returning id',[fixture.slug,fixture.format,fixture.competition])).rows[0].id;races.set(fixture.slug,race);}
 for(const seasonId of [s4,s5]){
  let ed=(await db.query('select id from race_editions where race_id=$1 and season_id=$2',[race,seasonId])).rows[0]?.id;
  if(!ed)ed=(await db.query("insert into race_editions(race_id,season_id,status)values($1,$2,'registration_open')returning id",[race,seasonId])).rows[0].id;
  const stage=(await db.query("insert into stages(race_edition_id,stage_number,stage_type,profile_type,distance_km,status)values($1,$2,$3,'cobbles',$4,'planned')returning id",[ed,fixture.stage,fixture.type,fixture.distance])).rows[0].id;
  for(const [i,x]of fixture.segments.entries())await db.query('insert into stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)values($1,$2,$3,$4,$5,$6)',[stage,i+1,...x]);
  if(fixture.format==='stage_race')await db.query("insert into stage_segment_primes select id,'intermediate_sprint',null,array[20,17,15]::smallint[] from stage_segments where stage_id=$1 order by segment_number limit 1",[stage]);
  const reg=(await db.query('insert into race_registrations(race_edition_id)values($1)returning id',[ed])).rows[0].id;
  await db.query("insert into race_rosters values($1,gen_random_uuid())",[reg]);
  await db.query("insert into race_roster_stage_roles values($1,'leader')",[stage]);
 }
}
const dump=async sql=>JSON.stringify((await db.query(sql)).rows);
const stageQuery=`select t.id,t.stage_number,t.stage_type,t.profile_type,t.distance_km,t.status,t.race_edition_id from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by t.id`;
const s4Stages=await dump(stageQuery);
const s4Segments=await dump(`select x.* from stage_segments x join stages t on t.id=x.stage_id join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by x.id`);
const allIds=await dump('select id from stages order by id');
const entries=await dump('select * from race_registrations order by id');
const rosters=await dump('select * from race_rosters order by race_registration_id');
const roles=await dump('select * from race_roster_stage_roles order by stage_id');
const excludedQuery=`select x.* from stage_segments x join stages t on t.id=x.stage_id join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id where e.season_id='${s5}' and(r.competition_type<>'standard' or t.stage_type<>'road')order by x.id`;
const excluded=await dump(excludedQuery);
await db.exec(migration);
assert.equal(await dump(stageQuery),s4Stages);
assert.equal(await dump(`select x.* from stage_segments x join stages t on t.id=x.stage_id join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by x.id`),s4Segments);
assert.equal(await dump('select id from stages order by id'),allIds);
assert.equal(await dump('select * from race_registrations order by id'),entries);
assert.equal(await dump('select * from race_rosters order by race_registration_id'),rosters);
assert.equal(await dump('select * from race_roster_stage_roles order by stage_id'),roles);
assert.equal(await dump(excludedQuery),excluded);
const variants=(await db.query(`select profile_variant,count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id where e.season_id=$1 group by profile_variant order by profile_variant`,[s5])).rows;
assert.equal(variants.find(v=>v.profile_variant==='selective_cobbles').n,14);
assert.equal(variants.find(v=>v.profile_variant==='sprint_cobbles').n,7);
assert.equal((await db.query(`select count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id where e.season_id=$1 and t.distance_km<>(select sum(x.distance_km)from stage_segments x where x.stage_id=t.id)`,[s5])).rows[0].n,0);
const stable=await dump('select * from stage_segments order by id');
const primes=await dump('select * from stage_segment_primes order by stage_segment_id');
await db.exec(migration);
assert.equal(await dump('select * from stage_segments order by id'),stable,'reapplication preserves sector IDs');
assert.equal(await dump('select * from stage_segment_primes order by stage_segment_id'),primes);
const definitions=(await db.query("select pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure) definition")).rows[0].definition;
assert.equal((definitions.match(/perform private.apply_s5_cobbled_profiles/g)??[]).length,1);
assert.ok(definitions.indexOf('remove_obsolete_cloned_stage_segments')<definitions.indexOf('apply_s5_cobbled_profiles'));
// Future clones: preserve copied sources and prune only the obsolete suffix.
const source=(await db.query(`select t.id,e.race_id from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id where e.season_id=$1 and r.slug='clasica-empedrada-de-trinidad'`,[s5])).rows[0];
const futureEd=(await db.query("insert into race_editions(season_id,race_id,status)values($1,$2,'registration_open')returning id",[s6,source.race_id])).rows[0].id;
const future=(await db.query("insert into stages(race_edition_id,stage_number,stage_type,profile_type,distance_km,status)values($1,1,'road','cobbles',188,'planned')returning id",[futureEd])).rows[0].id;
await db.query('insert into stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)select $1,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct from stage_segments where stage_id=$2',[future,source.id]);
await db.query("insert into stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)values($1,99,10,'flat','asphalt',0)",[future]);
await db.query('select public.provision_season_race_calendar($1,$2)',[s5,s6]);
assert.equal((await db.query('select sum(distance_km)::float8 km from stage_segments where stage_id=$1',[future])).rows[0].km,188);
assert.equal((await db.query('select profile_variant from stages where id=$1',[future])).rows[0].profile_variant,'sprint_cobbles');
const protectedStage=(await db.query(`select t.id from stages t join race_editions e on e.id=t.race_edition_id where e.season_id=$1 and profile_variant='selective_cobbles' limit 1`,[s5])).rows[0].id;
await db.query('insert into official_stage_simulations values($1)',[protectedStage]);
const frozen=await dump('select * from stage_segments order by id');
await assert.rejects(()=>db.query('select private.apply_s5_cobbled_profiles($1)',[s5]),/frozen/);
assert.equal(await dump('select * from stage_segments order by id'),frozen);
await db.query('select private.apply_s5_cobbled_profiles($1)',[s4]);
assert.equal(await dump(stageQuery),s4Stages);
const output=(await db.query(`select r.slug,t.stage_number,t.stage_type,t.profile_type,t.profile_variant,t.distance_km,
 jsonb_agg(jsonb_build_array(x.distance_km,x.terrain_type,x.surface_type,x.average_gradient_pct)order by x.segment_number)segments
 from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id join stage_segments x on x.stage_id=t.id where e.season_id=$1 group by r.slug,t.id order by r.slug,t.stage_number`,[s5])).rows;
writeFileSync('.codex-tools/s5-cobbles-refined-routes.json',JSON.stringify(output));
await db.close();
console.log(JSON.stringify({isolatedPostgres:'passed',harderRoutes:14,sprintCobbles:7,s4Unchanged:true,entriesAndPreparationPreserved:true,internationalAndTimeTrialUntouched:true,idempotent:true,futureClonePruned:true,frozenRaceRefused:true,productionAccess:false}));
