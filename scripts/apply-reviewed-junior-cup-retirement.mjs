// Apply only the reviewed retirement migration, never integration fixtures.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261015160000';
const file=`supabase/migrations/${version}_retire_junior_nations_cup.sql`;
if(process.argv.length!==3 || process.argv[2]!=='--apply-reviewed-fix' ||
 readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw new Error('Exact reviewed flag/project required');
const call=(args,timeout=15000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:300000});
const query=sql=>{const raw=call(['db','query','--linked',sql,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=sql=>`begin read only;set local application_name='junior-cup-retirement-delivery-20261015';set local statement_timeout='5s';set local lock_timeout='1s';${sql};rollback;`;
const initial=query(ro(`select 1 database_ok,to_regclass('public.junior_nations_cup_retirement_audits') is not null installed,
 exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded`))[0];
if(initial.recorded&&!initial.installed) throw new Error('History/schema mismatch; inspect before retrying');
const names=['ensure_federation_junior_championship_calendar','sync_national_federation_junior_lineup','ensure_automatic_federation_junior_lineups',
 'respond_to_national_federation_preselection','get_national_federation_selection_target'];
const definitions=()=>query(ro(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (${names.map(n=>`'${n}'`).join(',')})`));
const expected=JSON.parse(readFileSync('.tmp-international-events/functions.json','utf8'));
if(!initial.installed){
 const before=definitions();
 if(before.length!==names.length || before.some(row=>expected.find(e=>e.signature===row.signature)?.definition!==row.definition)) throw new Error('Function drift since isolated tests: review required');
 call(['db','query','--linked','--file',file,'--output','json'],30000);
 console.log('Reviewed retirement committed; no fixtures or gameplay decisions submitted.');
}
const after=definitions();
for(const name of names.slice(3)){
 const row=after.find(r=>r.signature.startsWith(name+'('));
 if(row?.definition!==expected.find(e=>e.signature===row?.signature)?.definition) throw new Error(`Unexpected professional selection change: ${name}`);
}
const health=query(ro(`select 1 database_ok,
 public.federation_selection_slot_is_available('nc-junior-road',4) retired_slot_available,
 (select count(*)::int from public.development_race_editions e join public.seasons s on s.id=e.season_id
  where s.status<>'completed' and e.competition_type='nations_cup_junior' and e.status<>'cancelled') active_editions,
 (select count(*)::int from public.national_federation_selection_members m join public.national_federation_selection_lists l on l.id=m.selection_list_id
  join public.seasons s on s.id=l.season_id where s.status<>'completed' and l.slot_key='nc-junior-road' and m.response_status in ('pending','confirmed','draft')) active_members,
 (select count(*)::int from public.national_federation_junior_race_registrations r join public.development_race_editions e on e.id=r.race_edition_id
  join public.seasons s on s.id=e.season_id where s.status<>'completed' and e.competition_type='nations_cup_junior' and r.status='registered') active_registrations,
 (select count(*)::int from public.junior_nations_cup_retirement_audits) before_images`))[0];
if(health.database_ok!==1 || health.retired_slot_available || health.active_editions || health.active_members || health.active_registrations) throw new Error(`Retirement integrity check failed: ${JSON.stringify(health)}`);
if(!initial.recorded) call(['migration','repair',version,'--status','applied','--linked','--yes']);
console.log(JSON.stringify({migration:version,...health,professionalSelectionsPreserved:true}));
