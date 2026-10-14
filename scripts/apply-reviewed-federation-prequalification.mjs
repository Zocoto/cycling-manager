// Exact reviewed migration only. Never run fixtures or gameplay RPCs here.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const version='20261014120000', name='allow_federation_drafts_before_qualification';
if (process.argv.length!==3 || process.argv[2]!=='--apply-reviewed-fix'
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
const unchanged=[
  'get_national_federation_selection_target(uuid,uuid,text)',
  'freeze_due_international_nation_qualifications(timestamptz)',
  'publish_national_federation_preselection(text,text)',
  'respond_to_national_federation_preselection(uuid,boolean)',
  'prepare_due_automatic_federation_professional_lineups(timestamptz)',
  'sync_national_federation_championship_lineup(uuid)',
];
const check=`begin read only; set local statement_timeout='4s';
  select (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
    coalesce((select bool_and(coalesce(position(marker in pg_get_functiondef(to_regprocedure(signature)))>0,false))
      from (values
        ('public.get_national_federation_selection_calendar_target(uuid,uuid,text)','federation_draft_qualification_v1'),
        ('public.get_national_federation_preselection_schedule(uuid,uuid)','federation_draft_qualification_v1'),
        ('public.get_national_federation_selection_schedule(uuid,uuid)','federation_draft_qualification_v1'),
        ('public.assert_federation_selection_open(uuid,uuid,text)','federation_draft_qualification_v1'),
        ('public.assert_federation_preselection_editable(uuid,uuid,text)','get_national_federation_preselection_schedule'),
        ('public.save_national_federation_preselection(text,text,uuid[])','assert_federation_preselection_editable')
      ) expected(signature,marker)),false) installed,
    (select jsonb_object_agg(signature,md5(pg_get_functiondef(('public.'||signature)::regprocedure)))
      from unnest(array['${unchanged.join("','")}']) signature) unchanged_hashes;
  commit;`;
const before=query(check).rows[0];
if (before.receipt && before.receipt!==name) throw new Error('Migration version collision: stop.');
if (before.receipt && !before.installed) throw new Error('Receipt disagrees with installed functions: inspect.');
if (!before.receipt) {
  const migrationPath=`supabase/migrations/${version}_${name}.sql`;
  const sql=readFileSync(migrationPath,'utf8');
  if (!/commit;\s*$/i.test(sql)) throw new Error('Reviewed migration must commit atomically.');
  if (!before.installed) query(migrationPath,true);
  const applied=query(check).rows[0];
  if (!applied.installed || JSON.stringify(applied.unchanged_hashes)!==JSON.stringify(before.unchanged_hashes)) {
    throw new Error('Migration or preserved eligibility/publication paths not confirmed; inspect before recording.');
  }
  query(`begin; set local lock_timeout='4s'; set local statement_timeout='8s';
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]) on conflict(version) do nothing; commit;`);
}
const after=query(check).rows[0];
if (after.receipt!==name || !after.installed || JSON.stringify(after.unchanged_hashes)!==JSON.stringify(before.unchanged_hashes)) {
  throw new Error('Final verification failed; inspect before retrying.');
}
console.log(JSON.stringify({version,installed:true,recorded:true,gameplayFunctionsRun:false,qualificationPublicationAndStartlistCodeUnchanged:true}));
