// Install only this reviewed function patch. No gameplay calls or player updates.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const version='20261014153000',name='age_scouting_candidates_across_seasons';
if(process.argv.length!==3 || process.argv[2]!=='--apply-reviewed-fix'
  || readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') {
  throw new Error('Exact reviewed-fix flag and expected linked project are required.');
}
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(value,file=false) {
  const raw=execFileSync(binary,['db','query','--linked',...(file?['--file',value]:[value]),'--output','json'],
    {encoding:'utf8',maxBuffer:100000,timeout:120000});
  return JSON.parse(raw.slice(raw.indexOf('{')));
}
const check=`begin read only; set local statement_timeout='4s';
  select (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
    position('scouting_candidate_age_v1' in definition)>0
      and position('v_candidate.age + v_context.game_year - v_candidate.report_game_year > 18' in definition)>0
      and position('v_candidate.report_game_year - v_candidate.age' in definition)>0
      and position('v_context.game_year - v_candidate.age' in definition)=0 as installed,
    (select proacl::text from pg_proc where oid='public.sign_current_team_youth_candidate(uuid)'::regprocedure) permissions,
    (select jsonb_object_agg(signature,md5(pg_get_functiondef(signature::regprocedure))) from unnest(array[
      'public.settle_current_team_finances()',
      'public.mark_current_team_scouting_report_viewed(uuid)',
      'public.resolve_fully_recruited_youth_scouting_report()'
    ]) signature) unchanged_hashes
    from (select pg_get_functiondef('public.sign_current_team_youth_candidate(uuid)'::regprocedure) definition) f;
  commit;`;
const before=query(check).rows[0];
if(before.receipt && before.receipt!==name) throw new Error('Migration version collision: stop.');
if(before.receipt && !before.installed) throw new Error('Receipt disagrees with live function: inspect.');
const unchanged=state=>state.permissions===before.permissions && JSON.stringify(state.unchanged_hashes)===JSON.stringify(before.unchanged_hashes);
if(!before.receipt) {
  const migrationPath=`supabase/migrations/${version}_${name}.sql`;
  const sql=readFileSync(migrationPath,'utf8');
  if(!/commit;\s*$/i.test(sql)) throw new Error('Migration must commit atomically.');
  if(!before.installed) query(migrationPath,true);
  const applied=query(check).rows[0];
  if(!applied.installed || !unchanged(applied)) throw new Error('Unexpected function or permissions after migration: inspect before recording.');
  query(`begin; set local lock_timeout='4s'; set local statement_timeout='8s';
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]) on conflict(version) do nothing; commit;`);
}
const after=query(check).rows[0];
if(after.receipt!==name || !after.installed || !unchanged(after)) throw new Error('Final verification failed: inspect before retrying.');
console.log(JSON.stringify({version,installed:true,recorded:true,gameplayFunctionsRun:false,permissionsFinancesAndArchivingPreserved:true}));
