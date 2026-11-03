// Real reviewed migration, synthetic fixtures, disposable in-memory PostgreSQL.
// No connection strings, Supabase calls, production data or gameplay settlement.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2] ?? [
  resolve('artifacts/.tmp-performance-preparations/node_modules/@electric-sql/pglite/dist/index.js'),
  'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js',
].find(existsSync);
if (!modulePath || !/^(?:[A-Za-z]:[\\/]|\/)/.test(modulePath) ||
  !modulePath.replaceAll('\\', '/').endsWith('/@electric-sql/pglite/dist/index.js')) {
  throw Error('Absolute local PGlite module path required; network databases are unsupported.');
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const scalar = async (sql, parameters = []) => Object.values((await db.query(sql, parameters)).rows[0])[0];
const login = n => db.query("select set_config('form_camp_test.user',$1,false)", [n ? id(n) : '']);
const report = (day = null) => scalar('select public.get_current_team_daily_form_camp_report($1)', [day]);

try {
  await db.exec(`
    create schema auth; create schema private;
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('form_camp_test.user',true),'')::uuid$$;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table teams(id uuid primary key,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table seasons(id uuid primary key,name text,status text,current_day_number integer);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,display_name text,status text);
    create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
    create table riders(id uuid primary key,first_name text,last_name text);
    create table rider_form_camps(id uuid primary key,rider_id uuid,team_season_id uuid,season_id uuid,
      camp_type text,start_day_number integer,end_day_number integer,status text,created_at timestamptz,
      completed_at timestamptz,interruption_requested_at timestamptz,interruption_effective_day_number integer);
    create table rider_daily_condition_effects(id uuid primary key,rider_id uuid,season_day_id uuid,
      effect_type text,form_before numeric(5,2),form_after numeric(5,2),form_delta numeric(5,2),applied_at timestamptz,
      unique(rider_id,season_day_id));
    insert into sporting_directors values('${id(1)}','${id(11)}','active'),('${id(2)}','${id(12)}','active');
    insert into teams values('${id(21)}','active'),('${id(22)}','active');
    insert into team_manager_assignments values('${id(1)}','${id(21)}','general_manager','active'),
      ('${id(2)}','${id(22)}','general_manager','active');
    insert into seasons values('${id(31)}','Saison 4','active',4);
    insert into team_seasons values('${id(41)}','${id(21)}','${id(31)}','Team One','active'),
      ('${id(42)}','${id(22)}','${id(31)}','Team Two','active');
    insert into season_days select ('00000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,
      '${id(31)}',n,date '2026-10-08'+n from generate_series(1,28) n;
    insert into riders select ('00000000-0000-4000-8000-'||lpad((200+n)::text,12,'0'))::uuid,
      'Rider',lpad(n::text,2,'0') from generate_series(1,10) n;
    create function public.get_current_dashboard_assistant_summary() returns jsonb
    language sql stable security definer set search_path='' set statement_timeout='3000ms' as $$
      with current_context as (
        select ts.id team_season_id,s.id season_id,s.current_day_number
        from public.sporting_directors d
        join public.team_manager_assignments a on a.sporting_director_id=d.id
        join public.team_seasons ts on ts.team_id=a.team_id
        join public.seasons s on s.id=ts.season_id and s.status='active'
        where d.auth_user_id=auth.uid()
      ) select jsonb_build_object('items',jsonb_build_array('Existing report'),
        'equipmentPartnerSignatureAvailable', (select true)) from current_context;
    $$;
    revoke all on function public.get_current_dashboard_assistant_summary() from public,anon;
    grant execute on function public.get_current_dashboard_assistant_summary() to authenticated;
  `);

  // All fixtures use a known ledger cutoff; cancellation chronology is explicit.
  const addCamp = async (n, rider, type = 'classic', status = 'completed', overrides = {}) => {
    const row = { team: 41, start: 3, end: 3, created: '2026-11-01T00:00:00Z',
      completed: '2026-11-03T00:00:00Z', interruption: null, effective: null, ...overrides };
    await db.query('insert into rider_form_camps values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [id(300+n),id(200+rider),id(row.team),id(31),type,row.start,row.end,status,row.created,
        row.completed,row.interruption,row.effective]);
  };
  const addEffect = (rider, before, after, nominal, type = 'form_camp', day = 3) =>
    db.query('insert into rider_daily_condition_effects values($1,$2,$3,$4,$5,$6,$7,$8)',
      [id(500+rider),id(200+rider),id(100+day),type,before,after,nominal,'2026-11-03T00:00:00Z']);

  await addCamp(1,1); await addEffect(1,95,100,20); // cap: +5, never +20.
  await addCamp(2,2,'premium'); await addEffect(2,100,100,30); // real stage, no room left.
  await addCamp(3,3,'classic','cancelled',{interruption:'2026-11-02T12:00:00Z',effective:4});
  await addEffect(3,80,90,10); // interrupted AFTER this earned day: keep it.
  await addCamp(4,4,'classic','cancelled',{completed:'2026-11-02T00:00:00Z'});
  await addCamp(5,4,'wind_tunnel_preparation'); await addEffect(4,80,80,0); // replacement: not a form stage.
  await addCamp(6,5,'classic','cancelled',{completed:'2026-11-02T00:00:00Z'});
  await addCamp(7,5,'premium'); await addEffect(5,70,90,20); // correct replacement type.
  await addCamp(8,6,'premium','completed',{team:42}); await addEffect(6,50,70,20); // other manager.
  await addCamp(9,7,'premium','active',{start:4,end:4}); await addEffect(7,40,60,20,'form_camp',4); // unfinished day.
  await addCamp(10,8); await addEffect(8,60,62,2,'rest'); // wrong ledger kind.
  await addCamp(11,9); await addCamp(12,9,'premium'); await addEffect(9,60,68,8); // historical overlap: one effect.
  await addCamp(13,10,'reconnaissance'); await addEffect(10,70,70,0); // excluded stage type.

  const migration = readFileSync('supabase/migrations/20261103100000_daily_form_camp_reports.sql','utf8');
  await db.exec(migration);
  await login(11);
  const actual = await report();
  check(actual.teamName,'Team One');
  check(actual.dayNumber,3);
  check(actual.riderCount,5);
  check(actual.totalFormGain,43);
  check(actual.riders.map(row=>row.riderId),[1,2,3,5,9].map(n=>id(200+n)));
  check(actual.riders[0].formDelta,5);
  check(actual.riders[1].formDelta,0);
  check(actual.riders.find(row=>row.riderId===id(205)).campType,'premium');
  check((await report(28)).dayNumber,3);
  check((await report(0)).dayNumber,1);
  check((await report(-999)).riderCount,0);
  const assistant = await scalar('select public.get_current_dashboard_assistant_summary()');
  check(assistant.formCampReport,{dayNumber:3,riderCount:5,totalFormGain:43});
  check(assistant.items,['Existing report']);
  check(assistant.equipmentPartnerSignatureAvailable,true);
  check('riders' in assistant.formCampReport,false);

  await login(12);
  check((await report()).riders.map(row=>row.riderId),[id(206)]);
  check((await report()).totalFormGain,20);
  await login(null); check(await report(),null);
  await login(99); check(await report(),null);
  await login(11);
  await db.exec('set role authenticated');
  check((await report()).riderCount,5); // execute real SECURITY DEFINER under player role.
  await db.exec('reset role');
  check(await scalar("select has_function_privilege('anon','public.get_current_team_daily_form_camp_report(integer)','execute')"),false);
  check(await scalar("select has_function_privilege('service_role','public.get_current_team_daily_form_camp_report(integer)','execute')"),false);
  check(await scalar("select has_function_privilege('authenticated','private.get_team_daily_form_camp_report(uuid,uuid)','execute')"),false);
  check(await scalar("select has_function_privilege('anon','private.get_team_daily_form_camp_report(uuid,uuid)','execute')"),false);
  check(await scalar("select proconfig @> array['statement_timeout=3000ms','search_path=\"\"'] from pg_proc where oid='public.get_current_dashboard_assistant_summary()'::regprocedure"),true);

  await db.exec('update seasons set current_day_number=1');
  check((await report()).riderCount,0);
  check((await report(28)).dayNumber,1);
  check((await scalar('select public.get_current_dashboard_assistant_summary()')).formCampReport,null);
  await db.exec('update seasons set current_day_number=3');
  check((await scalar('select public.get_current_dashboard_assistant_summary()')).formCampReport,null);
  check((await report()).dayNumber,2);
  check((await report()).riderCount,0);

  // Production has accepted decimal form values since migration 20260801150000.
  // Exercise the numeric ledger without weakening the earlier integer cases.
  await db.exec(`update seasons set current_day_number=4;
    insert into riders values('${id(211)}','Decimal','Gain'),('${id(212)}','Decimal','Cap');`);
  await addCamp(14,11,'premium'); await addEffect(11,76.25,87.35,11.10);
  const fractional = await report();
  const fractionalRider = fractional.riders.find(row=>row.riderId===id(211));
  check(fractionalRider.formBefore,76.25);
  check(fractionalRider.formAfter,87.35);
  check(fractionalRider.formDelta,11.1);
  check(fractional.riderCount,6);
  check(fractional.totalFormGain,54.1);
  check((await scalar('select public.get_current_dashboard_assistant_summary()')).formCampReport,
    {dayNumber:3,riderCount:6,totalFormGain:54.1});
  await addCamp(15,12,'premium'); await addEffect(12,97.45,100,11.10);
  const fractionalCapped = await report();
  check(fractionalCapped.riders.find(row=>row.riderId===id(212)).formDelta,2.55);
  check(fractionalCapped.totalFormGain,56.65);
  check((await scalar('select public.get_current_dashboard_assistant_summary()')).formCampReport,
    {dayNumber:3,riderCount:7,totalFormGain:56.65});
  console.log(JSON.stringify({status:'passed',checks,database:'isolated in-memory PGlite',
    migration:'20261103100000',actualCappedGain:5,zeroGainStageRetained:true,
    cancelledReplacementExcluded:true,interruptedEarnedDayRetained:true,
    scopesAndGrantsVerified:true,fractionalLedgerVerified:true,fractionalCappedGain:2.55,
    productionConnections:0}));
} finally {
  await db.close();
}
