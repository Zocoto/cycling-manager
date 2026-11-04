// Real reward/finance functions in isolated PostgreSQL. No network or env files.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();let count=0,sequence=0;
const id=()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`;
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
function def(source,name){
  const match=new RegExp(`create (?:or replace )?function public\\.${name}\\(`,'i').exec(source);assert(match,name);
  return source.slice(match.index,source.indexOf('$$;',match.index)+3);
}
try{
  await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
    create table seasons(id uuid primary key,game_year integer);
    create table races(id uuid primary key,competition_type text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid);
    create table season_days(id uuid primary key,season_id uuid,day_number integer);
    create table stages(id uuid primary key,race_edition_id uuid,season_day_id uuid);
    create table riders(id uuid primary key,country_id uuid);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,points integer default 0,cash_balance numeric default 1000);
    create table sporting_directors(id uuid primary key,reputation_points integer default 10,experience_points integer default 20);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table race_registrations(id uuid primary key,race_edition_id uuid,team_season_id uuid,detection_team_number integer);
    create table race_rosters(id uuid primary key,rider_id uuid,race_registration_id uuid);
    create table reward_events(id uuid primary key default gen_random_uuid(),source_reference text unique,source_type text,sporting_director_id uuid,team_season_id uuid,rider_id uuid,country_id uuid,reputation_points integer,experience_points integer,cash_prize numeric,uci_points integer,description text);
    create table rider_season_summaries(rider_id uuid,season_id uuid,victories integer,points integer,updated_at timestamptz,primary key(rider_id,season_id));
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number integer,amount numeric,category text,status text,description text,source_reference text,posted_at timestamptz,unique(team_season_id,source_reference));`);
  await db.exec(def(read('20260904180000_defer_race_reward_ranking_refresh'),'apply_race_roster_competition_reward')
    .replace('public.apply_race_roster_competition_reward(','public.apply_race_roster_competition_reward_before_s3_continental_void('));
  await db.exec(def(read('20260829143000_add_free_agent_detection_teams'),'apply_detection_rider_competition_reward')
    .replace('public.apply_detection_rider_competition_reward(','public.apply_detection_rider_competition_reward_before_s3_continental_('));
  const voidSource=read('20260925143000_void_s3_continental_championship_rewards');
  for(const fn of ['apply_race_roster_competition_reward','apply_detection_rider_competition_reward'])await db.exec(def(voidSource,fn));
  const signatures=[
    'public.apply_race_roster_competition_reward(text,text,uuid,uuid,integer,integer,numeric,integer,boolean,text)',
    'public.apply_detection_rider_competition_reward(text,text,uuid,uuid,integer,boolean,text)',
  ];
  for(const signature of signatures)await db.exec(`revoke all on function ${signature} from public,anon,authenticated;grant execute on function ${signature} to service_role;`);
  const attrs=async()=> (await db.query(`select proname,proacl::text acl,proconfig,prosecdef from pg_proc where oid=any($1::regprocedure[]) order by proname`,[signatures])).rows;
  const before=await attrs();
  const migration=read('20261104120000_prevent_international_uci_points');
  await db.exec(migration);
  for(const year of [1,3,4,5,8])for(const type of ['standard','national_road','world_championship','continental_championship','nations_cup'])for(const free of [false,true]){
    const season=id(),race=id(),edition=id(),day=id(),stage=id(),rider=id(),team=id(),account=id(),director=id(),registration=id(),roster=id();
    await db.query('insert into seasons values($1,$2)',[season,year]);await db.query('insert into races values($1,$2)',[race,type]);
    await db.query('insert into race_editions values($1,$2,$3)',[edition,race,season]);await db.query('insert into season_days values($1,$2,26)',[day,season]);
    await db.query('insert into stages values($1,$2,$3)',[stage,edition,day]);await db.query('insert into riders values($1,$2)',[rider,id()]);
    await db.query('insert into team_seasons(id,team_id,season_id) values($1,$2,$3)',[account,team,season]);await db.query('insert into sporting_directors(id) values($1)',[director]);
    await db.query(`insert into team_manager_assignments values($1,$2,'general_manager','active')`,[team,director]);
    await db.query('insert into race_registrations values($1,$2,$3,$4)',[registration,edition,free?null:account,free?1:null]);await db.query('insert into race_rosters values($1,$2,$3)',[roster,rider,registration]);
    const reference='test:'+roster;
    const invoke=()=>free
      ?db.query(`select apply_detection_rider_competition_reward($1,'race_result',$2,$3,777,true,'Official championship')`,[reference,roster,stage])
      :db.query(`select apply_race_roster_competition_reward($1,'race_result',$2,$3,2,30,100,777,true,'Official championship')`,[reference,roster,stage]);
    await invoke();await invoke();
    const voidAll=year===3&&type==='continental_championship';
    const expectedUci=voidAll||(year>=4&&['world_championship','continental_championship','nations_cup'].includes(type))?0:777;
    const event=(await db.query('select * from reward_events where source_reference=$1',[reference])).rows;
    assert.equal(event.length,1);assert.equal(event[0].uci_points,expectedUci);count+=2;
    const summary=(await db.query('select victories,points from rider_season_summaries where rider_id=$1 and season_id=$2',[rider,season])).rows[0];
    assert.deepEqual(summary,{victories:1,points:expectedUci});count++;
    const balance=(await db.query('select points,cash_balance from team_seasons where id=$1',[account])).rows[0];
    assert.equal(balance.points,free?0:expectedUci);assert.equal(Number(balance.cash_balance),!free&&!voidAll?1100:1000);count+=2;
    const ds=(await db.query('select reputation_points,experience_points from sporting_directors where id=$1',[director])).rows[0];
    assert.deepEqual(ds,{reputation_points:!free&&!voidAll?12:10,experience_points:!free&&!voidAll?50:20});count++;
    assert.equal((await db.query('select count(*)::integer n from team_finance_transactions where team_season_id=$1',[account])).rows[0].n,!free&&!voidAll?1:0);count++;
    if(!free&&year===4&&type==='world_championship'){
      await db.query(`select apply_race_roster_competition_reward($1,'stage_result',$2,$3,0,0,0,900,false,'Championship stage')`,[reference+':stage',roster,stage]);
      assert.equal((await db.query('select uci_points from reward_events where source_reference=$1',[reference+':stage'])).rows[0].uci_points,0);count++;
    }
  }
  assert.deepEqual(await attrs(),before);count++;
  for(const signature of signatures){assert.equal((await db.query(`select has_function_privilege('authenticated',$1,'execute') allowed`,[signature])).rows[0].allowed,false);count++;}
  await db.exec(migration);assert.deepEqual(await attrs(),before);count++;
  console.log(`PASS ${count} isolated SQL assertions: stale UCI inputs blocked, club/free paths, road/TT/stage reward contexts, S4/S5/S8, standard races, historical accounting, cash/XP/reputation, victories, duplicate retries and permissions.`);
}catch(error){console.error('FAIL:',error.message,error.where??'');process.exitCode=1;}
finally{await db.close();}
