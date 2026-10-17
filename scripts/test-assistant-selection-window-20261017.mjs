// Real migration and reminder payload, synthetic PostgreSQL only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();let checks=0;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
const original=read('20260913120000_add_manual_federation_selection_dashboard_reminder').split('$replacement$')[1];
const fragment=original.slice(0,original.lastIndexOf("'equipmentPartnerSignatureAvailable'"));
const migration=read('20261017092000_skip_irrelevant_assistant_selection_calendars');
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const scalar=async sql=>Object.values((await db.query(sql)).rows[0])[0];
const payload=async(before=false)=>scalar(`select get_current_dashboard_assistant_summary${before?'_before':''}()`);
const calls=()=>scalar('select case when is_called then last_value else 0 end from schedule_calls');
try {
  await db.exec(`create role anon;create role authenticated;create schema private;
    create table test_context(sporting_director_id uuid,team_id uuid,season_id uuid,game_year int);
    create table countries(id uuid,iso_alpha2 text,continent_code text);
    create table national_federation_terms(country_id uuid,president_director_id uuid,governance_mode text,start_game_year int,end_game_year int);
    create table national_federation_selection_preferences(country_id uuid,season_id uuid,automatic_selection boolean);
    create table national_federation_selection_lists(id uuid,country_id uuid,season_id uuid,slot_key text,published_at timestamptz);
    create table national_federation_selection_members(selection_list_id uuid,response_status text);
    create table races(id uuid,competition_type text,championship_continent_code text);
    create table race_editions(id uuid,race_id uuid,season_id uuid,status text);
    create table stages(race_edition_id uuid,departure_at timestamptz,status text);
    create table season_days(season_id uuid,day_number int,calendar_date date);
    create table development_race_editions(season_id uuid,start_day_number int,status text,competition_type text,championship_continent_code text);
    create table fixture_schedule(country_id uuid,season_id uuid,slot_key text,label text,closes_at timestamptz,is_open boolean);
    create sequence schedule_calls;
    create function get_national_federation_selection_schedule(p_country_id uuid,p_season_id uuid)
    returns table(slot_key text,label text,closes_at timestamptz,is_open boolean) language plpgsql as $$begin
      perform nextval('public.schedule_calls');
      return query select f.slot_key,f.label,f.closes_at,f.is_open and now()<f.closes_at
        from public.fixture_schedule f where f.country_id=p_country_id and f.season_id=p_season_id;
    end$$;
    insert into test_context values('${id(1)}','${id(2)}','${id(3)}',4);
    insert into countries values('${id(4)}','RW','AF'),('${id(5)}','FR','EU');
    insert into national_federation_terms values('${id(4)}','${id(1)}','elected',4,4);
    insert into national_federation_selection_preferences values('${id(4)}','${id(3)}',false);
    create function get_current_dashboard_assistant_summary() returns jsonb language sql stable security definer
    set search_path='' set statement_timeout='3000ms' as $$
      with current_context as (
        select * from public.test_context
  ),
  active_contracts as materialized (select 1)
      select jsonb_build_object(${fragment}'untouched',42);
    $$;`);
  const source=await scalar("select pg_get_functiondef('get_current_dashboard_assistant_summary()'::regprocedure)");
  await db.exec(source.replace('FUNCTION public.get_current_dashboard_assistant_summary()', 'FUNCTION public.get_current_dashboard_assistant_summary_before()'));
  await db.exec(migration);
  const same=async(expectedCount,expectedCalls)=>{
    const before=await payload(true),start=Number(await calls()),after=await payload();
    check(after,before);check(after.federationSelectionReminder.count,expectedCount);
    check(Number(await calls())-start,expectedCalls);check(after.untouched,42);
  };
  const pro=async(type,departure,continent='AF',open=true)=>{
    await db.exec(`truncate races,race_editions,stages,development_race_editions,season_days,fixture_schedule,national_federation_selection_lists,national_federation_selection_members;
      insert into races values('${id(10)}','${type}','${continent}');
      insert into race_editions values('${id(11)}','${id(10)}','${id(3)}','planned');
      insert into stages values('${id(11)}',now()+interval '${departure}','planned');
      insert into fixture_schedule values('${id(4)}','${id(3)}','world-pro-road','Road',now()+interval '${departure}'-interval '24 hours',${open});`);
  };
  await same(0,0); // No event: no authoritative schedule work at all.
  await pro('world_championship','5 days');await same(0,0);
  await pro('world_championship','2 days');await same(1,1);
  await pro('continental_championship','2 days');await same(1,1);
  await pro('nations_cup','2 days');await same(1,1); // Olympic road/ITT share this competition type.
  await pro('world_championship','3 days');await same(1,1); // Inclusive reminder start.
  await pro('world_championship','3 days 1 second');await same(0,0);
  await pro('continental_championship','2 days','EU',false);await same(0,0);
  await pro('world_championship','2 days','AF',false);await same(0,1); // Qualification stays authoritative.
  await pro('world_championship','2 days');
  await db.exec(`update national_federation_selection_preferences set automatic_selection=true`);await same(0,0);
  await db.exec(`update national_federation_selection_preferences set automatic_selection=false;update national_federation_terms set president_director_id='${id(99)}'`);await same(0,0);
  await db.exec(`update national_federation_terms set president_director_id='${id(1)}',end_game_year=3`);await same(0,0);
  await db.exec(`update national_federation_terms set end_game_year=4;insert into national_federation_selection_lists values('${id(30)}','${id(4)}','${id(3)}','world-pro-road',now())`);await same(0,1);
  await db.exec(`insert into national_federation_selection_members values('${id(30)}','draft')`);await same(1,1);
  for (const type of ['world_road','world_time_trial','continental_road','continental_time_trial','nations_cup_junior']) {
    await db.exec(`truncate races,race_editions,stages,fixture_schedule,national_federation_selection_lists,national_federation_selection_members,development_race_editions,season_days;
      insert into season_days values('${id(3)}',10,(now() at time zone 'Europe/Paris')::date+1);
      insert into development_race_editions values('${id(3)}',10,'planned','${type}','AF');
      insert into fixture_schedule select '${id(4)}','${id(3)}','junior-road','Juniors',calendar_date::timestamp at time zone 'Europe/Paris',true from season_days;`);
    await same(1,1);
    await db.exec(`update season_days set calendar_date=calendar_date+4;update fixture_schedule set closes_at=closes_at+interval '4 days'`);await same(0,0);
  }
  await db.exec(migration);check((await payload()).untouched,42);
  check(await scalar("select proconfig @> array['search_path=\"\"','statement_timeout=3000ms'] from pg_proc where oid='get_current_dashboard_assistant_summary()'::regprocedure"),true);
  console.log(JSON.stringify({isolated:true,checks,scheduleCallsOutsideWindow:0,allPassed:true}));
} catch(error){console.error(JSON.stringify({error:error.message,where:error.where,checks}));process.exitCode=1;}
finally{await db.close();}
