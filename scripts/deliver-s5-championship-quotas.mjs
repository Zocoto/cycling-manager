// Only the reviewed migration may write to production. No fixtures/gameplay RPCs.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const mode=process.argv[2];
if (!['--preflight','--apply-reviewed-migration','--verify'].includes(mode) || process.argv.length!==3
  || readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw new Error('Exact mode and linked project required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261026160000', name='s5_international_championship_quotas';
const file=`supabase/migrations/${version}_${name}.sql`;
const call=args=>execFileSync(binary,args,{encoding:'utf8',timeout:30000,maxBuffer:100000});
const query=sql=>{const raw=call(['db','query','--linked',sql,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=sql=>`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='s5-championship-quotas-delivery';${sql};commit;`;
const preserved=[
  'save_national_federation_preselection(text,text,uuid[])',
  'publish_national_federation_preselection(text,text)',
  'sync_national_federation_championship_lineup(uuid)',
  'prepare_due_automatic_federation_professional_lineups(timestamptz)',
  'refill_national_federation_professional_selection(uuid,timestamptz)',
  'get_national_federation_selection_target(uuid,uuid,text)',
  'get_national_federation_preselection_schedule(uuid,uuid)',
  'get_federation_callup_ineligibility_reason(uuid,timestamptz)',
];
const functionHashes=()=>query(ro(`select signature,md5(pg_get_functiondef(('public.'||signature)::regprocedure)) hash
  from unnest(array['${preserved.join("','")}'])signature order by signature`));
const state=()=>query(ro(`select s.game_year,
  (select md5(string_agg(q.competition_code||q.country_id::text||q.qualification_rank||q.is_qualified::text||q.qualification_score||q.captured_at::text,',' order by q.competition_code,q.country_id)) from public.international_nation_qualification_snapshots q where q.season_id=s.id) qualifications,
  (select md5(string_agg(e.id::text||e.field_limit::text,',' order by e.id)) from public.race_editions e join public.races r on r.id=e.race_id where e.season_id=s.id and r.competition_type in('world_championship','continental_championship')) capacities,
  (select md5(string_agg(l.id::text||l.status||l.revision||coalesce(l.published_at::text,''),',' order by l.id)) from public.national_federation_selection_lists l where l.season_id=s.id and l.slot_key in('cc-pro-road','cc-pro-itt','world-pro-road','world-pro-itt')) lists,
  (select md5(string_agg(m.id::text||m.response_status||coalesce(m.responded_at::text,''),',' order by m.id)) from public.national_federation_selection_members m join public.national_federation_selection_lists l on l.id=m.selection_list_id where l.season_id=s.id and l.slot_key in('cc-pro-road','cc-pro-itt','world-pro-road','world-pro-itt')) members
  from public.seasons s where s.status='active' limit 1`))[0];
const installed=()=>query(ro(`select
  (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
  to_regprocedure('public.get_national_federation_preselection_schedule_v2(uuid,uuid)') is not null rpc,
  coalesce(position('s5_championship_quotas' in pg_get_functiondef('public.respond_to_national_federation_preselection(uuid,boolean)'::regprocedure))>0,false) guard,
  position('then 60 else 30' in pg_get_functiondef('public.freeze_due_international_nation_qualifications(timestamptz)'::regprocedure))>0 freeze`))[0];
const before=state(), hashes=functionHashes(), initial=installed();
if (mode==='--preflight') {
  console.log(JSON.stringify({databaseOk:true,gameYear:before.game_year,installed:initial,unchangedPaths:hashes.length}));
} else {
  if (initial.receipt && initial.receipt!==name) throw new Error('Migration version collision.');
  if (mode==='--apply-reviewed-migration' && !initial.receipt) {
    if (before.game_year!==4) throw new Error('Expected S4 before preparing S5: review current season first.');
    if (!(initial.rpc && initial.guard && initial.freeze)) call(['db','query','--linked','--file',file,'--output','json']);
    if (JSON.stringify(state())!==JSON.stringify(before)) throw new Error('Current-season state changed during delivery; inspect before proceeding.');
    if (JSON.stringify(functionHashes())!==JSON.stringify(hashes)) throw new Error('A preserved selection path changed; inspect before proceeding.');
    const applied=installed();
    if (!applied.rpc || !applied.guard || !applied.freeze) throw new Error('Migration installation was not verified.');
    const sql=readFileSync(file,'utf8');
    query(`begin;set local lock_timeout='3s';set local statement_timeout='8s';insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]) on conflict(version) do nothing;commit;`);
  }
  const final=installed();
  if (final.receipt!==name || !final.rpc || !final.guard || !final.freeze) throw new Error('Final migration verification failed.');
  console.log(JSON.stringify({databaseOk:true,installed:true,recorded:true,effectiveFromSeason:5,currentSeasonPreserved:JSON.stringify(state())===JSON.stringify(before),selectionPathsPreserved:JSON.stringify(functionHashes())===JSON.stringify(hashes),gameplayFunctionsRun:false}));
}
