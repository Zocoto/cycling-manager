// Production is never a test database. Apply only the reviewed migrations.
// Every diagnostic is read-only, bounded, sequential and task-scoped.
// An interrupted/failed apply is never resumed automatically: inspect first.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const mode=process.argv[2];
assert.ok(['--preflight','--apply','--verify','--inspect'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const folder='artifacts/.tmp-game-news-release';
const migrations=['20261022123001_community_staff_and_news','20261022123002_import_existing_game_product_news'];
const signatures=['public.get_current_game_header_indicators_v2()','public.get_current_game_header_identity()'];
const catalog=`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl,p.proowner::regrole::text owner from pg_proc p where p.oid in (${signatures.map(s=>`'${s}'::regprocedure`).join(',')}) order by p.oid::regprocedure::text;`;
const stableCatalog=rows=>[...rows].sort((a,b)=>a.signature.localeCompare(b.signature));
const applicationNames=['preflight','apply','verify','inspect'].map(s=>`game-news-release-${s}`).concat(
  'game-news-schema-migration-20261022120000','game-news-import-migration-20261022121000');
const run=args=>execFileSync(binary,args,{encoding:'utf8',timeout:30000,maxBuffer:150000,stdio:['ignore','pipe','pipe']});
mkdirSync(folder,{recursive:true});
const receiptFile=`${folder}/receipts.json`;
const receipts=existsSync(receiptFile)?JSON.parse(readFileSync(receiptFile,'utf8')):[];
function receipt(step,status,details={}){
  receipts.push({at:new Date().toISOString(),mode,step,status,...details});
  writeFileSync(`${receiptFile}.next`,JSON.stringify(receipts,null,2));
  renameSync(`${receiptFile}.next`,receiptFile);
}
function query(sql){
  const raw=run(['db','query','--linked',`begin read only;set local application_name='game-news-release-${mode.slice(2)}';set local statement_timeout='4s';set local lock_timeout='500ms';${sql}commit;`,'--output','json']);
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
let step='start';
try{
  if(mode==='--inspect'){
    // Narrow evidence only. Never cancels sessions, retries migrations or clears
    // a failed/interrupted-apply marker; a human must review the exact outcome.
    step='inspect-task-sessions';
    const sessions=query(`select pid,application_name,state,xact_start,query_start,wait_event_type,wait_event from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and application_name in (${applicationNames.map(s=>`'${s}'`).join(',')}) order by pid limit 10;`);
    receipt(step,'succeeded',{sessions});
    step='inspect-task-migrations';
    const versions=query("select version from supabase_migrations.schema_migrations where version in ('20261022123001','20261022123002') order by version;");
    const objects=query("select to_regclass('private.user_game_roles')::text role_table,to_regclass('private.game_product_news')::text news_table,to_regprocedure('public.get_current_game_header_indicators_v3()')::text header_v3;");
    receipt(step,'succeeded',{versions,objects});
    console.log(JSON.stringify({readOnly:true,sessions,versions,objects,applyStarted:existsSync(`${folder}/apply.started.json`),blocked:existsSync(`${folder}/blocked.json`)}));
  }else if(mode==='--preflight'){
    assert.ok(!existsSync(`${folder}/apply.started.json`),'An apply already started. Use --inspect and review manually; no automatic retry.');
    assert.ok(!existsSync(`${folder}/blocked.json`),'A prior operation failed. Use --inspect and review manually.');
    step='preflight-legacy-catalog';
    const baseline=stableCatalog(query(catalog));
    assert.equal(baseline.length,2);
    receipt(step,'succeeded');
    step='preflight-owner-and-absence';
    const check=query("select (select count(*)::int from auth.users u join public.sporting_directors d on d.auth_user_id=u.id where lower(btrim(u.email))='paul.leblanc22@gmail.com' and lower(btrim(d.username))='zocoto' and d.status='active') owner_count,to_regclass('private.user_game_roles')::text role_table,to_regclass('private.game_product_news')::text news_table,to_regprocedure('public.get_current_game_header_indicators_v3()')::text header_v3;");
    assert.equal(check[0].owner_count,1,'Exactly one existing authorized owner is required.');
    for(const key of ['role_table','news_table','header_v3'])assert.equal(check[0][key],null,'Task objects already exist; inspect instead of replaying.');
    writeFileSync(`${folder}/baseline.json`,JSON.stringify(baseline,null,2));
    receipt(step,'succeeded',{existingOwner:1});
    console.log(JSON.stringify({preflight:true,existingOwner:1,unchangedFunctions:baseline.length,readOnly:true}));
  }else if(mode==='--apply'){
    assert.ok(!existsSync(`${folder}/blocked.json`),'A prior operation failed. Use --inspect and review manually.');
    // Exclusive marker is intentionally permanent, including after success.
    // A second --apply cannot replay either migration after a disconnect.
    writeFileSync(`${folder}/apply.started.json`,JSON.stringify({at:new Date().toISOString(),migrations}),{flag:'wx'});
    step='apply-legacy-catalog';
    const baseline=stableCatalog(JSON.parse(readFileSync(`${folder}/baseline.json`,'utf8')));
    assert.deepEqual(stableCatalog(query(catalog)),baseline,'Catalog changed since review; stop.');
    receipt(step,'succeeded');
    for(const name of migrations){
      step=`apply-${name}`;
      receipt(step,'started');
      run(['db','query','--linked','--file',`supabase/migrations/${name}.sql`,'--output','json']);
      receipt(step,'succeeded');
      console.log(`Applied: ${name}`);
      step=`record-${name.slice(0,14)}`;
      receipt(step,'started');
      run(['migration','repair',name.slice(0,14),'--status','applied','--linked','--yes']);
      receipt(step,'succeeded');
      console.log(`Recorded: ${name.slice(0,14)}`);
    }
  }else{
    step='verify-legacy-catalog';
    const baseline=stableCatalog(JSON.parse(readFileSync(`${folder}/baseline.json`,'utf8')));
    assert.deepEqual(stableCatalog(query(catalog)),baseline,'Legacy header definitions/permissions changed.');
    receipt(step,'succeeded');
    step='verify-task-permissions';
    const [r]=query(`select jsonb_build_object(
      'owner_count',(select count(*) from private.user_game_roles where role='owner' and revoked_at is null),
      'owner_is_zocoto',(select count(*)=1 from private.user_game_roles r join auth.users u on u.id=r.auth_user_id join public.sporting_directors d on d.auth_user_id=u.id where r.role='owner' and r.revoked_at is null and lower(btrim(u.email))='paul.leblanc22@gmail.com' and lower(btrim(d.username))='zocoto' and d.status='active'),
      'delegated_count',(select count(*) from private.user_game_roles where role='game_staff' and revoked_at is null),
      'imported_news',(select count(*) from private.game_product_news where id::text like '22a00000-0000-4000-8000-%'),
      'published_count',(select count(*) from public.get_published_game_news(50,null)),
      'public_shapes_safe',(select bool_and(not(to_jsonb(n)?'draft') and not(to_jsonb(n)?'created_by')) from public.get_published_game_news(50,null) n),
      'private_tables_safe',(select bool_and(relrowsecurity and not has_table_privilege('anon',p.oid,'SELECT') and not has_table_privilege('authenticated',p.oid,'SELECT') and not has_table_privilege('service_role',p.oid,'SELECT')) from pg_class p where p.oid in ('private.user_game_roles'::regclass,'private.user_game_role_events'::regclass,'private.game_product_news'::regclass,'private.game_product_news_events'::regclass)),
      'mutations_safe',(select bool_and(prosecdef and proconfig @> array['search_path=""'] and not has_function_privilege('anon',p.oid,'EXECUTE') and has_function_privilege('authenticated',p.oid,'EXECUTE')) from pg_proc p where p.oid in ('public.save_game_news_draft(uuid,integer,jsonb)'::regprocedure,'public.publish_game_news(uuid,integer)'::regprocedure,'public.set_game_staff_role(uuid,boolean)'::regprocedure)),
      'reader_available',has_function_privilege('anon','public.get_published_game_news(integer,uuid)','EXECUTE'),
      'v3_available',has_function_privilege('authenticated','public.get_current_game_header_indicators_v3()','EXECUTE'),
      'database_healthy',true
    ) verification;`);
    const result=r.verification;
    assert.equal(Number(result.owner_count),1);assert.ok(Number(result.imported_news)>=9);assert.ok(Number(result.published_count)>=9);
    for(const key of ['owner_is_zocoto','public_shapes_safe','private_tables_safe','mutations_safe','reader_available','v3_available','database_healthy'])assert.equal(result[key],true,key);
    receipt(step,'succeeded',{result});
    console.log(JSON.stringify({verified:true,readOnly:true,legacyHeaderUnchanged:true,...result}));
  }
}catch(error){
  // No catch-and-continue and no automatic recovery: after an uncertain outcome,
  // the next permitted operation is read-only inspection of this task only.
  const failure={at:new Date().toISOString(),mode,step,status:error.status??null,signal:error.signal??null,code:error.code??null};
  if(mode!=='--inspect')writeFileSync(`${folder}/blocked.json`,JSON.stringify(failure,null,2));
  receipt(step,'failed',failure);
  console.error('Stopped safely. Inspect the task outcome with --inspect; do not replay migrations automatically.');
  throw error;
}
