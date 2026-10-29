// Exact reviewed migration only. No player actions or provider calls.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const mode=process.argv[2];
if(process.argv.length!==3 || !['--preflight','--apply-reviewed-migration','--verify'].includes(mode) ||
  readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw Error('Exact mode and linked project required');
const require=createRequire(import.meta.url);
const bin=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261029120000', name='add_gazette_comment_translations';
const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const query=text=>{
  const raw=execFileSync(bin,['db','query','--linked',text,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:120000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const ro=text=>query(`begin read only;set local application_name='gazette-translation-delivery';set local statement_timeout='5s';set local lock_timeout='500ms';${text};commit;`);
const preserved=()=>ro(`select
  md5(pg_get_functiondef('public.claim_global_chat_translation_batch(uuid,text,jsonb)'::regprocedure)) chat_claim,
  md5(pg_get_functiondef('public.complete_global_chat_translation_batch(uuid,jsonb,boolean)'::regprocedure)) chat_completion,
  (select md5(coalesce(string_agg(policyname||qual||coalesce(with_check,''),',' order by policyname),'')) from pg_policies where schemaname='public' and tablename='cyclogazette_editions') edition_policies`)[0];
const receipt=ro(`select name from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0]?.name;
if(receipt && receipt!==name) throw Error('Migration version collision');
const before=preserved();
if(mode==='--preflight') {
  const schema=ro(`select to_regclass('public.gazette_comment_translations')::text cache,
    to_regprocedure('public.claim_gazette_comment_translation_batch(uuid,text,jsonb)')::text claim`)[0];
  console.log(JSON.stringify({databaseRead:'ok',alreadyInstalled:!!receipt,schema,preserved:before}));
} else {
  if(mode==='--apply-reviewed-migration'&&!receipt){
    const receiptSql=`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);commit;`;
    const file='.codex-tools/gazette-comment-translations-reviewed-delivery.sql';
    writeFileSync(file,sql.replace(/commit;\s*$/i,()=>receiptSql));
    execFileSync(bin,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:120000});
  }
  assert.equal(ro(`select name from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0]?.name,name);
  assert.deepEqual(preserved(),before,'Existing chat functions or publication permissions changed');
  const installed=ro(`select
    (select count(*)::int from pg_class where oid in('public.gazette_comment_translations'::regclass,'public.gazette_comment_translation_jobs'::regclass,'public.gazette_comment_translation_requests'::regclass,'public.gazette_comment_translation_daily_budget'::regclass) and relrowsecurity) rls_tables,
    has_table_privilege('authenticated','public.gazette_comment_translations','select') player_cache_read,
    has_function_privilege('authenticated','public.claim_gazette_comment_translation_batch(uuid,text,jsonb)','execute') player_claim,
    has_function_privilege('authenticated','public.complete_gazette_comment_translation_batch(uuid,jsonb,boolean)','execute') player_complete,
    has_function_privilege('service_role','public.claim_gazette_comment_translation_batch(uuid,text,jsonb)','execute') server_claim,
    (select count(*)::int from pg_trigger where tgrelid in('public.gazette_comment_translations'::regclass,'public.gazette_comment_translation_jobs'::regclass,'public.gazette_comment_translation_requests'::regclass,'public.gazette_comment_translation_daily_budget'::regclass) and not tgisinternal) gameplay_triggers`)[0];
  assert.deepEqual(installed,{rls_tables:4,player_cache_read:false,player_claim:false,player_complete:false,server_claim:true,gameplay_triggers:0});
  const proof={databaseRead:'ok',migrationRecorded:true,chatAndPublicationPreserved:true,installed,productionFixturesRun:false,providerCalls:0};
  writeFileSync('.codex-tools/gazette-comment-translations-production-proof.json',JSON.stringify({...proof,preserved:before},null,2));
  console.log(JSON.stringify(proof));
}
